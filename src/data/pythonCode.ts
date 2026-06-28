export const PYTHON_PROJECT_FILES = {
  "requirements.txt": `customtkinter>=5.2.0
pydub>=0.25.1
faster-whisper>=1.0.0
numpy>=1.20.0
soundfile>=0.12.0
pyinstaller>=6.0.0
`,

  "setup_instructions.md": `# Panduan Instalasi & Build - Audio Slicer Pro (Python Desktop Companion)

Companion Desktop ini dirancang sebagai aplikasi desktop kelas produksi menggunakan **CustomTkinter** untuk UI modern gelap, **PyDub** untuk pemrosesan audio lossless, dan **Faster-Whisper** untuk transkripsi & sinkronisasi AI berkecepatan tinggi secara offline.

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
- \`main.py\`: Mengelola UI Desktop premium, manajemen status, log, dan interaksi pengguna.
- \`audio_engine.py\`: Algoritma pendeteksi jeda sunyi (silence detection) dan pemrosesan audio (slicing) berpresisi tinggi.
- \`ai_engine.py\`: Integrasi model Whisper untuk transkripsi audio offline dan modul penyelarasan teks berbasis fuzzy matching.
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
            # detect_nonsilent mengembalikan list [start_ms, end_ms]
            ranges_ms = detect_nonsilent(audio, min_silence_len=min_silence_len, silence_thresh=silence_thresh)
            
            segments = []
            for i, r in enumerate(ranges_ms):
                segments.append({
                    "id": i + 1,
                    "start": r[0] / 1000.0,
                    "end": r[1] / 1000.0,
                    "duration": (r[1] - r[0]) / 1000.0
                })
            return segments
        except Exception as e:
            raise Exception(f"Gagal melakukan deteksi keheningan (VAD): {str(e)}")

    @staticmethod
    def slice_and_save(file_path, segments, output_dir, output_format="MP3", quality="192k"):
        """Memotong file audio menjadi segmen terpisah secara lossless/high quality."""
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        audio = AudioSegment.from_file(file_path)
        exported_files = []
        
        for seg in segments:
            start_ms = int(seg["start"] * 1000)
            end_ms = int(seg["end"] * 1000)
            
            # Slicing
            cut_audio = audio[start_ms:end_ms]
            
            # Buat nama file aman
            raw_name = seg.get("filename", f"segment_{seg['id']}")
            safe_name = "".join(c for c in raw_name if c.isalnum() or c in (' ', '_', '-')).rstrip()
            if not safe_name:
                safe_name = f"segment_{seg['id']}"
                
            out_file_name = f"{safe_name}.{output_format.lower()}"
            out_path = os.path.join(output_dir, out_file_name)
            
            # Ekspor dengan bitrate pilihan
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
        # Menghapus karakter baca dan normalisasi teks untuk pencocokan handal
        def clean_text(t):
            return re.sub(r'[^\\w\\s]', '', t.lower()).strip()

        lyric_lines = [line.strip() for line in lyrics.split('\\n') if line.strip()]
        aligned = []
        
        trans_idx = 0
        total_trans = len(transcribed_segments)
        
        for l_idx, line in enumerate(lyric_lines):
            clean_line = clean_text(line)
            
            # Cari segmen audio yang paling cocok secara sequential
            best_match_idx = trans_idx
            best_score = 0
            
            # Kita look ahead 5 segmen untuk ketahanan
            for search_idx in range(trans_idx, min(trans_idx + 5, total_trans)):
                seg_text = clean_text(transcribed_segments[search_idx]["text"])
                # Kalkulasi rasio sederhana overlap kata
                line_words = set(clean_line.split())
                seg_words = set(seg_text.split())
                
                if not line_words:
                    continue
                overlap = len(line_words.intersection(seg_words))
                score = overlap / len(line_words)
                
                if score > best_score:
                    best_score = score
                    best_match_idx = search_idx
            
            # Ambil timing dari segmen yang paling cocok
            if best_score > 0.1 and best_match_idx < total_trans:
                matched_seg = transcribed_segments[best_match_idx]
                aligned.append({
                    "id": l_idx + 1,
                    "text": line,
                    "start": matched_seg["start"],
                    "end": matched_seg["end"],
                    "confidence": round(best_score * 100, 1)
                })
                trans_idx = best_match_idx + 1
            else:
                # Jika tidak cocok, lakukan estimasi waktu interpolasi linear
                prev_end = aligned[-1]["end"] if aligned else 0.0
                estimated_start = prev_end + 0.5
                estimated_end = estimated_start + (len(line.split()) * 0.4) # estimasi 0.4 detik per kata
                
                aligned.append({
                    "id": l_idx + 1,
                    "text": line,
                    "start": estimated_start,
                    "end": estimated_end,
                    "confidence": 0.0 # Estimasi kasar
                })
                
        return aligned
`,

  "main.py": `import os
import threading
import tkinter as tk
from tkinter import filedialog, messagebox
import customtkinter as ctk
from audio_engine import AudioEngine
from ai_engine import AIEngine

# Set tema CustomTkinter
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class AudioSlicerApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("Audio Slicer & AI Lyrics Synchronizer Pro")
        self.geometry("1100x700")
        self.minsize(950, 600)
        
        # Inisialisasi variabel status
        self.audio_file_path = None
        self.audio_info = {}
        self.segments = []
        self.ai_engine = None
        
        # Bangun Layout UI
        self.setup_ui()
        self.add_log("Aplikasi berhasil dijalankan. Siap mengimpor audio.")

    def setup_ui(self):
        # Grid utama 1 Baris x 2 Kolom (Sidebar + Konten Utama)
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)
        
        # --- SIDEBAR PANEL ---
        self.sidebar_frame = ctk.CTkFrame(self, width=280, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)
        self.sidebar_frame.grid_rowconfigure(6, weight=1)
        
        self.title_label = ctk.CTkLabel(self.sidebar_frame, text="Audio Slicer AI Pro", font=ctk.CTkFont(size=20, weight="bold"))
        self.title_label.grid(row=0, column=0, padx=20, pady=(20, 10))
        
        # Info Panel
        self.info_card = ctk.CTkFrame(self.sidebar_frame, fg_color="transparent")
        self.info_card.grid(row=1, column=0, padx=15, pady=10, sticky="ew")
        
        self.info_title = ctk.CTkLabel(self.info_card, text="File Informasi", font=ctk.CTkFont(size=14, weight="bold"))
        self.info_title.pack(anchor="w", padx=5, pady=2)
        
        self.info_text = tk.Text(self.info_card, height=10, bg="#2b2b2b", fg="#e0e0e0", bd=0, font=("Helvetica", 10), padx=5, pady=5)
        self.info_text.pack(fill="x", padx=5, pady=5)
        self.info_text.insert("1.0", "Belum ada file audio terpilih.")
        self.info_text.config(state="disabled")
        
        # Ekspor Konfigurasi
        self.export_title = ctk.CTkLabel(self.sidebar_frame, text="Format Output", font=ctk.CTkFont(size=14, weight="bold"))
        self.export_title.grid(row=2, column=0, padx=20, pady=(15, 5), sticky="w")
        
        self.format_menu = ctk.CTkOptionMenu(self.sidebar_frame, values=["MP3", "WAV", "FLAC", "OGG", "M4A"])
        self.format_menu.grid(row=3, column=0, padx=20, pady=5, sticky="ew")
        self.format_menu.set("MP3")
        
        self.bitrate_menu = ctk.CTkOptionMenu(self.sidebar_frame, values=["128k", "192k", "256k", "320k"])
        self.bitrate_menu.grid(row=4, column=0, padx=20, pady=5, sticky="ew")
        self.bitrate_menu.set("192k")
        
        # --- KONTEN UTAMA ---
        self.main_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.main_frame.grid(row=0, column=1, sticky="nsew", padx=15, pady=15)
        self.main_frame.grid_rowconfigure(1, weight=1)
        self.main_frame.grid_columnconfigure(0, weight=1)
        
        # Panel Atas: Tombol Input Audio & VAD
        self.top_buttons = ctk.CTkFrame(self.main_frame)
        self.top_buttons.grid(row=0, column=0, sticky="ew", padx=10, pady=5)
        
        self.btn_select_audio = ctk.CTkButton(self.top_buttons, text="Pilih File Audio", command=self.select_audio_file, fg_color="#1f538d", hover_color="#133c66")
        self.btn_select_audio.pack(side="left", padx=10, pady=10)
        
        self.btn_run_vad = ctk.CTkButton(self.top_buttons, text="Analisis Jeda Sunyi (VAD)", command=self.run_vad_analysis)
        self.btn_run_vad.pack(side="left", padx=10, pady=10)
        
        self.btn_ai_align = ctk.CTkButton(self.top_buttons, text="AI Sinkronisasi Teks", fg_color="#2ca02c", hover_color="#1e731e", command=self.run_ai_alignment)
        self.btn_ai_align.pack(side="left", padx=10, pady=10)
        
        # Panel Tengah: Pembagi Editor Teks & Tabel Segmen (Left/Right)
        self.editor_split = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        self.editor_split.grid(row=1, column=0, sticky="nsew", padx=5, pady=5)
        self.editor_split.grid_rowconfigure(0, weight=1)
        self.editor_split.grid_columnconfigure(0, weight=1) # Panel Teks
        self.editor_split.grid_columnconfigure(1, weight=2) # Panel Segmen
        
        # Kiri: Input Teks / Lirik
        self.text_panel = ctk.CTkFrame(self.editor_split)
        self.text_panel.grid(row=0, column=0, sticky="nsew", padx=5, pady=5)
        
        self.text_label = ctk.CTkLabel(self.text_panel, text="Masukkan Teks / Lirik Lagu", font=ctk.CTkFont(weight="bold"))
        self.text_label.pack(anchor="w", padx=10, pady=5)
        
        self.text_lyrics = tk.Text(self.text_panel, bg="#202020", fg="#ffffff", bd=0, font=("Courier", 11), padx=8, pady=8)
        self.text_lyrics.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.text_lyrics.insert("1.0", "[Paste lirik lagu atau skrip dialog di sini,\\nsatu kalimat per baris]")
        
        # Kanan: Hasil Segmentasi & Preview
        self.segment_panel = ctk.CTkFrame(self.editor_split)
        self.segment_panel.grid(row=0, column=1, sticky="nsew", padx=5, pady=5)
        
        self.seg_header = ctk.CTkLabel(self.segment_panel, text="Tabel Hasil Segmen Audio (Dapat Diedit)", font=ctk.CTkFont(weight="bold"))
        self.seg_header.pack(anchor="w", padx=10, pady=5)
        
        # Tabel Segmen sederhana menggunakan listbox / textbox yang dapat diedit
        self.seg_textbox = tk.Text(self.segment_panel, bg="#1a1a1a", fg="#ffffff", bd=0, font=("Courier", 10), padx=8, pady=8)
        self.seg_textbox.pack(fill="both", expand=True, padx=10, pady=5)
        self.seg_textbox.insert("1.0", "No | Teks Segmen | Mulai (s) | Selesai (s) | Nama Output\\n" + "-"*70 + "\\nBelum ada data segmen. Lakukan Analisis atau Sinkronisasi.")
        
        # Panel Bawah: Lokasi Simpan, Ekspor & Progress
        self.bottom_panel = ctk.CTkFrame(self.main_frame)
        self.bottom_panel.grid(row=2, column=0, sticky="ew", padx=10, pady=10)
        
        self.lbl_save_to = ctk.CTkLabel(self.bottom_panel, text="Folder Output:")
        self.lbl_save_to.pack(side="left", padx=10, pady=10)
        
        self.entry_output_dir = ctk.CTkEntry(self.bottom_panel, width=350)
        self.entry_output_dir.pack(side="left", padx=5, pady=10)
        self.entry_output_dir.insert(0, os.path.join(os.path.expanduser("~"), "Music", "AcousticSplit"))
        
        self.btn_browse = ctk.CTkButton(self.bottom_panel, text="Browse", width=80, command=self.browse_output_dir)
        self.btn_browse.pack(side="left", padx=5, pady=10)
        
        self.btn_export = ctk.CTkButton(self.bottom_panel, text="Ekspor Segmen", fg_color="#d62728", hover_color="#ad1e1e", command=self.export_segments)
        self.btn_export.pack(side="right", padx=10, pady=10)
        
        # Panel Log Terbawah
        self.log_frame = ctk.CTkFrame(self)
        self.log_frame.grid(row=1, column=0, columnspan=2, sticky="ew", padx=15, pady=(0, 15))
        
        self.log_text = tk.Text(self.log_frame, height=4, bg="#141414", fg="#00ff00", bd=0, font=("Courier", 9), padx=5, pady=5)
        self.log_text.pack(fill="x", expand=True)

    def add_log(self, msg):
        self.log_text.config(state="normal")
        self.log_text.insert("end", f"[LOG] {msg}\\n")
        self.log_text.see("end")
        self.log_text.config(state="disabled")

    def select_audio_file(self):
        file_path = filedialog.askopenfilename(
            filetypes=[("Audio Files", "*.mp3 *.wav *.flac *.ogg *.m4a *.aac *.opus *.aiff *.wma")]
        )
        if file_path:
            self.audio_file_path = file_path
            self.add_log(f"Memilih file audio: {file_path}")
            
            # Tampilkan Loading di thread terpisah agar UI tidak hang
            threading.Thread(target=self._load_audio_details, args=(file_path,), daemon=True).start()

    def _load_audio_details(self, path):
        try:
            self.audio_info = AudioEngine.get_audio_info(path)
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
            self.add_log("Informasi audio berhasil dimuat.")
        except Exception as e:
            messagebox.showerror("Error", f"Gagal membaca audio: {str(e)}")

    def run_vad_analysis(self):
        if not self.audio_file_path:
            messagebox.showwarning("Peringatan", "Silakan pilih file audio terlebih dahulu.")
            return
        
        self.add_log("Menjalankan Voice Activity Detection (VAD) sunyi...")
        
        def run():
            try:
                self.segments = AudioEngine.detect_silence_segments(self.audio_file_path)
                self.update_segment_table()
                self.add_log(f"VAD Selesai. Terdeteksi {len(self.segments)} bagian audio aktif.")
            except Exception as e:
                messagebox.showerror("Error", str(e))
                
        threading.Thread(target=run, daemon=True).start()

    def run_ai_alignment(self):
        if not self.audio_file_path:
            messagebox.showwarning("Peringatan", "Pilih audio terlebih dahulu.")
            return
            
        lyrics = self.text_lyrics.get("1.0", "end-1c").strip()
        if not lyrics or "[Paste lirik" in lyrics:
            messagebox.showwarning("Peringatan", "Isi teks / lirik lagu terlebih dahulu.")
            return
            
        self.add_log("Memulai Sinkronisasi AI Offline (Menggunakan Whisper)...")
        
        def run():
            try:
                if not self.ai_engine:
                    self.add_log("Menginisialisasi model kecerdasan buatan Whisper (ini memerlukan beberapa waktu pada jalankan pertama)...")
                    self.ai_engine = AIEngine(model_size="base")
                
                self.add_log("Whisper Model Siap. Melakukan transkripsi audio...")
                trans_segs = self.ai_engine.transcribe_audio(self.audio_file_path)
                
                self.add_log("Transkripsi Berhasil. Melakukan fuzzy matching penyelarasan dengan teks lirik...")
                aligned = AIEngine.align_text_fuzzy(lyrics, trans_segs)
                
                self.segments = aligned
                self.update_segment_table()
                self.add_log(f"Sinkronisasi AI Sukses! Terbentuk {len(self.segments)} segmen sinkron.")
            except Exception as e:
                self.add_log(f"AI Gagal: {str(e)}")
                messagebox.showerror("Error", f"AI Sinkronisasi gagal: {str(e)}")
                
        threading.Thread(target=run, daemon=True).start()

    def update_segment_table(self):
        self.seg_textbox.delete("1.0", "end")
        header = f"{'No':<4} | {'Teks Segmen':<30} | {'Mulai (s)':<9} | {'Selesai (s)':<11} | {'Nama Output':<20}\\n"
        divider = "-" * 85 + "\\n"
        self.seg_textbox.insert("end", header + divider)
        
        for s in self.segments:
            line_str = (
                f"{s.get('id', s.get('id', 1)):<4} | "
                f"{(s.get('text', 'Tanpa Teks')[:28]):<30} | "
                f"{round(s['start'], 2):<9} | "
                f"{round(s['end'], 2):<11} | "
                f"{s.get('filename', f'potongan_{s.get(\"id\", 1)}'):<20}\\n"
            )
            self.seg_textbox.insert("end", line_str)

    def browse_output_dir(self):
        folder = filedialog.askdirectory()
        if folder:
            self.entry_output_dir.delete(0, "end")
            self.entry_output_dir.insert(0, folder)

    def export_segments(self):
        if not self.audio_file_path or not self.segments:
            messagebox.showwarning("Peringatan", "Data segmen belum terbentuk atau audio belum dipilih.")
            return
            
        output_dir = self.entry_output_dir.get().strip()
        out_fmt = self.format_menu.get()
        out_qual = self.bitrate_menu.get()
        
        self.add_log(f"Memulai proses pemotongan lossless ke folder: {output_dir}")
        
        def run():
            try:
                # Menambahkan nama file otomatis ke segmen
                for s in self.segments:
                    clean_txt = "".join(c for c in s.get("text", "seg") if c.isalnum() or c==' ').strip()
                    clean_txt = clean_txt.replace(" ", "_")[:15]
                    s["filename"] = f"{s.get('id', 1):02d}_{clean_txt}"
                    
                exported = AudioEngine.slice_and_save(
                    self.audio_file_path, self.segments, output_dir, output_format=out_fmt, quality=out_qual
                )
                self.add_log(f"Pemotongan Selesai! Berhasil mengekspor {len(exported)} file.")
                messagebox.showinfo("Sukses", f"Berhasil mengekspor {len(exported)} file audio ke {output_dir}")
            except Exception as e:
                self.add_log(f"Ekspor Gagal: {str(e)}")
                messagebox.showerror("Error", str(e))
                
        threading.Thread(target=run, daemon=True).start()

if __name__ == "__main__":
    app = AudioSlicerApp()
    app.mainloop()
`
};
