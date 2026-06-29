export const PYTHON_PROJECT_FILES = {
  "requirements.txt": `customtkinter>=5.2.0
pydub>=0.25.1
faster-whisper>=1.0.0
numpy>=1.20.0
soundfile>=0.12.0
pygame>=2.5.0
pyinstaller>=6.0.0
`,

  "setup_instructions.md": `# Panduan Instalasi & Build - Audio Slicer Pro (Python Desktop Companion)

Companion Desktop ini dirancang sebagai aplikasi desktop kelas produksi menggunakan **CustomTkinter** untuk UI modern gelap, **Pygame** untuk pemutar media interaktif dan tapper presisi tinggi, **PyDub** untuk pemrosesan audio lossless, dan **Faster-Whisper** untuk transkripsi & sinkronisasi AI berkecepatan tinggi secara offline.

---

## 1. Prasyarat Sistem
Aplikasi ini memerlukan **Python 3.9 s.d 3.11** dan **FFmpeg** terinstal di sistem Anda.

### Menginstal FFmpeg:
- **Windows**: 
  1. Unduh FFmpeg build dari [gyan.dev](https://www.gyan.dev/ffmpeg/builds/).
  2. Ekstrak file zip ke \`C:\\ffmpeg\`.
  3. Tambahkan \`C:\\ffmpeg\\bin\` ke Environment PATH sistem Anda.
- **macOS**: \`brew install ffmpeg\`
- **Linux**: \`sudo apt update && sudo apt install ffmpeg -y\`

---

## 2. Cara Instalasi & Menjalankan

1. Ekstrak semua file project Python ini ke dalam satu folder.
2. Buka terminal atau Command Prompt di folder tersebut.
3. Buat virtual environment (Direkomendasikan):
   \`\`\`bash
   python -m venv venv
   # Di Windows aktifkan:
   venv\\Scripts\\activate
   # Di macOS/Linux aktifkan:
   source venv/bin/activate
   \`\`\`
4. Instal semua dependensi:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`
5. Jalankan aplikasi:
   \`\`\`bash
   python main.py
   \`\`\`

---

## 3. Cara Kompilasi Menjadi File Executable (.exe)

Untuk membuat aplikasi tunggal \`.exe\` tanpa membutuhkan instalasi Python di komputer klien, gunakan **PyInstaller**:

\`\`\`bash
pyinstaller --noconsole --onefile --icon=app_icon.ico --name="AudioSlicerPro" --add-data "requirements.txt;." main.py
\`\`\`

*Catatan untuk Windows:*
- Pastikan Anda menjalankan perintah di atas dalam kondisi virtual environment aktif.
- File executable hasil build akan terletak di dalam folder \`dist/\`.

---

## 4. Panduan Struktur Kode
- \`main.py\`: Mengelola UI Desktop premium, pemutar audio Pygame, tabel segmen interaktif, pengetukan Live Tapper, impor/ekspor SRT, dan log.
- \`audio_engine.py\`: Algoritma pendeteksi jeda sunyi (VAD) berpresisi tinggi dan pengeksporan audio slices otomatis lengkap dengan berkas subtitle .srt dan .lrc.
- \`ai_engine.py\`: Integrasi model Whisper offline untuk transkripsi otomatis dan penyelarasan fuzzy matching naskah.
`,

  "audio_engine.py": `import os
from pydub import AudioSegment
from pydub.silence import detect_nonsilent

class AudioEngine:
    @staticmethod
    def get_audio_info(file_path):
        """Mendapatkan metadata mendalam dari file audio."""
        try:
            audio = AudioSegment.from_file(file_path)
            bitrate = getattr(audio, 'frame_rate', 44100) * getattr(audio, 'sample_width', 2) * 8 * audio.channels
            return {
                "name": os.path.basename(file_path),
                "path": file_path,
                "size_mb": round(os.path.getsize(file_path) / (1024 * 1024), 2),
                "format": os.path.splitext(file_path)[1][1:].upper(),
                "duration_sec": audio.duration_seconds,
                "sample_rate": audio.frame_rate,
                "channels": audio.channels,
                "bitrate_kbps": round(bitrate / 1000, 1)
            }
        except Exception as e:
            raise Exception(f"Gagal menganalisis file audio: {str(e)}")

    @staticmethod
    def detect_silence_segments(file_path, min_silence_len=500, silence_thresh=-40):
        """Deteksi zona suara aktif berdasarkan ambang desibel."""
        try:
            audio = AudioSegment.from_file(file_path)
            ranges_ms = detect_nonsilent(audio, min_silence_len=min_silence_len, silence_thresh=silence_thresh)
            
            segments = []
            for i, r in enumerate(ranges_ms):
                segments.append({
                    "id": i + 1,
                    "start": r[0] / 1000.0,
                    "end": r[1] / 1000.0,
                    "duration": (r[1] - r[0]) / 1000.0,
                    "text": f"Segmen Audio Aktif #{i+1}"
                })
            return segments
        except Exception as e:
            raise Exception(f"Gagal melakukan deteksi keheningan (VAD): {str(e)}")

    @staticmethod
    def format_srt_time(secs):
        h = int(secs // 3600)
        m = int((secs % 3600) // 60)
        s = int(secs % 60)
        ms = int(round((secs % 1) * 1000))
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    @staticmethod
    def format_lrc_time(secs):
        m = int(secs // 60)
        s = int(secs % 60)
        cs = int(round((secs % 1) * 100))
        return f"{m:02d}:{s:02d}.{cs:02d}"

    @staticmethod
    def generate_srt(segments):
        srt_lines = []
        for i, seg in enumerate(segments):
            start_str = AudioEngine.format_srt_time(seg["start"])
            end_str = AudioEngine.format_srt_time(seg["end"])
            srt_lines.append(f"{i+1}\\n{start_str} --> {end_str}\\n{seg.get('text', '')}\\n")
        return "\\n".join(srt_lines)

    @staticmethod
    def generate_lrc(segments):
        lrc_lines = []
        for seg in segments:
            time_str = AudioEngine.format_lrc_time(seg["start"])
            lrc_lines.append(f"[{time_str}]{seg.get('text', '')}")
        return "\\n".join(lrc_lines)

    @staticmethod
    def slice_and_save(file_path, segments, output_dir, output_format="MP3", quality="192k"):
        """Memotong file audio menjadi segmen terpisah secara lossless/high quality."""
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        audio = AudioSegment.from_file(file_path)
        exported_files = []
        
        # Save companion files (SRT & LRC)
        srt_content = AudioEngine.generate_srt(segments)
        with open(os.path.join(output_dir, "subtitles.srt"), "w", encoding="utf-8") as f:
            f.write(srt_content)
            
        lrc_content = AudioEngine.generate_lrc(segments)
        with open(os.path.join(output_dir, "lyrics_synced.lrc"), "w", encoding="utf-8") as f:
            f.write(lrc_content)
        
        # Slice audio segments
        for seg in segments:
            start_ms = int(seg["start"] * 1000)
            end_ms = int(seg["end"] * 1000)
            
            cut_audio = audio[start_ms:end_ms]
            
            fade_in_sec = seg.get("fade_in", 0.0)
            fade_out_sec = seg.get("fade_out", 0.0)
            if fade_in_sec > 0:
                cut_audio = cut_audio.fade_in(int(fade_in_sec * 1000))
            if fade_out_sec > 0:
                cut_audio = cut_audio.fade_out(int(fade_out_sec * 1000))
            
            raw_name = seg.get("filename", f"segment_{seg['id']}")
            safe_name = "".join(c for c in raw_name if c.isalnum() or c in (' ', '_', '-')).rstrip()
            if not safe_name:
                safe_name = f"segment_{seg['id']}"
                
            out_file_name = f"{safe_name}.{output_format.lower()}"
            out_path = os.path.join(output_dir, out_file_name)
            
            bitrate_param = quality if output_format.upper() in ["MP3", "M4A", "AAC"] else None
            cut_audio.export(out_path, format=output_format.lower(), bitrate=bitrate_param)
            
            exported_files.append(out_path)
            
        return exported_files
`,

  "ai_engine.py": `import re
from faster_whisper import WhisperModel

class AIEngine:
    def __init__(self, model_size="base"):
        """Inisialisasi Whisper model secara offline."""
        # Model default 'base' seimbang antara akurasi dan kecepatan
        # Untuk komputer tanpa GPU akan berjalan otomatis menggunakan CPU
        self.model = WhisperModel(model_size, device="cpu", compute_type="int8")

    def transcribe_audio(self, file_path):
        """Transkripsi audio untuk mendapatkan teks dengan timestamp baris."""
        segments, info = self.model.transcribe(file_path, beam_size=5)
        
        results = []
        for i, segment in enumerate(segments):
            results.append({
                "id": i + 1,
                "text": segment.text.strip(),
                "start": segment.start,
                "end": segment.end
            })
        return results

    @staticmethod
    def align_text_fuzzy(lyrics, transcribed_segments):
        """Penyelarasan baris teks/lirik pengguna dengan transkripsi AI secara otomatis."""
        def clean_text(t):
            return re.sub(r'[^\\w\\s]', '', t.lower()).strip()

        lyric_lines = [line.strip() for line in lyrics.split('\\n') if line.strip()]
        aligned = []
        
        trans_idx = 0
        total_trans = len(transcribed_segments)
        
        for l_idx, line in enumerate(lyric_lines):
            clean_line = clean_text(line)
            
            best_match_idx = trans_idx
            best_score = 0
            
            for search_idx in range(trans_idx, min(trans_idx + 5, total_trans)):
                seg_text = clean_text(transcribed_segments[search_idx]["text"])
                line_words = set(clean_line.split())
                seg_words = set(seg_text.split())
                
                if not line_words:
                    continue
                overlap = len(line_words.intersection(seg_words))
                score = overlap / len(line_words)
                
                if score > best_score:
                    best_score = score
                    best_match_idx = search_idx
            
            if best_score > 0.1 and best_match_idx < total_trans:
                matched_seg = transcribed_segments[best_match_idx]
                aligned.append({
                    "id": l_idx + 1,
                    "text": line,
                    "start": matched_seg["start"],
                    "end": matched_seg["end"],
                    "confidence": round(best_score * 100, 1),
                    "filename": f"{l_idx+1:02d}_" + clean_line.replace(' ', '_')[:15]
                })
                trans_idx = best_match_idx + 1
            else:
                prev_end = aligned[-1]["end"] if aligned else 0.0
                estimated_start = prev_end + 0.5
                estimated_end = estimated_start + (len(line.split()) * 0.4)
                
                aligned.append({
                    "id": l_idx + 1,
                    "text": line,
                    "start": estimated_start,
                    "end": estimated_end,
                    "confidence": 0.0,
                    "filename": f"{l_idx+1:02d}_" + clean_line.replace(' ', '_')[:15]
                })
                
        return aligned
`,

  "main.py": `import os
import re
import threading
import time
import tkinter as tk
from tkinter import filedialog, messagebox
import customtkinter as ctk
import pygame
from audio_engine import AudioEngine
from ai_engine import AIEngine

# Set tema CustomTkinter
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class AudioSlicerApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("AcousticSplit AI - Premium Desktop Companion")
        self.geometry("1180x750")
        self.minsize(1050, 680)
        
        # Inisialisasi variabel status
        self.audio_file_path = None
        self.audio_info = {}
        self.segments = []
        self.ai_engine = None
        self.is_playing = False
        self.playback_start_offset = 0.0
        self.segment_rows = []
        
        # Inisialisasi Mixer Audio Pygame
        pygame.mixer.init()
        
        # Bangun Layout UI
        self.setup_ui()
        self.add_log("Aplikasi Desktop berhasil dijalankan. Siap mengimpor berkas audio.")
        
        # Memulai background thread untuk tracking posisi pemutar audio
        self.start_playback_tracker()

    def setup_ui(self):
        # Grid utama 1 Baris x 2 Kolom (Sidebar + Konten Utama)
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)
        
        # ==========================================
        # 1. SIDEBAR PANEL (Konfigurasi & Metadata)
        # ==========================================
        self.sidebar_frame = ctk.CTkFrame(self, width=280, corner_radius=0, fg_color="#111215")
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)
        self.sidebar_frame.grid_rowconfigure(10, weight=1)
        
        # Brand logo
        self.logo_label = ctk.CTkLabel(self.sidebar_frame, text="ACUSTICSPLIT AI", font=ctk.CTkFont(family="Courier", size=18, weight="bold"), text_color="#00ffff")
        self.logo_label.grid(row=0, column=0, padx=20, pady=(20, 5))
        
        self.sublogo_label = ctk.CTkLabel(self.sidebar_frame, text="V1.2.0 DESKTOP COMPANION", font=ctk.CTkFont(family="Courier", size=9), text_color="gray")
        self.sublogo_label.grid(row=1, column=0, padx=20, pady=(0, 15))
        
        # Info Panel Card
        self.info_card = ctk.CTkFrame(self.sidebar_frame, fg_color="#18191d", border_width=1, border_color="#2a2b2f")
        self.info_card.grid(row=2, column=0, padx=15, pady=10, sticky="ew")
        
        self.info_title = ctk.CTkLabel(self.info_card, text="METADATA AUDIO", font=ctk.CTkFont(family="Courier", size=11, weight="bold"), text_color="#00ffff")
        self.info_title.pack(anchor="w", padx=10, pady=(10, 2))
        
        self.info_text = tk.Text(self.info_card, height=7, bg="#0e0f11", fg="#e0e0e0", bd=0, font=("Courier", 10), padx=8, pady=8)
        self.info_text.pack(fill="x", padx=10, pady=(0, 10))
        self.info_text.insert("1.0", "Belum ada file audio terpilih.")
        self.info_text.config(state="disabled")
        
        # Konfigurasi Slicing
        self.cfg_title = ctk.CTkLabel(self.sidebar_frame, text="KONFIGURASI EKSPOR", font=ctk.CTkFont(family="Courier", size=12, weight="bold"), text_color="#00ffff")
        self.cfg_title.grid(row=3, column=0, padx=20, pady=(15, 5), sticky="w")
        
        self.lbl_format = ctk.CTkLabel(self.sidebar_frame, text="Format Audio Slices:", font=ctk.CTkFont(size=11), text_color="gray")
        self.lbl_format.grid(row=4, column=0, padx=20, pady=0, sticky="w")
        self.format_menu = ctk.CTkOptionMenu(self.sidebar_frame, values=["MP3", "WAV", "FLAC", "OGG", "M4A"], fg_color="#1a1b1f", button_color="#2a2b2f")
        self.format_menu.grid(row=5, column=0, padx=20, pady=(2, 10), sticky="ew")
        self.format_menu.set("WAV")
        
        self.lbl_bitrate = ctk.CTkLabel(self.sidebar_frame, text="Kualitas Presets (CBR):", font=ctk.CTkFont(size=11), text_color="gray")
        self.lbl_bitrate.grid(row=6, column=0, padx=20, pady=0, sticky="w")
        self.bitrate_menu = ctk.CTkOptionMenu(self.sidebar_frame, values=["128k", "192k", "256k", "320k"], fg_color="#1a1b1f", button_color="#2a2b2f")
        self.bitrate_menu.grid(row=7, column=0, padx=20, pady=(2, 10), sticky="ew")
        self.bitrate_menu.set("192k")
        
        # Folder Output
        self.lbl_folder = ctk.CTkLabel(self.sidebar_frame, text="Direktori Output:", font=ctk.CTkFont(size=11), text_color="gray")
        self.lbl_folder.grid(row=8, column=0, padx=20, pady=0, sticky="w")
        
        self.entry_output_dir = ctk.CTkEntry(self.sidebar_frame, fg_color="#1a1b1f", border_width=1, border_color="#2a2b2f")
        self.entry_output_dir.grid(row=9, column=0, padx=20, pady=2, sticky="ew")
        self.entry_output_dir.insert(0, os.path.join(os.path.expanduser("~"), "Music", "AcousticSplit"))
        
        self.btn_browse = ctk.CTkButton(self.sidebar_frame, text="PILIH DIREKTORI", fg_color="#1a1b1f", hover_color="#2a2b2f", border_width=1, border_color="#2a2b2f", command=self.browse_output_dir)
        self.btn_browse.grid(row=10, column=0, padx=20, pady=(5, 15), sticky="ew")
        
        # Ekspor Action Buttons
        self.btn_export = ctk.CTkButton(self.sidebar_frame, text="SLICE & EXPORT", fg_color="#008888", hover_color="#006666", text_color="#000000", font=ctk.CTkFont(weight="bold"), command=self.export_segments)
        self.btn_export.grid(row=11, column=0, padx=20, pady=5, sticky="ew")
        
        self.btn_export_srt = ctk.CTkButton(self.sidebar_frame, text="EXPORT SUBTITLES (.SRT)", fg_color="transparent", border_width=1, border_color="#00ffff", text_color="#00ffff", hover_color="#004444", command=self.export_srt_file)
        self.btn_export_srt.grid(row=12, column=0, padx=20, pady=(5, 20), sticky="ew")
        
        # ==========================================
        # 2. MAIN CONTENT PANEL (Waveform, Editor)
        # ==========================================
        self.main_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.main_frame.grid(row=0, column=1, sticky="nsew", padx=15, pady=15)
        self.main_frame.grid_rowconfigure(1, weight=1) # split panels
        self.main_frame.grid_columnconfigure(0, weight=1)
        
        # 2a. TOP AUDIO PLAYER CONTROL (Waveform Simulator)
        self.player_card = ctk.CTkFrame(self.main_frame, fg_color="#111215", border_width=1, border_color="#2a2b2f")
        self.player_card.grid(row=0, column=0, sticky="ew", padx=5, pady=(0, 10))
        
        # Player control row
        self.control_row = ctk.CTkFrame(self.player_card, fg_color="transparent")
        self.control_row.pack(fill="x", padx=15, pady=10)
        
        self.btn_play_audio = ctk.CTkButton(self.control_row, text="PLAY AUDIO", width=120, fg_color="#008888", text_color="#000000", hover_color="#00aaaa", font=ctk.CTkFont(weight="bold"), command=self.toggle_audio_play)
        self.btn_play_audio.pack(side="left", padx=5)
        
        self.btn_stop_audio = ctk.CTkButton(self.control_row, text="STOP & RESET", width=110, fg_color="#2b2b2f", hover_color="#3a3b3f", command=self.stop_audio_playback)
        self.btn_stop_audio.pack(side="left", padx=5)
        
        self.lbl_time_display = ctk.CTkLabel(self.control_row, text="00:00.00 / 00:00.00", font=ctk.CTkFont(family="Courier", size=12, weight="bold"), text_color="#00ffff")
        self.lbl_time_display.pack(side="right", padx=10)
        
        self.btn_import_audio = ctk.CTkButton(self.control_row, text="PILIH FILE AUDIO", fg_color="#1f538d", hover_color="#133c66", command=self.select_audio_file)
        self.btn_import_audio.pack(side="right", padx=5)
        
        # Audio seekbar slider
        self.seekbar_slider = ctk.CTkSlider(self.player_card, from_=0, to=100, number_of_steps=1000, command=self.on_seekbar_drag, button_color="#00ffff")
        self.seekbar_slider.pack(fill="x", padx=20, pady=(0, 15))
        self.seekbar_slider.set(0)
        
        # 2b. CENTER SPLIT PANELS (Left: Lyrics, Right: Segment Timeline Editor)
        self.split_frame = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        self.split_frame.grid(row=1, column=0, sticky="nsew", padx=0, pady=5)
        self.split_frame.grid_rowconfigure(0, weight=1)
        self.split_frame.grid_columnconfigure(0, weight=4) # Left
        self.split_frame.grid_columnconfigure(1, weight=6) # Right
        
        # LEFT PANEL (Script / Lyrics Editor with Tabview)
        self.left_panel = ctk.CTkFrame(self.split_frame, fg_color="#111215", border_width=1, border_color="#2a2b2f")
        self.left_panel.grid(row=0, column=0, sticky="nsew", padx=(5, 5), pady=0)
        
        self.left_tabview = ctk.CTkTabview(self.left_panel, fg_color="transparent")
        self.left_tabview.pack(fill="both", expand=True, padx=5, pady=5)
        
        self.tab_editor = self.left_tabview.add("Naskah & Impor")
        self.tab_guide = self.left_tabview.add("Panduan Penggunaan")
        
        # Text Editor Container (inside tab_editor)
        self.text_editor_frame = ctk.CTkFrame(self.tab_editor, fg_color="transparent")
        self.text_editor_frame.pack(fill="both", expand=True, padx=5, pady=(5, 10))
        
        self.text_lyrics = tk.Text(self.text_editor_frame, bg="#0e0f11", fg="#ffffff", insertbackground="white", bd=0, font=("Courier", 11), padx=10, pady=10)
        self.text_lyrics.pack(fill="both", expand=True)
        self.text_lyrics.insert("1.0", "[Paste naskah lirik atau skrip dialog di sini,\\nsatu kalimat per baris untuk hasil presisi]")
        
        # Text Imports row
        self.import_row = ctk.CTkFrame(self.tab_editor, fg_color="transparent")
        self.import_row.pack(fill="x", padx=5, pady=(0, 5))
        
        self.btn_import_txt = ctk.CTkButton(self.import_row, text="IMPORT LRC/TXT", fg_color="#2b2b2f", hover_color="#3a3b3f", height=28, command=self.select_text_import)
        self.btn_import_txt.pack(side="left", fill="x", expand=True, padx=(0, 5))
        
        self.btn_import_srt = ctk.CTkButton(self.import_row, text="IMPORT .SRT (AUTO-SPLIT)", fg_color="#2b2b2f", hover_color="#3a3b3f", height=28, command=self.select_srt_import, text_color="#00ffff")
        self.btn_import_srt.pack(side="right", fill="x", expand=True, padx=(5, 0))
        
        # Guide Content Container
        self.guide_text = tk.Text(self.tab_guide, bg="#0e0f11", fg="#a0a5b5", bd=0, font=("Courier", 10), padx=10, pady=10, insertbackground="white")
        self.guide_text.pack(fill="both", expand=True, padx=5, pady=5)
        
        guide_content = """=== CARA PENGGUNAAN ACOUSTICSPLIT AI ===

Aplikasi ini menyediakan 4 metode canggih untuk memotong file audio Anda secara lossless dan sinkron dengan naskah teks/lirik:

1. METODE SCAN SILENCE (VAD)
   - Digunakan untuk memotong audio secara otomatis berdasarkan jeda keheningan/sunyi.
   - Cara:
     1. Pilih file audio dengan tombol "PILIH FILE AUDIO".
     2. Atur "VAD SENSITIVITY" (default -40 dB) dan "MIN SILENCE" (default 0.5s).
     3. Klik tombol "SCAN SILENCE (VAD)" di bagian bawah.
     4. Segmen suara aktif otomatis terdeteksi dan masuk ke editor kanan.

2. METODE AI SINKRON ALIGN (OFFLINE)
   - Digunakan jika Anda memiliki rekaman percakapan/suara utuh dan naskah teks lengkap, lalu ingin AI mencocokkan setiap baris secara otomatis menggunakan model Whisper offline.
   - Cara:
     1. Paste naskah/lirik Anda di tab "Naskah & Impor" (satu baris untuk satu potong kalimat).
     2. Klik tombol "AI SINKRON ALIGN". AI akan membaca audio, mentranskripsinya, dan mencocokkannya dengan baris naskah Anda menggunakan algoritme fuzzy matching.

3. METODE BAGI RATA SESUAI TEKS
   - Digunakan untuk pembagian durasi yang sama rata untuk setiap baris kalimat. Cocok untuk lirik bertempo konstan atau pembacaan naskah berkala.
   - Cara:
     1. Paste naskah/lirik di tab "Naskah & Impor".
     2. Klik tombol "BAGI RATA SESUAI TEKS". Durasi audio akan dibagi sama rata sebanyak jumlah baris naskah.

4. METODE LIVE TAPPER SYNC (MANUAL - PRESISI TINGGI)
   - Metode interaktif paling direkomendasikan untuk sinkronisasi teks lirik/lagu secara presisi sembari audio diputar real-time!
   - Cara:
     1. Paste naskah/lirik di tab "Naskah & Impor" (satu baris per potongan kalimat).
     2. Klik tombol hijau "LIVE TAPPER SYNC". Jendela interaktif akan muncul.
     3. Audio akan mulai berputar secara otomatis.
     4. Tekan tombol [SPASI] atau [ENTER] di keyboard Anda (atau tombol hijau di layar) tepat saat baris teks yang tampil selesai diucapkan/dinyanyikan.
     5. Teks baris berikutnya akan muncul. Teruskan ketukan hingga selesai.
     6. Setelah selesai, jendela otomatis tertutup dan seluruh segmen hasil ketukan instan tersinkronisasi di editor kanan.

=== PINTASAN KEYBOARD (HOTKEYS LIVE TAPPER) ===
Aplikasi ini mendukung tombol alternatif lengkap agar proses mengetuk menjadi sangat mudah dan ergonomis:
- [SPASI] atau [ENTER]  ➔ TAP (Selesai Baris)
- [PANAH KANAN / BAWAH] ➔ TAP (Selesai Baris - Alternatif)
- [BACKSPACE]          ➔ UNDO (Batalkan ketukan terakhir/kembali ke baris sebelumnya)
- [PANAH KIRI / ATAS]   ➔ UNDO (Batal ketuk - Alternatif)

=== TINJAU & EKSPOR (REVIEW & EXPORT) ===
- Setelah segmen terbentuk di editor kanan, Anda bisa mengedit teks, waktu awal (START), atau waktu akhir (END) secara manual.
- Klik tombol "▶" pada baris segmen untuk mendengarkan potongan suara tersebut saja.
- Klik "UPDATE CHANGES" setelah mengubah angka secara manual untuk memvalidasi dan mengurutkan segmen.
- Klik "+ ADD SEGMENT" untuk menambahkan baris potongan baru secara manual.
- Klik "❌" untuk menghapus segmen tertentu.
- Klik "SLICE & EXPORT" di sidebar kiri untuk memotong file audio secara fisik menjadi file-file kecil yang lossless sesuai format (WAV, MP3, dll) ke direktori output pilihan Anda!
- Berkas subtitle (.SRT) dan berkas sinkronisasi lirik (.LRC) akan otomatis ikut dibuat di folder output tersebut.
"""
        self.guide_text.insert("1.0", guide_content)
        self.guide_text.config(state="disabled")
        
        # RIGHT PANEL (Timeline Review Editor)
        self.right_panel = ctk.CTkFrame(self.split_frame, fg_color="#111215", border_width=1, border_color="#2a2b2f")
        self.right_panel.grid(row=0, column=1, sticky="nsew", padx=(5, 5), pady=0)
        
        # Timeline Header
        self.timeline_header = ctk.CTkFrame(self.right_panel, fg_color="transparent")
        self.timeline_header.pack(fill="x", padx=15, pady=(15, 5))
        
        self.lbl_timeline_title = ctk.CTkLabel(self.timeline_header, text="REVIEW TIMELINE EDITOR", font=ctk.CTkFont(family="Courier", size=12, weight="bold"), text_color="#00ffff")
        self.lbl_timeline_title.pack(side="left")
        
        self.lbl_segment_count = ctk.CTkLabel(self.timeline_header, text="0 Segments", font=ctk.CTkFont(family="Courier", size=10, weight="bold"), text_color="cyan")
        self.lbl_segment_count.pack(side="right")
        
        # Scrollable Segment Table
        self.scroll_frame = ctk.CTkScrollableFrame(self.right_panel, fg_color="#0e0f11", label_text="")
        self.scroll_frame.pack(fill="both", expand=True, padx=15, pady=5)
        
        # Segment footer (Add & Update)
        self.segment_footer = ctk.CTkFrame(self.right_panel, fg_color="transparent")
        self.segment_footer.pack(fill="x", padx=15, pady=(5, 15))
        
        self.btn_add_seg = ctk.CTkButton(self.segment_footer, text="+ ADD SEGMENT", fg_color="#2b2b2f", hover_color="#3a3b3f", height=28, command=self.add_empty_segment)
        self.btn_add_seg.pack(side="left", fill="x", expand=True, padx=(0, 5))
        
        self.btn_save_segs = ctk.CTkButton(self.segment_footer, text="UPDATE CHANGES", fg_color="#1f538d", hover_color="#133c66", height=28, command=self.save_edited_segments)
        self.btn_save_segs.pack(side="right", fill="x", expand=True, padx=(5, 0))
        
        # 2c. BOTTOM CONTROLS TOOLBAR (Sliders & Actions)
        self.controls_card = ctk.CTkFrame(self.main_frame, fg_color="#111215", border_width=1, border_color="#2a2b2f")
        self.controls_card.grid(row=2, column=0, sticky="ew", padx=5, pady=(10, 0))
        
        # Row 1: Sliders
        self.sliders_row = ctk.CTkFrame(self.controls_card, fg_color="transparent")
        self.sliders_row.pack(fill="x", padx=15, pady=(12, 8))
        
        # Slider VAD
        self.vad_box = ctk.CTkFrame(self.sliders_row, fg_color="transparent")
        self.vad_box.pack(side="left", fill="x", expand=True, padx=5)
        self.lbl_vad = ctk.CTkLabel(self.vad_box, text="VAD SENSITIVITY: -40 dB", font=ctk.CTkFont(family="Courier", size=10, weight="bold"))
        self.lbl_vad.pack(anchor="w")
        self.slider_vad_sensitivity = ctk.CTkSlider(self.vad_box, from_=-60, to=-10, command=self.on_vad_slider_drag)
        self.slider_vad_sensitivity.pack(fill="x", pady=2)
        self.slider_vad_sensitivity.set(-40)
        
        # Slider Min Silence
        self.sil_box = ctk.CTkFrame(self.sliders_row, fg_color="transparent")
        self.sil_box.pack(side="left", fill="x", expand=True, padx=5)
        self.lbl_sil = ctk.CTkLabel(self.sil_box, text="MIN SILENCE: 0.50 s", font=ctk.CTkFont(family="Courier", size=10, weight="bold"))
        self.lbl_sil.pack(anchor="w")
        self.slider_min_silence = ctk.CTkSlider(self.sil_box, from_=0.1, to=2.0, command=self.on_sil_slider_drag)
        self.slider_min_silence.pack(fill="x", pady=2)
        self.slider_min_silence.set(0.50)
        
        # Slider Latency Compensation
        self.comp_box = ctk.CTkFrame(self.sliders_row, fg_color="transparent")
        self.comp_box.pack(side="left", fill="x", expand=True, padx=5)
        self.lbl_comp = ctk.CTkLabel(self.comp_box, text="TAPPER COMPENSATION: 50 ms", font=ctk.CTkFont(family="Courier", size=10, weight="bold"))
        self.lbl_comp.pack(anchor="w")
        self.slider_compensation = ctk.CTkSlider(self.comp_box, from_=-0.5, to=0.5, command=self.on_comp_slider_drag)
        self.slider_compensation.pack(fill="x", pady=2)
        self.slider_compensation.set(0.05) # 50ms default
        
        # Row 2: Action Grid
        self.actions_row = ctk.CTkFrame(self.controls_card, fg_color="transparent")
        self.actions_row.pack(fill="x", padx=15, pady=(0, 12))
        
        self.btn_scan_silence = ctk.CTkButton(self.actions_row, text="SCAN SILENCE (VAD)", fg_color="#1a1b1f", hover_color="#2b2b2f", border_width=1, border_color="#2a2b2f", command=self.run_vad_analysis)
        self.btn_scan_silence.pack(side="left", fill="x", expand=True, padx=3)
        
        self.btn_ai_align = ctk.CTkButton(self.actions_row, text="AI SINKRON ALIGN", fg_color="#006666", hover_color="#008888", text_color="#00ffff", command=self.run_ai_alignment)
        self.btn_ai_align.pack(side="left", fill="x", expand=True, padx=3)
        
        self.btn_proportional = ctk.CTkButton(self.actions_row, text="BAGI RATA SESUAI TEKS", fg_color="#1a1b1f", hover_color="#2b2b2f", border_width=1, border_color="#2a2b2f", command=self.run_proportional_split)
        self.btn_proportional.pack(side="left", fill="x", expand=True, padx=3)
        
        self.btn_live_tapper = ctk.CTkButton(self.actions_row, text="LIVE TAPPER SYNC", fg_color="#2ca02c", hover_color="#1e731e", text_color="#000000", font=ctk.CTkFont(weight="bold"), command=self.open_live_tapper)
        self.btn_live_tapper.pack(side="left", fill="x", expand=True, padx=3)
        
        # ==========================================
        # 3. CONSOLE ACTIVITY LOG (Terbawah)
        # ==========================================
        self.log_frame = ctk.CTkFrame(self, fg_color="#0e0f11", border_width=1, border_color="#2a2b2f")
        self.log_frame.grid(row=1, column=0, columnspan=2, sticky="ew", padx=15, pady=(10, 15))
        
        self.log_text = tk.Text(self.log_frame, height=4, bg="#08090a", fg="#00ffcc", bd=0, font=("Courier", 9), padx=10, pady=10)
        self.log_text.pack(fill="x", expand=True)
        
        # Refresh Segments list once empty
        self.refresh_segment_ui()

    # Log writer
    def add_log(self, msg):
        self.log_text.config(state="normal")
        self.log_text.insert("end", f"[{time.strftime('%H:%M:%S')}] {msg}\\n")
        self.log_text.see("end")
        self.log_text.config(state="disabled")

    # Audio Playback tracker loop
    def start_playback_tracker(self):
        def loop():
            while True:
                time.sleep(0.05)
                if self.is_playing:
                    try:
                        if pygame.mixer.music.get_busy():
                            curr_pos_ms = pygame.mixer.music.get_pos()
                            if curr_pos_ms >= 0:
                                absolute_sec = self.playback_start_offset + (curr_pos_ms / 1000.0)
                                duration = self.audio_info.get("duration_sec", 0.0)
                                if duration > 0:
                                    # Update UI elements safely in main thread
                                    self.seekbar_slider.set((absolute_sec / duration) * 100)
                                    self.lbl_time_display.configure(text=f"{self.format_timer(absolute_sec)} / {self.format_timer(duration)}")
                        else:
                            # Ended naturally
                            self.is_playing = False
                            self.btn_play_audio.configure(text="PLAY AUDIO", fg_color="#008888")
                    except:
                        pass
        threading.Thread(target=loop, daemon=True).start()

    def format_timer(self, secs):
        m = int(secs // 60)
        s = int(secs % 60)
        ms = int((secs % 1) * 100)
        return f"{m:02d}:{s:02d}.{ms:02d}"

    # Handlers for seeking
    def on_seekbar_drag(self, val):
        if not self.audio_file_path:
            self.seekbar_slider.set(0)
            return
        duration = self.audio_info.get("duration_sec", 0.0)
        if duration <= 0:
            return
            
        target_sec = (val / 100) * duration
        self.add_log(f"Seeking playhead ke {target_sec:.2f} detik")
        
        # Seek with pygame
        if self.is_playing:
            pygame.mixer.music.play(start=target_sec)
            self.playback_start_offset = target_sec
        else:
            # Just set offset so play starts from here
            self.playback_start_offset = target_sec
            self.lbl_time_display.configure(text=f"{self.format_timer(target_sec)} / {self.format_timer(duration)}")

    def toggle_audio_play(self):
        if not self.audio_file_path:
            messagebox.showwarning("Peringatan", "Unggah berkas audio terlebih dahulu.")
            return
            
        if self.is_playing:
            # Pause
            pygame.mixer.music.pause()
            self.is_playing = False
            self.btn_play_audio.configure(text="RESUME AUDIO", fg_color="#00aa88")
            self.add_log("Audio di-pause.")
        else:
            # Play or Resume
            if pygame.mixer.music.get_pos() > 0:
                pygame.mixer.music.unpause()
            else:
                pygame.mixer.music.play(start=self.playback_start_offset)
            self.is_playing = True
            self.btn_play_audio.configure(text="PAUSE AUDIO", fg_color="#ff5555")
            self.add_log(f"Memutar audio dari {self.playback_start_offset:.2f} detik.")

    def stop_audio_playback(self):
        pygame.mixer.music.stop()
        self.is_playing = False
        self.playback_start_offset = 0.0
        self.seekbar_slider.set(0)
        self.btn_play_audio.configure(text="PLAY AUDIO", fg_color="#008888")
        duration = self.audio_info.get("duration_sec", 0.0)
        self.lbl_time_display.configure(text=f"00:00.00 / {self.format_timer(duration)}")
        self.add_log("Audio dihentikan dan posisi di-reset.")

    # Slider displays updates
    def on_vad_slider_drag(self, val):
        self.lbl_vad.configure(text=f"VAD SENSITIVITY: {int(val)} dB")
        
    def on_sil_slider_drag(self, val):
        self.lbl_sil.configure(text=f"MIN SILENCE: {val:.2f} s")
        
    def on_comp_slider_drag(self, val):
        self.lbl_comp.configure(text=f"TAPPER COMPENSATION: {int(val * 1000)} ms")

    # Select audio file handler
    def select_audio_file(self):
        file_path = filedialog.askopenfilename(
            filetypes=[("Audio Files", "*.mp3 *.wav *.flac *.ogg *.m4a *.aac *.opus")]
        )
        if file_path:
            self.audio_file_path = file_path
            self.add_log(f"Memilih file audio: {file_path}")
            
            # Load metadata
            try:
                self.audio_info = AudioEngine.get_audio_info(file_path)
                info_str = (
                    f"Nama: {self.audio_info['name']}\\n"
                    f"Format: {self.audio_info['format']}\\n"
                    f"Durasi: {round(self.audio_info['duration_sec'], 2)} dtk\\n"
                    f"Sample Rate: {self.audio_info['sample_rate']} Hz\\n"
                    f"Channels: {self.audio_info['channels']}\\n"
                    f"Bitrate: {self.audio_info['bitrate_kbps']} kbps\\n"
                    f"Ukuran: {self.audio_info['size_mb']} MB"
                )
                self.info_text.config(state="normal")
                self.info_text.delete("1.0", "end")
                self.info_text.insert("1.0", info_str)
                self.info_text.config(state="disabled")
                
                # Setup pygame mixer file loading
                pygame.mixer.music.load(file_path)
                
                # Stop any playback
                self.stop_audio_playback()
                self.add_log("Berkas audio berhasil dimuat dan terpasang pada pemutar.")
            except Exception as e:
                messagebox.showerror("Error", f"Gagal membaca audio: {str(e)}")

    def browse_output_dir(self):
        folder = filedialog.askdirectory()
        if folder:
            self.entry_output_dir.delete(0, "end")
            self.entry_output_dir.insert(0, folder)

    # Importers
    def select_text_import(self):
        file_path = filedialog.askopenfilename(
            filetypes=[("Text Files", "*.txt *.lrc")]
        )
        if file_path:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    lines = f.read()
                self.text_lyrics.delete("1.0", "end")
                self.text_lyrics.insert("1.0", lines)
                self.add_log(f"Berkas teks diimpor: {os.path.basename(file_path)}")
            except Exception as e:
                messagebox.showerror("Error", f"Gagal mengimpor file: {str(e)}")

    def parse_srt_timestamp_to_seconds(self, time_str):
        # Format: HH:MM:SS,mmm or HH:MM:SS.mmm
        regex = r"(\\d{2}):(\\d{2}):(\\d{2})[,.](\\d{3})"
        match = re.search(regex, time_str)
        if not match:
            simple_regex = r"(\\d{2}):(\\d{2}):(\\d{2})"
            simple_match = re.search(simple_regex, time_str)
            if simple_match:
                h, m, s = simple_match.groups()
                return int(h) * 3600 + int(m) * 60 + int(s)
            try:
                return float(time_str)
            except:
                return 0.0
        h, m, s, ms = match.groups()
        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

    def parse_srt_content(self, srt_text):
        segments_list = []
        clean_text = srt_text.replace("\\r\\n", "\\n").replace("\\r", "\\n")
        blocks = re.split(r"\\n\\s*\\n", clean_text)
        
        id_counter = 1
        for block in blocks:
            lines = [l.strip() for l in block.split("\\n") if l.strip()]
            if len(lines) < 2:
                continue
                
            time_line_idx = 0
            if lines[0].isdigit():
                time_line_idx = 1
                
            if time_line_idx >= len(lines):
                continue
                
            time_line = lines[time_line_idx]
            if "-->" not in time_line:
                continue
                
            parts = [p.strip() for p in time_line.split("-->")]
            if len(parts) != 2:
                continue
                
            start_sec = self.parse_srt_timestamp_to_seconds(parts[0])
            end_sec = self.parse_srt_timestamp_to_seconds(parts[1])
            
            text_lines = lines[time_line_idx + 1:]
            text = " ".join(text_lines)
            
            clean_txt = "".join(c for c in text.lower() if c.isalnum() or c==' ').strip().replace(' ', '_')[:15]
            
            segments_list.append({
                "id": id_counter,
                "text": text,
                "start": round(start_sec, 2),
                "end": round(end_sec, 2),
                "confidence": 100,
                "filename": f"{id_counter:02d}_{clean_txt}"
            })
            id_counter += 1
            
        return segments_list

    def select_srt_import(self):
        file_path = filedialog.askopenfilename(
            filetypes=[("Subtitle Files", "*.srt")]
        )
        if file_path:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                parsed = self.parse_srt_content(content)
                if not parsed:
                    messagebox.showerror("Error", "Gagal mengurai file .srt. Pastikan format valid.")
                    return
                    
                self.segments = parsed
                self.refresh_segment_ui()
                
                # Update lyrics editor too
                plain_lyrics = "\\n".join([s["text"] for s in parsed])
                self.text_lyrics.delete("1.0", "end")
                self.text_lyrics.insert("1.0", plain_lyrics)
                
                self.add_log(f"Sukses mengimpor .SRT: {os.path.basename(file_path)}. Terbentuk {len(parsed)} segmen.")
            except Exception as e:
                messagebox.showerror("Error", f"Gagal membaca .srt: {str(e)}")

    # Timeline Row-by-Row Renderer
    def refresh_segment_ui(self):
        # Clear existing widgets in scroll_frame
        for widget in self.scroll_frame.winfo_children():
            widget.destroy()
            
        self.segment_rows = []
        
        # Header labels inside scroll_frame
        header_frame = ctk.CTkFrame(self.scroll_frame, fg_color="transparent")
        header_frame.pack(fill="x", pady=2)
        
        header_frame.grid_columnconfigure(0, weight=0) # ID
        header_frame.grid_columnconfigure(1, weight=0) # PUTAR
        header_frame.grid_columnconfigure(2, weight=1) # TEKS SEGMEN / LIRIK
        header_frame.grid_columnconfigure(3, weight=0) # START (S)
        header_frame.grid_columnconfigure(4, weight=0) # END (S)
        header_frame.grid_columnconfigure(5, weight=0) # IN (S)
        header_frame.grid_columnconfigure(6, weight=0) # OUT (S)
        header_frame.grid_columnconfigure(7, weight=0) # DEL
        
        ctk.CTkLabel(header_frame, text="ID", font=ctk.CTkFont(size=10, weight="bold"), width=30).grid(row=0, column=0, padx=2)
        ctk.CTkLabel(header_frame, text="PUTAR", font=ctk.CTkFont(size=10, weight="bold"), width=45).grid(row=0, column=1, padx=2)
        ctk.CTkLabel(header_frame, text="TEKS SEGMEN / LIRIK", font=ctk.CTkFont(size=10, weight="bold"), anchor="w").grid(row=0, column=2, padx=2, sticky="ew")
        ctk.CTkLabel(header_frame, text="START (S)", font=ctk.CTkFont(size=10, weight="bold"), width=55).grid(row=0, column=3, padx=2)
        ctk.CTkLabel(header_frame, text="END (S)", font=ctk.CTkFont(size=10, weight="bold"), width=55).grid(row=0, column=4, padx=2)
        ctk.CTkLabel(header_frame, text="IN (S)", font=ctk.CTkFont(size=10, weight="bold"), width=45).grid(row=0, column=5, padx=2)
        ctk.CTkLabel(header_frame, text="OUT (S)", font=ctk.CTkFont(size=10, weight="bold"), width=45).grid(row=0, column=6, padx=2)
        ctk.CTkLabel(header_frame, text="DEL", font=ctk.CTkFont(size=10, weight="bold"), width=35).grid(row=0, column=7, padx=2)
        
        # Display each segment row
        for idx, seg in enumerate(self.segments):
            row_frame = ctk.CTkFrame(self.scroll_frame, fg_color="#18191d" if idx % 2 == 0 else "#202126")
            row_frame.pack(fill="x", pady=2, ipady=2)
            
            row_frame.grid_columnconfigure(0, weight=0) # ID
            row_frame.grid_columnconfigure(1, weight=0) # PUTAR
            row_frame.grid_columnconfigure(2, weight=1) # TEKS SEGMEN / LIRIK
            row_frame.grid_columnconfigure(3, weight=0) # START (S)
            row_frame.grid_columnconfigure(4, weight=0) # END (S)
            row_frame.grid_columnconfigure(5, weight=0) # IN (S)
            row_frame.grid_columnconfigure(6, weight=0) # OUT (S)
            row_frame.grid_columnconfigure(7, weight=0) # DEL
            
            # ID
            lbl_id = ctk.CTkLabel(row_frame, text=f"#{seg['id']:02d}", font=ctk.CTkFont(family="Courier", size=11, weight="bold"), width=30)
            lbl_id.grid(row=0, column=0, padx=2)
            
            # Play button
            btn_play_seg = ctk.CTkButton(row_frame, text="▶", width=35, height=22, fg_color="#1f538d", hover_color="#133c66", 
                                         command=lambda s=seg: self.play_segment_range(s["start"], s["end"]))
            btn_play_seg.grid(row=0, column=1, padx=2)
            
            # Text entry
            entry_text = ctk.CTkEntry(row_frame, height=22, border_width=1, border_color="#2a2b2f", fg_color="#0e0f11", text_color="#ffffff")
            entry_text.grid(row=0, column=2, padx=2, sticky="ew")
            entry_text.insert(0, seg.get("text", ""))
            
            # Start entry
            entry_start = ctk.CTkEntry(row_frame, width=55, height=22, border_width=1, border_color="#2a2b2f", fg_color="#0e0f11", text_color="#00ffff", font=("Courier", 10))
            entry_start.grid(row=0, column=3, padx=2)
            entry_start.insert(0, f"{seg['start']:.2f}")
            
            # End entry
            entry_end = ctk.CTkEntry(row_frame, width=55, height=22, border_width=1, border_color="#2a2b2f", fg_color="#0e0f11", text_color="#00ffff", font=("Courier", 10))
            entry_end.grid(row=0, column=4, padx=2)
            entry_end.insert(0, f"{seg['end']:.2f}")

            # Fade In entry
            entry_fade_in = ctk.CTkEntry(row_frame, width=45, height=22, border_width=1, border_color="#2a2b2f", fg_color="#0e0f11", text_color="#ffbb00", font=("Courier", 10))
            entry_fade_in.grid(row=0, column=5, padx=2)
            entry_fade_in.insert(0, f"{seg.get('fade_in', 0.0):.2f}")

            # Fade Out entry
            entry_fade_out = ctk.CTkEntry(row_frame, width=45, height=22, border_width=1, border_color="#2a2b2f", fg_color="#0e0f11", text_color="#ffbb00", font=("Courier", 10))
            entry_fade_out.grid(row=0, column=6, padx=2)
            entry_fade_out.insert(0, f"{seg.get('fade_out', 0.0):.2f}")
            
            # Delete button
            btn_del = ctk.CTkButton(row_frame, text="❌", width=30, height=22, fg_color="#d62728", hover_color="#ad1e1e",
                                    command=lambda i=idx: self.delete_segment(i))
            btn_del.grid(row=0, column=7, padx=2)
            
            # Store row widgets
            self.segment_rows.append({
                "index": idx,
                "segment_id": seg["id"],
                "entry_text": entry_text,
                "entry_start": entry_start,
                "entry_end": entry_end,
                "entry_fade_in": entry_fade_in,
                "entry_fade_out": entry_fade_out
            })
            
        self.lbl_segment_count.configure(text=f"{len(self.segments)} Segments")

    def play_segment_range(self, start, end):
        if not self.audio_file_path:
            return
        self.stop_audio_playback()
        self.add_log(f"Memutar segmen: {start:.2f}s - {end:.2f}s")
        
        pygame.mixer.music.play(start=start)
        self.playback_start_offset = start
        self.is_playing = True
        
        def monitor_range():
            while self.is_playing:
                time.sleep(0.02)
                try:
                    if not pygame.mixer.music.get_busy():
                        break
                    curr = self.playback_start_offset + (pygame.mixer.music.get_pos() / 1000.0)
                    if curr >= end:
                        pygame.mixer.music.stop()
                        self.is_playing = False
                        self.add_log("Selesai memutar segmen.")
                        break
                except:
                    break
        threading.Thread(target=monitor_range, daemon=True).start()

    def add_empty_segment(self):
        new_id = len(self.segments) + 1
        duration = self.audio_info.get("duration_sec", 10.0)
        start_t = self.segments[-1]["end"] if self.segments else 0.0
        end_t = min(duration, start_t + 2.0)
        
        self.segments.append({
            "id": new_id,
            "text": f"Segmen Baru #{new_id}",
            "start": round(start_t, 2),
            "end": round(end_t, 2),
            "fade_in": 0.0,
            "fade_out": 0.0,
            "confidence": 100,
            "filename": f"{new_id:02d}_segmen_baru"
        })
        self.refresh_segment_ui()
        self.add_log(f"Menambahkan segmen kosong #{new_id}")

    def delete_segment(self, index):
        if 0 <= index < len(self.segments):
            removed = self.segments.pop(index)
            # Reindex
            for i, s in enumerate(self.segments):
                s["id"] = i + 1
            self.refresh_segment_ui()
            self.add_log(f"Menghapus segmen ID #{removed['id']}")

    def save_edited_segments(self):
        updated_segs = []
        try:
            for row in self.segment_rows:
                text = row["entry_text"].get().strip()
                start = float(row["entry_start"].get().strip())
                end = float(row["entry_end"].get().strip())
                fade_in = float(row["entry_fade_in"].get().strip())
                fade_out = float(row["entry_fade_out"].get().strip())
                
                if start < 0 or end < 0:
                    raise ValueError("Waktu mulai/selesai tidak boleh negatif.")
                if start >= end:
                    raise ValueError("Waktu mulai harus lebih kecil dari waktu selesai.")
                if fade_in < 0 or fade_out < 0:
                    raise ValueError("Durasi fade tidak boleh negatif.")
                    
                updated_segs.append({
                    "id": row["segment_id"],
                    "text": text,
                    "start": start,
                    "end": end,
                    "fade_in": fade_in,
                    "fade_out": fade_out,
                    "confidence": 100,
                    "filename": f"{row['segment_id']:02d}_" + "".join(c for c in text.lower() if c.isalnum() or c==' ').strip().replace(' ', '_')[:15]
                })
            
            # Sort by start time
            updated_segs.sort(key=lambda x: x["start"])
            for i, s in enumerate(updated_segs):
                s["id"] = i + 1
                clean_txt = "".join(c for c in s["text"].lower() if c.isalnum() or c==' ').strip().replace(' ', '_')[:15]
                s["filename"] = f"{s['id']:02d}_{clean_txt}"
                
            self.segments = updated_segs
            self.refresh_segment_ui()
            self.add_log("Tabel segmen berhasil diperbarui, divalidasi, dan diurutkan.")
        except Exception as e:
            messagebox.showerror("Gagal Validasi", f"Data bermasalah: {str(e)}")

    # Features Algorithms
    def run_vad_analysis(self):
        if not self.audio_file_path:
            messagebox.showwarning("Peringatan", "Pilih berkas audio terlebih dahulu.")
            return
            
        min_silence_sec = float(self.slider_min_silence.get())
        min_silence_len = int(min_silence_sec * 1000)
        silence_thresh = int(self.slider_vad_sensitivity.get())
        
        self.add_log(f"Memulai Voice Activity Detection (VAD) dengan Min Silence: {min_silence_sec}s, Sensitivitas: {silence_thresh}dB...")
        
        def run():
            try:
                segs = AudioEngine.detect_silence_segments(self.audio_file_path, min_silence_len=min_silence_len, silence_thresh=silence_thresh)
                self.segments = segs
                self.refresh_segment_ui()
                self.add_log(f"VAD Selesai. Ditemukan {len(self.segments)} segmen suara aktif.")
            except Exception as e:
                messagebox.showerror("VAD Gagal", str(e))
        threading.Thread(target=run, daemon=True).start()

    def run_ai_alignment(self):
        if not self.audio_file_path:
            messagebox.showwarning("Peringatan", "Pilih audio terlebih dahulu.")
            return
            
        lyrics = self.text_lyrics.get("1.0", "end-1c").strip()
        if not lyrics or "[Paste lirik" in lyrics:
            messagebox.showwarning("Peringatan", "Isi teks / naskah lirik terlebih dahulu di panel kiri.")
            return
            
        self.add_log("Menyiapkan model kecerdasan buatan Whisper offline (ini memerlukan waktu pada proses awal)...")
        
        def run():
            try:
                if not self.ai_engine:
                    self.ai_engine = AIEngine(model_size="base")
                    
                self.add_log("Whisper Model terinisialisasi. Melakukan transkripsi audio...")
                trans_segs = self.ai_engine.transcribe_audio(self.audio_file_path)
                
                self.add_log("Transkripsi sukses. Menyelaraskan teks naskah menggunakan Fuzzy Matching...")
                aligned = AIEngine.align_text_fuzzy(lyrics, trans_segs)
                
                self.segments = aligned
                self.refresh_segment_ui()
                self.add_log(f"AI Align sukses! {len(self.segments)} segmen lirik tersinkronisasi sempurna.")
            except Exception as e:
                self.add_log(f"AI Align Gagal: {str(e)}")
                messagebox.showerror("AI Gagal", f"Gagal menyelaraskan audio dengan AI: {str(e)}")
        threading.Thread(target=run, daemon=True).start()

    def run_proportional_split(self):
        lyrics_text = self.text_lyrics.get("1.0", "end-1c").strip()
        lines = [l.strip() for l in lyrics_text.split("\\n") if l.strip()]
        if not lines or "[Paste lirik" in lyrics_text:
            messagebox.showwarning("Peringatan", "Masukkan teks / lirik lagu terlebih dahulu di panel kiri.")
            return
            
        duration = self.audio_info.get("duration_sec", 0.0)
        if duration <= 0:
            duration = 30.0 # default demo/fallback duration
            
        self.add_log(f"Membagi rata audio sepanjang {duration:.2f}s menjadi {len(lines)} potongan lirik...")
        
        seg_duration = duration / len(lines)
        distributed = []
        for idx, line in enumerate(lines):
            start = idx * seg_duration
            end = (idx + 1) * seg_duration
            clean_txt = "".join(c for c in line.lower() if c.isalnum() or c==' ').strip().replace(' ', '_')[:15]
            distributed.append({
                "id": idx + 1,
                "text": line,
                "start": round(start, 2),
                "end": round(end, 2),
                "confidence": 100,
                "filename": f"{idx+1:02d}_{clean_txt}"
            })
            
        self.segments = distributed
        self.refresh_segment_ui()
        self.add_log(f"Bagi rata sukses! Terbentuk {len(distributed)} segmen proporsional berurutan.")

    # Interactive Live Tapper Mode UI
    def open_live_tapper(self):
        if not self.audio_file_path:
            messagebox.showwarning("Peringatan", "Pilih berkas audio terlebih dahulu.")
            return
            
        lyrics_text = self.text_lyrics.get("1.0", "end-1c").strip()
        lines = [l.strip() for l in lyrics_text.split("\\n") if l.strip()]
        if not lines or "[Paste lirik" in lyrics_text:
            messagebox.showwarning("Peringatan", "Masukkan teks / lirik terlebih dahulu di panel kiri.")
            return
            
        # Buat Top Level Modal Window
        tapper_win = ctk.CTkToplevel(self)
        tapper_win.title("Interactive Live Tapper Sync")
        tapper_win.geometry("650x450")
        tapper_win.resizable(False, False)
        tapper_win.grab_set() # Modal block
        
        tapper_timestamps = [0.0] # Ketukan awal otomatis mulai di 0.0
        
        # Mulai putar audio dari awal
        self.stop_audio_playback()
        pygame.mixer.music.play(start=0.0)
        self.playback_start_offset = 0.0
        self.is_playing = True
        
        # UI Elements
        lbl_title = ctk.CTkLabel(tapper_win, text="LIVE TAPPER SYNC MODE", font=ctk.CTkFont(family="Courier", size=14, weight="bold"), text_color="#00ffff")
        lbl_title.pack(pady=15)
        
        card_frame = ctk.CTkFrame(tapper_win, fg_color="#0e0f11", border_width=1, border_color="#2b2b2b")
        card_frame.pack(fill="both", expand=True, padx=30, pady=10)
        
        lbl_prompt_title = ctk.CTkLabel(card_frame, text="SINKRONISASI AKTIF", font=ctk.CTkFont(size=10, weight="bold", family="Courier"), text_color="gray")
        lbl_prompt_title.pack(pady=(15, 5))
        
        lbl_active_lyric = ctk.CTkLabel(card_frame, text=lines[0], font=ctk.CTkFont(size=18, weight="bold"), text_color="#00ffff", wraplength=500)
        lbl_active_lyric.pack(pady=20, fill="x", expand=True)
        
        lbl_next_prompt = ctk.CTkLabel(card_frame, text="Baris Berikutnya:", font=ctk.CTkFont(size=10, weight="bold", family="Courier"), text_color="gray")
        lbl_next_prompt.pack()
        
        next_lyric_text = lines[1] if len(lines) > 1 else "[TERAKHIR - SELESAI]"
        lbl_next_lyric = ctk.CTkLabel(card_frame, text=next_lyric_text, font=ctk.CTkFont(size=12, slant="italic"), text_color="gray", wraplength=500)
        lbl_next_lyric.pack(pady=(5, 15))
        
        lbl_status = ctk.CTkLabel(tapper_win, text=f"Ketukan: 1 / {len(lines) + 1}", font=ctk.CTkFont(family="Courier", size=11))
        lbl_status.pack(pady=5)
        lbl_instruction = ctk.CTkLabel(tapper_win, text="[SPASI / ENTER / ➔ / ⬇] untuk TAP (Selesai Baris)  |  [BACKSPACE / ⬅ / ⬆] untuk BATAL/UNDO", font=ctk.CTkFont(size=10, weight="bold"), text_color="#00ffff")
        lbl_instruction.pack()
        
        btn_tap = ctk.CTkButton(tapper_win, text="TAP / SPASI (Selesai Baris)", height=55, fg_color="#2ca02c", hover_color="#1e731e", font=ctk.CTkFont(size=14, weight="bold"), text_color="#000000", takefocus=False)
        btn_tap.pack(fill="x", padx=30, pady=(15, 20))
        
        last_tap_time = [0.0]
        
        def record_tap(event=None):
            import time
            now = time.time()
            if now - last_tap_time[0] < 0.2:
                return "break"
            last_tap_time[0] = now
            
            if not pygame.mixer.music.get_busy():
                return "break"
                
            curr_pos = self.playback_start_offset + (pygame.mixer.music.get_pos() / 1000.0)
            comp_offset = float(self.slider_compensation.get())
            adjusted_pos = max(0.0, curr_pos + comp_offset)
            
            tapper_timestamps.append(adjusted_pos)
            active_idx = len(tapper_timestamps) - 1
            
            self.add_log(f"Tapper Live: Baris {active_idx} selesai di {adjusted_pos:.2f}s")
            
            if active_idx >= len(lines):
                pygame.mixer.music.stop()
                self.is_playing = False
                
                # Build segments
                compiled = []
                for i in range(len(lines)):
                    start_t = tapper_timestamps[i]
                    end_t = tapper_timestamps[i+1]
                    clean_txt = "".join(c for c in lines[i].lower() if c.isalnum() or c==' ').strip().replace(' ', '_')[:15]
                    compiled.append({
                        "id": i + 1,
                        "text": lines[i],
                        "start": round(start_t, 2),
                        "end": round(end_t, 2),
                        "confidence": 100,
                        "filename": f"{i+1:02d}_{clean_txt}"
                    })
                
                self.segments = compiled
                self.refresh_segment_ui()
                self.add_log(f"Live Tapper Sync Sukses! {len(compiled)} segmen naskah terbentuk.")
                tapper_win.destroy()
                return "break"
                
            # Update labels
            lbl_active_lyric.configure(text=lines[active_idx])
            next_txt = lines[active_idx + 1] if active_idx + 1 < len(lines) else "[KETUK SEKALI LAGI UNTUK SELESAI]"
            lbl_next_lyric.configure(text=next_txt)
            lbl_status.configure(text=f"Ketukan: {len(tapper_timestamps)} / {len(lines) + 1}")
            return "break"
            
        def handle_backspace(event=None):
            if len(tapper_timestamps) <= 1:
                return "break"
            tapper_timestamps.pop()
            active_idx = len(tapper_timestamps) - 1
            
            lbl_active_lyric.configure(text=lines[active_idx])
            next_txt = lines[active_idx + 1] if active_idx + 1 < len(lines) else "[KETUK SEKALI LAGI UNTUK SELESAI]"
            lbl_next_lyric.configure(text=next_txt)
            lbl_status.configure(text=f"Ketukan: {len(tapper_timestamps)} / {len(lines) + 1}")
            self.add_log("Batalkan ketukan terakhir (Tap Back) di tapper.")
            return "break"
            
        def on_key_press(event):
            if event.keysym in ("space", "Return", "Right", "Down"):
                record_tap(event)
                return "break"
            elif event.keysym in ("BackSpace", "Left", "Up"):
                handle_backspace(event)
                return "break"
 
        # Bindings & Focus capture
        tapper_win.bind("<KeyPress>", on_key_press)
        tapper_win.bind("<space>", lambda e: record_tap(e))
        tapper_win.bind("<Return>", lambda e: record_tap(e))
        tapper_win.bind("<Right>", lambda e: record_tap(e))
        tapper_win.bind("<Down>", lambda e: record_tap(e))
        tapper_win.bind("<BackSpace>", lambda e: handle_backspace(e))
        tapper_win.bind("<Left>", lambda e: handle_backspace(e))
        tapper_win.bind("<Up>", lambda e: handle_backspace(e))
        btn_tap.configure(command=record_tap)
        
        # Force grab focus immediately and on delay
        tapper_win.lift()
        tapper_win.focus_set()
        tapper_win.focus_force()
        tapper_win.after(100, lambda: tapper_win.focus_force())
        
        def on_close():
            pygame.mixer.music.stop()
            self.is_playing = False
            tapper_win.destroy()
            
        tapper_win.protocol("WM_DELETE_WINDOW", on_close)

    # Export Segment Slices
    def export_segments(self):
        if not self.audio_file_path or not self.segments:
            messagebox.showwarning("Peringatan", "Data segmen kosong atau file audio belum terpilih.")
            return
            
        output_dir = self.entry_output_dir.get().strip()
        out_fmt = self.format_menu.get()
        out_qual = self.bitrate_menu.get()
        
        self.add_log(f"Memulai slicing lossless ke folder: {output_dir}...")
        
        def run():
            try:
                for s in self.segments:
                    clean_txt = "".join(c for c in s.get("text", "seg") if c.isalnum() or c==' ').strip()
                    clean_txt = clean_txt.replace(" ", "_")[:15]
                    s["filename"] = f"{s.get('id', 1):02d}_{clean_txt}"
                    
                exported = AudioEngine.slice_and_save(
                    self.audio_file_path, self.segments, output_dir, output_format=out_fmt, quality=out_qual
                )
                self.add_log(f"Pemotongan selesai! Berhasil mengekspor {len(exported)} file audio beserta berkas subtitles.srt & lyrics_synced.lrc ke: {output_dir}")
                messagebox.showinfo("Sukses", f"Berhasil mengekspor {len(exported)} file audio dan berkas pendukung ke {output_dir}")
            except Exception as e:
                self.add_log(f"Ekspor Gagal: {str(e)}")
                messagebox.showerror("Error", str(e))
                
        threading.Thread(target=run, daemon=True).start()

    def export_srt_file(self):
        if not self.segments:
            messagebox.showwarning("Peringatan", "Belum ada data segmen untuk diekspor.")
            return
            
        file_path = filedialog.asksaveasfilename(
            defaultextension=".srt",
            filetypes=[("Subtitle Files", "*.srt")],
            initialfile="subtitles.srt"
        )
        if file_path:
            try:
                srt_content = AudioEngine.generate_srt(self.segments)
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(srt_content)
                self.add_log(f"Sukses mengekspor subtitles ke: {file_path}")
                messagebox.showinfo("Sukses", f"Berkas subtitle (.srt) berhasil diekspor!")
            except Exception as e:
                messagebox.showerror("Error", f"Gagal mengekspor berkas: {str(e)}")

if __name__ == "__main__":
    app = AudioSlicerApp()
    app.mainloop()
`
};
