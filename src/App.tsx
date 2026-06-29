import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Play,
  Pause,
  Square,
  Sliders,
  FolderOpen,
  FileCode,
  Trash2,
  Edit3,
  Plus,
  Merge,
  CheckCircle,
  Settings,
  Activity,
  FileText,
  ChevronRight,
  Copy,
  Save,
  Download,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Scissors,
  MapPin,
  Clock,
  Music,
  SkipBack,
  Volume2,
  ArrowLeft,
  RotateCcw
} from 'lucide-react';
import WaveformView from './components/WaveformView';
import PythonCompanion from './components/PythonCompanion';
import { AudioSegment, AudioMetadata, ActivityLog } from './types';
import { encodeWav, encodeMp3, encodeOgg, encodeFlac, encodeAac } from './utils/audioEncoder';

// Standard Balonku default text
const DEFAULT_LYRICS = `Balonku ada lima
Rupa-rupa warnanya
Hijau, kuning, kelabu
Merah muda dan biru
Meletus balon hijau.. DOR!
Sangat kacau hatiku
Balonku tinggal empat
Kupegang erat-erat`;

export default function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioMetadata, setAudioMetadata] = useState<AudioMetadata | null>(null);
  const [isDemo, setIsDemo] = useState<boolean>(true); // Starts with Demo mode for instantaneous previewing!

  const [lyricsText, setLyricsText] = useState<string>(DEFAULT_LYRICS);
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Live Tapper Sync States
  const [isTappingMode, setIsTappingMode] = useState<boolean>(false);
  const [tappingLyrics, setTappingLyrics] = useState<string[]>([]);
  const [tappedTimestamps, setTappedTimestamps] = useState<number[]>([]);
  const [isAutoTapping, setIsAutoTapping] = useState<boolean>(false);
  const [autoTapTimestamps, setAutoTapTimestamps] = useState<number[]>([]);
  const [autoTapMethod, setAutoTapMethod] = useState<'vad' | 'proportional' | 'ai'>('vad');
  const [isAligningAI, setIsAligningAI] = useState<boolean>(false);

  // VAD / silence settings
  const [silenceThreshold, setSilenceThreshold] = useState<number>(-40);
  const [minSilenceDuration, setMinSilenceDuration] = useState<number>(0.5);

  // Audio Playback
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [playingSource, setPlayingSource] = useState<AudioBufferSourceNode | null>(null);
  const [playingSegmentId, setPlayingSegmentId] = useState<number | null>(null);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState<boolean>(false);
  const [latencyOffset, setLatencyOffset] = useState<number>(0.05); // 50ms default calibration compensation offset
  const playheadIntervalRef = useRef<any>(null);

  // Export properties
  const [autoNumbering, setAutoNumbering] = useState<boolean>(false);
  const [removeSpecialChars, setRemoveSpecialChars] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<string>('WAV');
  const [mp3Bitrate, setMp3Bitrate] = useState<number>(192);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportStatus, setExportStatus] = useState<string>('');

  // Bulk Rename States
  const [showBulkRenameModal, setShowBulkRenameModal] = useState<boolean>(false);
  const [bulkRenameText, setBulkRenameText] = useState<string>('');

  // Logging
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Add initial log
  useEffect(() => {
    addLog('Application ready. Load your own audio or explore with default Demo Mode!', 'success');
    // Load pre-made demo segments for the default Indonesian lyrics
    loadDemoSegments();
  }, []);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, type, message }, ...prev].slice(0, 50));
  };

  const loadDemoSegments = () => {
    const lines = DEFAULT_LYRICS.split('\n').filter(l => l.trim());
    const demoSecs = [
      { start: 1.2, end: 3.8 },
      { start: 4.5, end: 7.2 },
      { start: 8.0, end: 10.9 },
      { start: 11.5, end: 14.1 },
      { start: 14.8, end: 18.2 },
      { start: 19.0, end: 21.8 },
      { start: 22.5, end: 25.1 },
      { start: 25.8, end: 29.5 },
    ];

    const demoSegs: AudioSegment[] = lines.map((line, idx) => {
      const timing = demoSecs[idx] || { start: idx * 3.5, end: (idx + 1) * 3.2 };
      return {
        id: idx + 1,
        text: line,
        start: timing.start,
        end: timing.end,
        confidence: 94 + (idx % 5),
        filename: `${(idx + 1).toString().padStart(2, '0')}_${line.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15)}`
      };
    });

    setSegments(demoSegs);
    setAudioMetadata({
      name: "demo_balonku_audio.mp3",
      size: "2.4 MB",
      format: "MP3",
      duration: 30.0,
      sampleRate: 44100,
      channels: 2,
      bitrate: "192 kbps"
    });
    addLog('Preloaded demo audio track and Indonesian lyrics sync state!', 'info');
  };

  // Bulk Rename Application Handler
  const handleBulkRename = () => {
    const lines = bulkRenameText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) {
      alert('Masukkan atau paste nama-nama file terlebih dahulu!');
      return;
    }

    setSegments(prev => prev.map((seg, idx) => {
      if (idx < lines.length) {
        let name = lines[idx];
        
        // Strip out extensions if user accidentally included them (e.g., .wav, .mp3)
        name = name.replace(/\.(wav|mp3|ogg|flac|aac|m4a)$/i, '');

        // Sanitize name only if option is active
        if (removeSpecialChars) {
          name = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        }
        
        // Prepend auto numbering if active
        if (autoNumbering) {
          const prefix = (seg.id).toString().padStart(2, '0') + '_';
          if (!name.startsWith(prefix)) {
            name = prefix + name.replace(/^\d+_/i, '');
          }
        }
        
        return {
          ...seg,
          filename: name
        };
      }
      return seg;
    }));

    addLog(`Menerapkan ${Math.min(lines.length, segments.length)} nama file kustom secara massal!`, 'success');
    setShowBulkRenameModal(false);
    setBulkRenameText('');
  };

  // Teleprompter Auto-Scroll Effect in Live Tapping Mode
  useEffect(() => {
    if (isTappingMode && tappingLyrics.length > 0) {
      const activeIdx = Math.min(tappedTimestamps.length, tappingLyrics.length - 1);
      const el = document.getElementById(`teleprompter-line-${activeIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [tappedTimestamps.length, isTappingMode, tappingLyrics.length]);

  // Drag and drop audio selection
  const handleAudioDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadAudioFile(e.dataTransfer.files[0]);
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadAudioFile(e.target.files[0]);
    }
  };

  const loadAudioFile = async (file: File) => {
    stopCurrentPlayback();
    addLog(`Loading audio file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`, 'info');

    // Read properties
    const ext = file.name.substring(file.name.lastIndexOf('.') + 1).toUpperCase();
    const sizeStr = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    setAudioFile(file);
    setIsDemo(false);
    setSegments([]);

    try {
      // Decode audio
      const ctx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioCtx) setAudioCtx(ctx);

      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);

      const metadata: AudioMetadata = {
        name: file.name,
        size: sizeStr,
        format: ext,
        duration: decodedBuffer.duration,
        sampleRate: decodedBuffer.sampleRate,
        channels: decodedBuffer.numberOfChannels,
        bitrate: `${Math.round((file.size * 8) / decodedBuffer.duration / 1000)} kbps`
      };

      setAudioMetadata(metadata);
      addLog(`Audio successfully decoded: ${metadata.channels} channels, ${metadata.sampleRate}Hz, duration ${metadata.duration.toFixed(2)}s.`, 'success');
      
      // Automatically perform silence-based VAD upon loading to populate visual boundaries!
      runLocalVAD(decodedBuffer);
    } catch (error: any) {
      addLog(`Failed to decode audio: ${error.message || error}`, 'error');
      alert(`Format audio tidak didukung oleh browser ini atau file rusak. Silakan coba format WAV atau MP3 standar.`);
    }
  };

  // Silence activity detection
  const runLocalVAD = (buffer: AudioBuffer): AudioSegment[] => {
    addLog('Analyzing audio vocal peaks and silence spaces (VAD)...', 'info');
    
    // Sub-sample RMS threshold
    const sampleRate = buffer.sampleRate;
    const channelData = buffer.getChannelData(0);
    const duration = buffer.duration;
    
    const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
    const thresholdAmp = Math.pow(10, silenceThreshold / 20);
    
    let isSpeech = false;
    let speechStart = 0;
    let silenceStart = -1;
    const rawSegments: Array<{ start: number; end: number }> = [];
    
    for (let offset = 0; offset < channelData.length; offset += frameSize) {
      const endOffset = Math.min(offset + frameSize, channelData.length);
      let sumSquares = 0;
      for (let i = offset; i < endOffset; i++) {
        sumSquares += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sumSquares / (endOffset - offset));
      const time = offset / sampleRate;
      
      if (rms > thresholdAmp) {
        if (!isSpeech) {
          isSpeech = true;
          speechStart = time;
        }
        silenceStart = -1;
      } else {
        if (isSpeech) {
          if (silenceStart === -1) {
            silenceStart = time;
          } else if (time - silenceStart >= minSilenceDuration) {
            isSpeech = false;
            rawSegments.push({ start: speechStart, end: silenceStart });
          }
        }
      }
    }
    
    if (isSpeech) {
      rawSegments.push({ start: speechStart, end: duration });
    }
    
    // Clean up short segments
    const filtered = rawSegments
      .filter(seg => (seg.end - seg.start) >= 0.2)
      .map((seg, idx) => ({
        id: idx + 1,
        text: `VAD Segment #${idx + 1}`,
        start: parseFloat(seg.start.toFixed(2)),
        end: parseFloat(seg.end.toFixed(2)),
        filename: `cut_segment_${idx + 1}`
      }));
      
    setSegments(filtered);
    addLog(`VAD Selesai. Terdeteksi ${filtered.length} interval audio suara aktif.`, 'success');
    return filtered;
  };

  const handleManualVADTrigger = () => {
    if (isDemo) {
      addLog('Running VAD analysis on Demo data...', 'info');
      loadDemoSegments();
      return;
    }
    if (!audioBuffer) {
      alert('Unggah file audio terlebih dahulu atau gunakan Demo Mode.');
      return;
    }
    runLocalVAD(audioBuffer);
  };

  // Paste / File text loaders
  const handleTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setLyricsText(evt.target.result as string);
          addLog(`Loaded lyrics file: ${file.name}`, 'info');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSrtFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          const rawText = evt.target.result as string;
          try {
            const parsedSegs = parseSrtContent(rawText);
            if (parsedSegs.length === 0) {
              alert('Tidak dapat mengurai segmen dari berkas .srt ini. Pastikan format berkas .srt valid.');
              return;
            }
            
            setSegments(parsedSegs);
            
            const plainTexts = parsedSegs.map(s => s.text).join('\n');
            setLyricsText(plainTexts);
            
            addLog(`Berhasil mengimpor berkas .srt: ${file.name}. Terdeteksi ${parsedSegs.length} segmen audio!`, 'success');
          } catch (err: any) {
            addLog(`Gagal memuat berkas .srt: ${err.message || err}`, 'error');
            alert(`Gagal memuat berkas .srt: ${err.message || err}`);
          }
        }
      };
      reader.readAsText(file);
    }
  };

  // Sync Audio with lyrics text via server-side Gemini AI
  const handleAIAlyricAlignment = async () => {
    const textLines = lyricsText.split('\n').map(l => l.trim()).filter(l => l);
    if (textLines.length === 0) {
      alert('Masukkan atau paste teks lirik terlebih dahulu!');
      return;
    }

    if (segments.length === 0) {
      alert('Analisis audio (VAD) terlebih dahulu agar AI memiliki timing interval dasar untuk dicocokkan!');
      return;
    }

    addLog('Mengirim teks dan metadata waveform ke Gemini AI untuk sinkronisasi...', 'info');
    
    try {
      const response = await fetch('/api/align', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: lyricsText,
          segments: segments.map(s => ({
            id: s.id,
            start: s.start,
            end: s.end
          }))
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server error during alignment');
      }

      if (data.segments && Array.isArray(data.segments)) {
        // Map aligned segments back
        const updatedSegs: AudioSegment[] = data.segments.map((seg: any, idx: number) => {
          const cleanTxt = seg.text.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15);
          return {
            id: idx + 1,
            text: seg.text,
            start: seg.start,
            end: seg.end,
            confidence: 98,
            filename: `${(idx + 1).toString().padStart(2, '0')}_${cleanTxt}`
          };
        });

        setSegments(updatedSegs);
        addLog(`Sinkronisasi AI Gemini Sukses! Menyelaraskan ${updatedSegs.length} baris teks dengan waveform.`, 'success');
      } else {
        throw new Error("Invalid output format from AI service");
      }
    } catch (err: any) {
      addLog(`Sinkronisasi AI Gagal: ${err.message || err}`, 'warning');
      addLog(`Menggunakan pencocokan sekuensial lokal sebagai fallback darurat...`, 'info');
      runLocalSequentialFallback();
    }
  };

  // Local fallback synchronizer to guarantee 100% operation even if API key is not yet set up
  const runLocalSequentialFallback = () => {
    const lines = lyricsText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;

    // Distribute lyric lines across our detected VAD segments
    const aligned: AudioSegment[] = lines.map((line, idx) => {
      // Find matching VAD index or interpolate
      let start = 0;
      let end = audioMetadata ? audioMetadata.duration : 30;

      if (idx < segments.length) {
        start = segments[idx].start;
        end = segments[idx].end;
      } else {
        // Interpolate remaining
        const lastSeg = segments[segments.length - 1];
        const baseStart = lastSeg ? lastSeg.end : 0;
        start = baseStart + (idx - segments.length) * 3;
        end = start + 2.8;
      }

      const cleanTxt = line.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15);
      return {
        id: idx + 1,
        text: line,
        start: parseFloat(start.toFixed(2)),
        end: parseFloat(end.toFixed(2)),
        confidence: 70, // manual fallback estimate
        filename: `${(idx + 1).toString().padStart(2, '0')}_${cleanTxt}`
      };
    });

    setSegments(aligned);
    addLog(`Fuzzy-sequential lokal berhasil memetakan ${aligned.length} baris teks ke rentang audio.`, 'success');
  };

  // Keyboard Hotkey for Spacebar in Tapper Sync Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTappingMode) return;
      
      if (e.code === 'Space') {
        e.preventDefault(); // prevent scrolling
        handleTapNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTappingMode, tappingLyrics, tappedTimestamps, currentTime]);

  const computeAutoTapTimestamps = async (lines: string[], duration: number): Promise<number[]> => {
    if (lines.length === 0) return [];
    
    // 1. AI Align Mode (High Precision)
    if (autoTapMethod === 'ai') {
      setIsAligningAI(true);
      try {
        addLog('Menggunakan Gemini AI untuk menyelaraskan ketukan otomatis...', 'info');
        let currentSegs = segments;
        if (currentSegs.length === 0 && audioBuffer) {
          currentSegs = runLocalVAD(audioBuffer);
        }

        const response = await fetch('/api/align', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: lines.join('\n'),
            segments: currentSegs.map(s => ({
              id: s.id,
              start: s.start,
              end: s.end
            }))
          })
        });

        const data = await response.json();
        if (response.ok && data.segments && Array.isArray(data.segments)) {
          addLog('Penyelarasan AI selesai dengan sukses!', 'success');
          const timestamps = data.segments.map((s: any) => s.start);
          const lastSeg = data.segments[data.segments.length - 1];
          timestamps.push(lastSeg.end);
          setIsAligningAI(false);
          return timestamps;
        } else {
          throw new Error(data.error || 'Respon penyelarasan AI tidak valid.');
        }
      } catch (e: any) {
        addLog(`Penyelarasan AI gagal: ${e.message || e}. Beralih ke mode Pintar (VAD Vocal).`, 'error');
      } finally {
        setIsAligningAI(false);
      }
    }

    // 2. Smart (VAD Vocal) Mode (Default / Fallback)
    if (autoTapMethod === 'vad' || autoTapMethod === 'ai') {
      let currentSegs = segments;
      if (currentSegs.length === 0 && audioBuffer) {
        currentSegs = runLocalVAD(audioBuffer);
      }

      if (currentSegs.length > 0) {
        const timestamps: number[] = [];
        const N = lines.length;
        const M = currentSegs.length;

        // Group lines by segment index proportionally
        const linesPerSegment: string[][] = Array.from({ length: M }, () => []);
        for (let i = 0; i < N; i++) {
          const segmentIndex = Math.min(M - 1, Math.floor((i / N) * M));
          linesPerSegment[segmentIndex].push(lines[i]);
        }

        // Now compute start timestamps for each line based on VAD boundaries
        for (let j = 0; j < M; j++) {
          const seg = currentSegs[j];
          const linesInSeg = linesPerSegment[j];
          if (linesInSeg.length === 0) continue;

          if (linesInSeg.length === 1) {
            timestamps.push(seg.start);
          } else {
            // Distribute lines within the VAD segment based on text length
            const lengths = linesInSeg.map(l => Math.max(1, l.length));
            const totalLen = lengths.reduce((a, b) => a + b, 0);
            const segDuration = seg.end - seg.start;

            let runningSum = seg.start;
            for (let k = 0; k < linesInSeg.length; k++) {
              timestamps.push(parseFloat(runningSum.toFixed(2)));
              const lineDur = (lengths[k] / totalLen) * segDuration;
              runningSum += lineDur;
            }
          }
        }

        // Add final close timestamp
        timestamps.push(currentSegs[currentSegs.length - 1].end);
        return timestamps;
      }
    }

    // 3. Proportional Mode (Pure fallback based on lirik characters)
    const lineLengths = lines.map(line => Math.max(1, line.replace(/\s+/g, '').length));
    const totalLen = lineLengths.reduce((a, b) => a + b, 0);
    
    const startOffset = 0.1;
    const endOffset = 0.2;
    const availableDuration = Math.max(1, duration - startOffset - endOffset);
    
    const timestamps: number[] = [startOffset];
    let runningSum = startOffset;
    
    for (let i = 0; i < lines.length; i++) {
      const proportion = lineLengths[i] / totalLen;
      const segmentDuration = proportion * availableDuration;
      runningSum += segmentDuration;
      timestamps.push(parseFloat(runningSum.toFixed(2)));
    }
    
    if (timestamps[timestamps.length - 1] > duration) {
      timestamps[timestamps.length - 1] = parseFloat(duration.toFixed(2));
    }
    
    return timestamps;
  };

  // Effect to automatically tap in Auto-Tap mode when currentTime reaches target timestamps
  useEffect(() => {
    if (isTappingMode && isAutoTapping && autoTapTimestamps.length > 0) {
      const k = tappedTimestamps.length;
      if (k < autoTapTimestamps.length) {
        const targetTime = autoTapTimestamps[k];
        // Apply latency calibration compensation dynamically (subtracting/adding the latency offset)
        if (currentTime >= targetTime + latencyOffset) {
          handleTapNext(targetTime);
        }
      }
    }
  }, [currentTime, isTappingMode, isAutoTapping, autoTapTimestamps, tappedTimestamps, latencyOffset]);

  const validateAndRepairSegments = (segs: AudioSegment[]): AudioSegment[] => {
    if (segs.length === 0) return [];
    
    // Sort by start time to process chronologically
    let sorted = [...segs].sort((a, b) => a.start - b.start);
    const repaired: AudioSegment[] = [];
    const totalDuration = audioMetadata ? audioMetadata.duration : (audioBuffer ? audioBuffer.duration : 999);
    
    for (let i = 0; i < sorted.length; i++) {
      let seg = { ...sorted[i] };
      
      // Constraint: Start time cannot be negative
      if (seg.start < 0) seg.start = 0;
      
      // Constraint: End time must be greater than start time
      if (seg.end <= seg.start) {
        seg.end = parseFloat((seg.start + 0.5).toFixed(2));
      }
      
      // Constraint: Cannot exceed total audio duration
      if (seg.end > totalDuration) {
        seg.end = parseFloat(totalDuration.toFixed(2));
        if (seg.start >= seg.end) {
          seg.start = parseFloat(Math.max(0, seg.end - 0.5).toFixed(2));
        }
      }
      
      // Constraint: No overlap with previous segment, and resolving any gaps / anomalies safely
      if (repaired.length > 0) {
        const prev = repaired[repaired.length - 1];
        if (seg.start < prev.end) {
          // Resolve overlap by snapping this segment's start to the previous segment's end
          seg.start = prev.end;
          if (seg.end <= seg.start) {
            seg.end = parseFloat((seg.start + 0.5).toFixed(2));
          }
        }
      }
      
      seg.start = parseFloat(seg.start.toFixed(2));
      seg.end = parseFloat(seg.end.toFixed(2));
      
      repaired.push(seg);
    }
    
    return repaired;
  };

  // Auto-validation of segments to prevent overlaps, negative durations, or bound errors
  useEffect(() => {
    if (segments.length === 0) return;
    
    let needsRepair = false;
    const totalDuration = audioMetadata ? audioMetadata.duration : (audioBuffer ? audioBuffer.duration : 999);
    
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.start < 0 || seg.end <= seg.start || seg.end > totalDuration) {
        needsRepair = true;
        break;
      }
      if (i > 0) {
        const prev = segments[i - 1];
        if (seg.start < prev.end) {
          needsRepair = true;
          break;
        }
      }
    }
    
    if (needsRepair) {
      addLog('Menjalankan validasi & perbaikan otomatis pada segmen...', 'info');
      const repaired = validateAndRepairSegments(segments);
      setSegments(repaired);
    }
  }, [segments, audioMetadata, audioBuffer]);

  // Stable AudioContext getter to prevent multiple instances
  const audioCtxRef = useRef<AudioContext | null>(null);
  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioCtx(audioCtxRef.current);
    }
    return audioCtxRef.current;
  };

  const playFrom = (startSec: number) => {
    stopCurrentPlayback();

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const totalDuration = audioMetadata ? audioMetadata.duration : 30;
    const duration = totalDuration - startSec;
    if (duration <= 0) return;

    addLog(`Memutar audio penuh mulai dari ${startSec.toFixed(2)}s...`, 'info');

    if (isDemo) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);

      setPlayingSource(osc as any);
      setPlayingSegmentId(-99); // Magic ID for full audio
      setIsPlaybackPaused(false);
      setCurrentTime(startSec);

      const startTime = Date.now();
      playheadIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setCurrentTime(Math.min(totalDuration, startSec + elapsed));
        if (elapsed >= duration) {
          stopCurrentPlayback();
          setCurrentTime(totalDuration);
        }
      }, 30);
      return;
    }

    if (!audioBuffer) return;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    const now = ctx.currentTime;
    source.start(now, startSec, duration);
    source.stop(now + duration);

    setPlayingSource(source);
    setPlayingSegmentId(-99); // Magic ID for full audio
    setIsPlaybackPaused(false);
    setCurrentTime(startSec);

    const startTime = ctx.currentTime;
    playheadIntervalRef.current = setInterval(() => {
      const elapsed = ctx.currentTime - startTime;
      setCurrentTime(Math.min(totalDuration, startSec + elapsed));
    }, 30);

    source.onended = () => {
      stopCurrentPlayback();
      setCurrentTime(totalDuration);
    };
  };

  const startTappingMode = async () => {
    const lines = lyricsText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) {
      alert('Masukkan atau paste teks lirik terlebih dahulu!');
      return;
    }
    const totalDuration = audioMetadata ? audioMetadata.duration : 30;
    if (totalDuration <= 0) {
      alert('Unggah file audio terlebih dahulu atau gunakan Demo Mode.');
      return;
    }

    try {
      const computed = await computeAutoTapTimestamps(lines, totalDuration);
      setAutoTapTimestamps(computed);
      setTappingLyrics(lines);
      setTappedTimestamps([0]);
      setIsTappingMode(true);
      setCurrentTime(0);
      playFrom(0);
      addLog(`Memulai mode Tapper Sync untuk ${lines.length} baris. Ketuk Spasi atau Klik Tombol seiring audio diputar.`, 'info');
    } catch (e: any) {
      alert(`Gagal menghitung alinyemen: ${e.message || e}`);
    }
  };

  const handleTapNext = (overrideTime?: number | any) => {
    if (tappingLyrics.length === 0) return;
    
    const t = (typeof overrideTime === 'number') ? overrideTime : parseFloat(currentTime.toFixed(2));
    const nextTimestamps = [...tappedTimestamps, t];
    setTappedTimestamps(nextTimestamps);

    const tapCount = nextTimestamps.length;
    if (tapCount < tappingLyrics.length + 1) {
      const syncedLineIndex = tapCount - 2;
      if (syncedLineIndex >= 0 && syncedLineIndex < tappingLyrics.length) {
        addLog(`Ketukan #${tapCount - 1} (Selesai Baris ${tapCount - 1}): ${t}s`, 'info');
      } else {
        addLog(`Ketukan #${tapCount - 1}: ${t}s`, 'info');
      }
    } else {
      const compiledSegments: AudioSegment[] = tappingLyrics.map((line, idx) => {
        const start = nextTimestamps[idx];
        const end = nextTimestamps[idx + 1];
        const cleanTxt = line.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15);
        return {
          id: idx + 1,
          text: line,
          start: start,
          end: end,
          confidence: 100,
          filename: `${(idx + 1).toString().padStart(2, '0')}_${cleanTxt}`
        };
      });

      setSegments(compiledSegments);
      setIsTappingMode(false);
      stopCurrentPlayback();
      addLog(`Tapper Sync Sukses! ${compiledSegments.length} baris tersinkronisasi sempurna dengan audio.`, 'success');
      alert(`Sinkronisasi Selesai! Berhasil memetakan ${compiledSegments.length} segmen presisi.`);
    }
  };

  const handleTapBack = () => {
    if (tappedTimestamps.length <= 1) return;
    setTappedTimestamps(prev => prev.slice(0, -1));
    addLog(`Membatalkan ketukan terakhir. Kembali ke baris sebelumnya.`, 'warning');
  };

  // Interactive Audioslicer Player (Slices individual parts of the loaded buffer)
  const stopCurrentPlayback = () => {
    if (playingSource) {
      try {
        playingSource.onended = null; // Clear the handler so stop() doesn't trigger onended jump actions
        playingSource.stop();
      } catch (e) {}
      setPlayingSource(null);
    }
    if (playheadIntervalRef.current) {
      clearInterval(playheadIntervalRef.current);
    }
    setPlayingSegmentId(null);
    setIsPlaybackPaused(false);
  };

  const playSegment = (seg: AudioSegment) => {
    stopCurrentPlayback();

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const duration = seg.end - seg.start;
    if (duration <= 0) return;

    addLog(`Memutar segmen #${seg.id}: "${seg.text}" [${seg.start}s - ${seg.end}s]`, 'info');

    if (isDemo) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150 + (seg.id * 10) % 50, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);

      setPlayingSource(osc as any);
      setPlayingSegmentId(seg.id);
      setIsPlaybackPaused(false);
      setCurrentTime(seg.start);

      const startTime = Date.now();
      playheadIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setCurrentTime(Math.min(seg.end, seg.start + elapsed));
        if (elapsed >= duration) {
          stopCurrentPlayback();
          setCurrentTime(seg.end);
        }
      }, 30);
      return;
    }

    if (!audioBuffer) return;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    const now = ctx.currentTime;
    source.start(now, seg.start, duration);
    source.stop(now + duration);

    setPlayingSource(source);
    setPlayingSegmentId(seg.id);
    setIsPlaybackPaused(false);
    setCurrentTime(seg.start);

    const startTime = ctx.currentTime;
    playheadIntervalRef.current = setInterval(() => {
      const elapsed = ctx.currentTime - startTime;
      setCurrentTime(Math.min(seg.end, seg.start + elapsed));
    }, 30);

    source.onended = () => {
      stopCurrentPlayback();
      setCurrentTime(seg.end);
    };
  };

  const pauseSegment = () => {
    if (playingSource) {
      try {
        playingSource.onended = null;
        playingSource.stop();
      } catch (e) {}
      setPlayingSource(null);
    }
    if (playheadIntervalRef.current) {
      clearInterval(playheadIntervalRef.current);
    }
    setIsPlaybackPaused(true);
    addLog(`Pemutaran dipause pada posisi ${currentTime.toFixed(2)}s`, 'info');
  };

  const resumeSegment = (seg: AudioSegment) => {
    if (!isPlaybackPaused) return;

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    let startOffset = currentTime;
    if (startOffset < seg.start || startOffset >= seg.end) {
      startOffset = seg.start;
    }
    const remainingDuration = seg.end - startOffset;
    if (remainingDuration <= 0) {
      playSegment(seg);
      return;
    }

    addLog(`Melanjutkan segmen #${seg.id} dari ${startOffset.toFixed(2)}s...`, 'info');

    if (isDemo) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150 + (seg.id * 10) % 50, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + remainingDuration);
      
      osc.start();
      osc.stop(ctx.currentTime + remainingDuration);

      setPlayingSource(osc as any);
      setIsPlaybackPaused(false);

      const startTime = Date.now();
      playheadIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setCurrentTime(Math.min(seg.end, startOffset + elapsed));
        if (elapsed >= remainingDuration) {
          stopCurrentPlayback();
          setCurrentTime(seg.end);
        }
      }, 30);
      return;
    }

    if (!audioBuffer) return;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    const now = ctx.currentTime;
    source.start(now, startOffset, remainingDuration);
    source.stop(now + remainingDuration);

    setPlayingSource(source);
    setIsPlaybackPaused(false);

    const startTime = ctx.currentTime;
    playheadIntervalRef.current = setInterval(() => {
      const elapsed = ctx.currentTime - startTime;
      setCurrentTime(Math.min(seg.end, startOffset + elapsed));
    }, 30);

    source.onended = () => {
      stopCurrentPlayback();
      setCurrentTime(seg.end);
    };
  };

  const stopSegment = (seg: AudioSegment) => {
    stopCurrentPlayback();
    setCurrentTime(seg.start);
    addLog(`Menghentikan pemutaran segmen #${seg.id}.`, 'info');
  };

  // Editable timeline functions
  const handleUpdateSegmentTimes = (id: number, start: number, end: number) => {
    setSegments(prev => prev.map(s => {
      if (s.id === id) {
        return {
          ...s,
          start: parseFloat(Math.max(0, start).toFixed(2)),
          end: parseFloat(Math.max(start + 0.1, end).toFixed(2))
        };
      }
      return s;
    }));
  };

  const handleUpdateSegmentText = (id: number, newText: string) => {
    setSegments(prev => prev.map(s => {
      if (s.id === id) {
        const cleanTxt = newText.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15);
        const isDefault = !s.filename || s.filename === `segment_${s.id}` || s.filename === `${s.id.toString().padStart(2, '0')}_baris_lirik_baru` || s.filename.startsWith(`${s.id.toString().padStart(2, '0')}_`);
        return {
          ...s,
          text: newText,
          filename: isDefault ? `${s.id.toString().padStart(2, '0')}_${cleanTxt}` : s.filename
        };
      }
      return s;
    }));
  };

  const handleUpdateSegmentFilename = (id: number, newFilename: string) => {
    setSegments(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, filename: newFilename };
      }
      return s;
    }));
  };

  const deleteSegment = (id: number) => {
    setSegments(prev => {
      const filtered = prev.filter(s => s.id !== id);
      // Re-index
      return filtered.map((s, idx) => ({ ...s, id: idx + 1 }));
    });
    addLog(`Deleted segment #${id}`, 'info');
  };

  const mergeSegmentWithNext = (id: number) => {
    const targetIdx = segments.findIndex(s => s.id === id);
    if (targetIdx === -1 || targetIdx === segments.length - 1) return;

    const current = segments[targetIdx];
    const next = segments[targetIdx + 1];

    const merged: AudioSegment = {
      id: current.id,
      text: `${current.text} ${next.text}`,
      start: current.start,
      end: next.end,
      filename: current.filename
    };

    setSegments(prev => {
      const nextList = [...prev];
      nextList.splice(targetIdx, 2, merged);
      // re-index
      return nextList.map((s, idx) => ({ ...s, id: idx + 1 }));
    });

    addLog(`Merged segment #${id} with #${id + 1}`, 'info');
  };

  const addNewSegment = () => {
    const maxEnd = segments.length > 0 ? Math.max(...segments.map(s => s.end)) : 0;
    const durationLimit = audioMetadata ? audioMetadata.duration : 30;

    const newStart = parseFloat(maxEnd.toFixed(2));
    const newEnd = parseFloat(Math.min(durationLimit, newStart + 3.0).toFixed(2));

    const newSeg: AudioSegment = {
      id: segments.length + 1,
      text: `Baris Lirik Baru ${segments.length + 1}`,
      start: newStart,
      end: newEnd,
      filename: `${(segments.length + 1).toString().padStart(2, '0')}_baris_lirik_baru`
    };

    setSegments(prev => [...prev, newSeg]);
    addLog(`Added manual segment #${newSeg.id}`, 'info');
  };

  const splitSegmentAtPlayhead = (id: number, time: number) => {
    const targetIdx = segments.findIndex(s => s.id === id);
    if (targetIdx === -1) return;

    const original = segments[targetIdx];
    
    // Split text into two halves if there are multiple words
    const words = original.text.split(' ');
    let text1 = original.text;
    let text2 = `Potongan #${original.id + 1}`;
    
    if (words.length > 1) {
      const mid = Math.ceil(words.length / 2);
      text1 = words.slice(0, mid).join(' ');
      text2 = words.slice(mid).join(' ');
    }

    const seg1: AudioSegment = {
      ...original,
      id: original.id,
      text: text1,
      end: parseFloat(time.toFixed(2)),
      filename: `${original.id.toString().padStart(2, '0')}_${text1.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15)}`
    };

    const seg2: AudioSegment = {
      id: original.id + 1,
      text: text2,
      start: parseFloat(time.toFixed(2)),
      end: original.end,
      filename: `${(original.id + 1).toString().padStart(2, '0')}_${text2.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15)}`
    };

    setSegments(prev => {
      const nextList = [...prev];
      nextList.splice(targetIdx, 1, seg1, seg2);
      return nextList.map((s, idx) => {
        const cleanTxt = s.text.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15);
        return {
          ...s,
          id: idx + 1,
          filename: `${(idx + 1).toString().padStart(2, '0')}_${cleanTxt}`
        };
      });
    });

    addLog(`Segment #${id} dipotong di ${time.toFixed(2)}s menjadi dua segmen`, 'success');
  };

  const handleProportionalSplit = () => {
    const lines = lyricsText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) {
      alert('Masukkan atau paste teks lirik terlebih dahulu!');
      return;
    }

    const totalDuration = audioMetadata ? audioMetadata.duration : 30;
    if (totalDuration <= 0) {
      alert('Unggah file audio terlebih dahulu atau gunakan Demo Mode.');
      return;
    }

    addLog(`Membagi rata audio sepanjang ${totalDuration.toFixed(2)}s menjadi ${lines.length} potongan lirik...`, 'info');

    const segmentDuration = totalDuration / lines.length;
    const distributed: AudioSegment[] = lines.map((line, idx) => {
      const start = idx * segmentDuration;
      const end = (idx + 1) * segmentDuration;
      const cleanTxt = line.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15);
      
      return {
        id: idx + 1,
        text: line,
        start: parseFloat(start.toFixed(2)),
        end: parseFloat(end.toFixed(2)),
        confidence: 100,
        filename: `${(idx + 1).toString().padStart(2, '0')}_${cleanTxt}`
      };
    });

    setSegments(distributed);
    setSelectedSegmentId(1);
    addLog(`Distribusi rata sukses! Membuat ${distributed.length} segmen berurutan secara proporsional.`, 'success');
  };

  // Client-Side Splitter Multi-Format Encoder & ZIP builder!
  const triggerAudioSlicingExport = async () => {
    if (segments.length === 0) {
      alert('Belum ada data segmen untuk diekspor!');
      return;
    }

    if (isDemo && !audioBuffer) {
      addLog(`Slicing simulated cuts in Demo Mode for format ${exportFormat}. Packing project...`, 'info');
      await performDemoExportZip();
      return;
    }

    if (!audioBuffer) return;

    setExportProgress(1);
    setExportStatus(`Menyiapkan encoding format ${exportFormat}...`);
    addLog(`Memulai slicing ${segments.length} potongan format ${exportFormat} dari berkas asli...`, 'info');

    const JSZipModule = (await import('jszip')).default;
    const zip = new JSZipModule();

    // Helper to convert Blob to base64
    const blobToBase64 = (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          } else {
            reject(new Error('Failed to convert blob to base64'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    // Helper to convert base64 to Blob
    const base64ToBlob = (base64: string, mimeType: string): Blob => {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType });
    };

    try {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        setExportProgress(Math.round(((i + 1) / segments.length) * 100));
        setExportStatus(`Mengiris segmen ${i + 1} dari ${segments.length} (${exportFormat}): "${seg.text.substring(0, 15)}..."`);

        // Name builder with safe character enforcement
        let filename = seg.filename || `segment_${seg.id}`;
        
        // Strip out existing numbering prefixes if autoNumbering is disabled
        if (!autoNumbering) {
          filename = filename.replace(/^\d+_/i, '');
        } else {
          // Ensure it starts with the correct ID prefix
          const prefix = `${seg.id.toString().padStart(2, '0')}_`;
          if (!filename.startsWith(prefix)) {
            filename = prefix + filename.replace(/^\d+_/i, '');
          }
        }

        // Only sanitize characters if option is enabled
        if (removeSpecialChars) {
          filename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
        }

        let audioBlob: Blob;
        let ext = exportFormat.toLowerCase();

        if (ext === 'mp3') {
          audioBlob = encodeMp3(audioBuffer, seg.start, seg.end, mp3Bitrate);
        } else if (ext === 'wav') {
          audioBlob = encodeWav(audioBuffer, seg.start, seg.end);
        } else {
          // Use high-fidelity server-side FFmpeg transcoder
          const wavBlob = encodeWav(audioBuffer, seg.start, seg.end);
          const wavBase64 = await blobToBase64(wavBlob);
          
          let targetFormat = ext;
          if (targetFormat === 'm4a') targetFormat = 'aac';

          const transcodeResponse = await fetch('/api/transcode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wavBase64, format: targetFormat })
          });

          const transcodeData = await transcodeResponse.json();
          if (!transcodeResponse.ok) {
            throw new Error(transcodeData.error || `Transcoding failed for format ${exportFormat}`);
          }

          let mimeType = 'audio/ogg';
          if (targetFormat === 'flac') mimeType = 'audio/flac';
          else if (targetFormat === 'aac') mimeType = 'audio/mp4';

          audioBlob = base64ToBlob(transcodeData.base64, mimeType);
          
          if (ext === 'aac') {
            ext = 'm4a';
          }
        }

        zip.file(`${filename}.${ext}`, audioBlob);
        
        // Give UI thread breathing space
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Automatically include subtitles.srt inside the ZIP archive for the user
      zip.file('subtitles.srt', generateSrtContent(segments));
      zip.file('lyrics_synced.lrc', segments.map(s => `[${formatLrcTime(s.start)}]${s.text}`).join('\n'));

      setExportStatus('Mengompresi potongan audio ke dalam ZIP...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `AcousticSplit_Audio_Segments_${exportFormat}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setExportProgress(null);
      addLog(`Slicing Sukses! ${segments.length} file ${exportFormat} dan berkas subtitle (.srt) telah diekspor ke dalam ZIP.`, 'success');
      alert(`Berhasil mengekspor ${segments.length} file audio dan subtitle format ${exportFormat}!`);
    } catch (e: any) {
      setExportProgress(null);
      addLog(`Ekspor Gagal: ${e.message || e}`, 'error');
      alert(`Gagal mengekspor audio: ${e.message || e}`);
    }
  };

  const formatSrtTime = (secs: number): string => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.round((secs % 1) * 1000);
    
    const pad = (num: number, size: number) => {
      let s = num.toString();
      while (s.length < size) s = "0" + s;
      return s;
    };
    
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
  };

  const generateSrtContent = (segs: AudioSegment[]): string => {
    return segs
      .map((seg, idx) => {
        const index = idx + 1;
        const startTime = formatSrtTime(seg.start);
        const endTime = formatSrtTime(seg.end);
        return `${index}\n${startTime} --> ${endTime}\n${seg.text}\n`;
      })
      .join('\n');
  };

  const exportSrtSubtitleFile = () => {
    if (segments.length === 0) {
      alert('Belum ada data segmen untuk diekspor!');
      return;
    }

    addLog('Menghasilkan berkas subtitle (.srt)...', 'info');
    const srtContent = generateSrtContent(segments);
    const srtBlob = new Blob([srtContent], { type: 'text/srt;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(srtBlob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `AcousticSplit_Subtitles.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    
    addLog(`Sukses mengekspor ${segments.length} baris ke file subtitles.srt`, 'success');
  };

  const performDemoExportZip = async () => {
    setExportProgress(20);
    setExportStatus('Menyiapkan demo audio...');
    const JSZipModule = (await import('jszip')).default;
    const zip = new JSZipModule();

    // Export lyrics & subtitle
    zip.file('lyrics_synced.lrc', segments.map(s => `[${formatLrcTime(s.start)}]${s.text}`).join('\n'));
    zip.file('subtitles.srt', generateSrtContent(segments));
    zip.file('metadata_info.txt', `Original: ${audioMetadata?.name}\nTotal Slices: ${segments.length}\nFormat: ${exportFormat}\nDate: ${new Date().toLocaleDateString()}`);

    // Create mini audio beeps for demo
    setExportProgress(60);
    setExportStatus('Membuat demo segmen biner...');
    segments.forEach((seg) => {
      let ext = exportFormat.toLowerCase();
      if (ext === 'aac') ext = 'm4a';
      zip.file(`${seg.filename}.${ext}`, `[Demo Simulated ${exportFormat.toUpperCase()} Audio Content]\nNo: ${seg.id}\nDuration: ${seg.start}s - ${seg.end}s\nContent: ${seg.text}`);
    });

    setExportProgress(90);
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Demo_Slices_${exportFormat}_And_LRC.zip`;
    link.click();
    URL.revokeObjectURL(url);
    
    setExportProgress(null);
    addLog(`Demo Export Sukses! Mengunduh paket metadata, berkas teks lirik LRC, dan berkas subtitle (.srt) format ${exportFormat}.`, 'success');
  };

  const formatLrcTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainSecs.toFixed(2).padStart(5, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0E0F11] font-sans antialiased text-[#E0E0E0]">
      {/* Header Panel */}
      <header className="border-b border-[#2A2B2F] bg-[#151619] sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-500 rounded-sm flex items-center justify-center text-[#0E0F11] font-bold italic tracking-tighter">AS</div>
            <div>
              <h1 className="text-sm font-semibold tracking-wide uppercase text-white font-mono flex items-center gap-2">
                AcousticSplit <span className="text-cyan-500">AI</span>
                <span className="text-[10px] font-mono opacity-50 bg-white/10 px-2 py-0.5 rounded-sm">
                  v1.2.0-PRO
                </span>
              </h1>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">Audio Slicing, silence segment VAD, & AI Lyric Sync</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-[11px] font-mono text-cyan-400/80">
              <div className="flex flex-col items-end">
                <span className="opacity-40 text-white uppercase text-[9px]">Platform</span>
                WEB SANDBOX
              </div>
            </div>
            <div className="h-8 w-px bg-[#2A2B2F]"></div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setIsDemo(true);
                  loadDemoSegments();
                }}
                className={`px-4 py-1.5 rounded-sm text-xs font-mono font-semibold uppercase tracking-wider border cursor-pointer transition-all ${
                  isDemo 
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_8px_rgba(249,115,22,0.15)]' 
                    : 'bg-[#2A2B2F] text-gray-400 border-white/5 hover:text-white hover:bg-[#36373C]'
                }`}
              >
                Demo Mode
              </button>
              <div className="text-xs text-cyan-400 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
                <span>ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        
        {/* Row 1: Drag & Drop Input and Audio Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File Input Card */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleAudioDrop}
            className="lg:col-span-2 bg-[#121316] border border-dashed border-[#2A2B2F] hover:border-cyan-500/50 rounded-sm p-8 flex flex-col items-center justify-center text-center transition-all relative group shadow-lg min-h-[220px]"
          >
            <input 
              type="file" 
              id="audio-upload-input" 
              accept=".mp3,.wav,.flac,.ogg,.aac,.m4a,.opus,.aiff,.wma" 
              onChange={handleAudioSelect} 
              className="hidden" 
            />
            <div className="p-4 bg-cyan-950/20 group-hover:bg-cyan-950/40 border border-[#2A2B2F] group-hover:border-cyan-500/30 rounded-sm text-cyan-400 transition-colors mb-4">
              <Upload className="w-8 h-8 group-hover:scale-105 transition-transform" />
            </div>
            <label 
              htmlFor="audio-upload-input" 
              className="font-mono text-xs font-bold text-white uppercase tracking-widest cursor-pointer hover:text-cyan-400 transition-colors"
            >
              SELECT AUDIO FILE
            </label>
            <p className="text-[11px] text-gray-400 mt-2 max-w-sm uppercase font-mono tracking-wide">
              Mendukung MP3, WAV, FLAC, M4A dll. Seret & letakkan file di sini untuk memulai decoding visual.
            </p>
            {isDemo && (
              <div className="absolute top-3 right-3 bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-sm text-[9px] font-mono font-medium uppercase tracking-wider animate-pulse">
                Uji Coba Aktif
              </div>
            )}
          </div>

          {/* Metadata Card */}
          <div className="bg-[#121316] border border-[#2A2B2F] rounded-sm p-6 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#2A2B2F] pb-3 mb-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-500">Source File Information</span>
                <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-sm font-mono uppercase">
                  {audioMetadata?.format || 'Empty'}
                </span>
              </div>

              {audioMetadata ? (
                <div className="grid grid-cols-2 gap-y-3 font-mono text-[11px] mt-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider">File Name</span>
                    <span className="text-white truncate max-w-[130px]" title={audioMetadata.name}>
                      {audioMetadata.name}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider">File Size</span>
                    <span className="text-white">{audioMetadata.size}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider">Total Duration</span>
                    <span className="text-white">{audioMetadata.duration.toFixed(2)}s</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider">Sample Rate</span>
                    <span className="text-white">{audioMetadata.sampleRate} Hz</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider">Channels</span>
                    <span className="text-white">{audioMetadata.channels === 1 ? 'Mono' : 'Stereo (2)'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider">Bitrate</span>
                    <span className="text-white">{audioMetadata.bitrate}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-[11px] font-mono uppercase tracking-wider">
                  No audio file loaded. Load a file or run in Demo Mode.
                </div>
              )}
            </div>

            {audioMetadata && (
              <div className="mt-4 pt-3 border-t border-[#2A2B2F] flex justify-between items-center text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                <span className="opacity-50">Decoder status</span>
                <span className="text-cyan-500 font-bold">LOSSLESS ACTIVE</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Waveform Visualizer */}
        <WaveformView
          audioBuffer={audioBuffer}
          segments={segments}
          currentTime={currentTime}
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={(id) => setSelectedSegmentId(id)}
          onUpdateSegmentTimes={handleUpdateSegmentTimes}
          onSeek={(time) => {
            setCurrentTime(time);
            if (audioCtx && playingSource) {
              // stop playback and sync timing
              stopCurrentPlayback();
            }
          }}
          isDemo={isDemo}
        />

        {/* Master Player Controls Bar */}
        <div className="bg-[#151619] border border-[#2A2B2F] rounded-sm p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-md font-mono text-xs">
          <div className="flex items-center gap-3">
            {/* Skip back to start */}
            <button
              onClick={() => {
                stopCurrentPlayback();
                setCurrentTime(0);
                addLog("Playhead direset ke 0.00 detik", "info");
              }}
              className="p-2 bg-[#2A2B2F] hover:bg-[#36373C] border border-white/5 text-gray-300 hover:text-white rounded-sm transition-all cursor-pointer flex items-center justify-center"
              title="Kembali ke awal (0s)"
            >
              <SkipBack className="w-4 h-4 text-cyan-400" />
            </button>

            {/* Play/Pause/Resume */}
            {playingSegmentId !== null ? (
              !isPlaybackPaused ? (
                <button
                  onClick={pauseSegment}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-[#0E0F11] font-bold uppercase rounded-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                  title="Pause pemutaran"
                >
                  <Pause className="w-3.5 h-3.5 fill-[#0E0F11] text-[#0E0F11]" />
                  Pause
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (playingSegmentId === -99) {
                      playFrom(currentTime);
                    } else {
                      const seg = segments.find(s => s.id === playingSegmentId);
                      if (seg) resumeSegment(seg);
                    }
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0E0F11] font-bold uppercase rounded-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                  title="Resume pemutaran"
                >
                  <Play className="w-3.5 h-3.5 fill-[#0E0F11] text-[#0E0F11]" />
                  Resume
                </button>
              )
            ) : (
              <button
                onClick={() => playFrom(currentTime)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-[#0E0F11] font-bold uppercase rounded-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                title="Putar dari posisi playhead saat ini"
              >
                <Play className="w-3.5 h-3.5 fill-[#0E0F11] text-[#0E0F11]" />
                Play Audio
              </button>
            )}

            {/* Stop / Reset playhead */}
            <button
              onClick={() => {
                if (playingSegmentId !== null && playingSegmentId !== -99) {
                  const seg = segments.find(s => s.id === playingSegmentId);
                  if (seg) {
                    stopSegment(seg);
                    return;
                  }
                }
                stopCurrentPlayback();
                setCurrentTime(0);
                addLog("Playback dihentikan & playhead direset ke 0s", "info");
              }}
              className="px-3 py-2 bg-[#2A2B2F] hover:bg-[#36373C] border border-white/5 text-gray-400 hover:text-white rounded-sm transition-all cursor-pointer text-[11px] flex items-center gap-1"
              title="Hentikan & Reset"
            >
              <Square className="w-3 h-3 fill-gray-400 text-gray-400" />
              Stop & Reset
            </button>
          </div>

          <div className="flex items-center gap-4 text-gray-400">
            <span className="text-[11px] uppercase tracking-wider">
              Status:{" "}
              <span className={playingSegmentId !== null ? "text-cyan-400 font-bold" : "text-gray-500"}>
                {playingSegmentId === -99
                  ? "MEMUTAR AUDIO PENUH"
                  : playingSegmentId !== null
                  ? `MEMUTAR SEGMEN #${playingSegmentId}`
                  : "BERHENTI (IDLE)"}
              </span>
            </span>
            <div className="h-4 w-px bg-[#2A2B2F]"></div>
            <span className="text-[11px] text-cyan-500 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-sm">
              PLAYHEAD: {currentTime.toFixed(2)}s / {(audioMetadata ? audioMetadata.duration : 30.0).toFixed(2)}s
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-widest">
            <Volume2 className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
            <span>Lossless PCM Monitor</span>
          </div>
        </div>

        {/* Row 3: Lyrics & AI Synchronizer + VAD settings */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Block: Lyrics input or Live Tapper Focus Panel */}
          {isTappingMode ? (
            <div className="lg:col-span-2 bg-[#121316] border-2 border-cyan-500/30 rounded-sm p-6 shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between min-h-[460px]">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2A2B2F] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-widest font-semibold text-cyan-400">Live Tapper Active</span>
                  </div>
                  <div className="text-[10px] font-mono text-cyan-400 uppercase bg-cyan-500/10 px-2 py-0.5 rounded-sm border border-cyan-500/20">
                    {tappedTimestamps.length} / {tappingLyrics.length + 1} Ketukan
                  </div>
                </div>

                {/* Interactive Lyric Teleprompter Dashboard */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-gray-400 font-mono uppercase tracking-widest">Interactive Teleprompter</span>
                    <span className="text-[9px] text-cyan-400 font-mono animate-pulse">Auto-Scroll Aktif</span>
                  </div>
                  <div className="max-h-[190px] overflow-y-auto bg-[#0A0B0D] border border-[#2A2B2F] rounded-sm p-2 space-y-1 scrollbar-thin">
                    {tappingLyrics.map((line, idx) => {
                      const isSynced = idx < tappedTimestamps.length - 1;
                      const isActive = tappedTimestamps.length > 0 
                        ? idx === tappedTimestamps.length - 1 
                        : idx === 0;
                      const isNext = tappedTimestamps.length > 0 
                        ? idx === tappedTimestamps.length 
                        : idx === 1;

                      let itemBg = "bg-transparent text-gray-600 border border-transparent";
                      let badge = "WAIT";
                      let badgeClass = "bg-[#1A1B1F] text-gray-500 border border-[#2A2B2F]";
                      
                      if (isSynced) {
                        itemBg = "bg-emerald-500/5 text-emerald-500/60 border border-emerald-500/10 line-through";
                        badge = "✓ SYNC";
                        badgeClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                      } else if (isActive) {
                        itemBg = "bg-cyan-500/10 text-white border border-cyan-500/30 font-bold shadow-[inset_0_0_8px_rgba(6,182,212,0.1)]";
                        badge = tappedTimestamps.length === tappingLyrics.length ? "FINAL END" : "BERJALAN";
                        badgeClass = "bg-cyan-500 text-[#0E0F11] font-bold animate-pulse";
                      } else if (isNext) {
                        itemBg = "bg-[#1A1B1F]/60 text-gray-200 border border-[#2A2B2F]";
                        badge = "UP NEXT";
                        badgeClass = "bg-[#2A2B2F] text-cyan-400 border border-cyan-500/20";
                      } else {
                        itemBg = "opacity-40 text-gray-600";
                        badge = "ANTREAN";
                        badgeClass = "bg-[#0A0B0D] text-gray-600 border border-[#2A2B2F]/30";
                      }

                      return (
                        <div 
                          key={idx} 
                          id={`teleprompter-line-${idx}`}
                          className={`flex items-center justify-between gap-3 p-2 rounded-sm text-[11px] transition-all duration-300 ${itemBg}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`font-mono text-[9px] px-1 py-0.2 rounded-sm ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-500'}`}>
                              {(idx + 1).toString().padStart(2, '0')}
                            </span>
                            <span className="truncate font-sans tracking-wide">
                              {line}
                            </span>
                          </div>
                          <span className={`font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${badgeClass}`}>
                            {badge}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Auto-Tap Mode Selection Toggle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-[#151619] border border-[#2A2B2F] p-3 rounded-sm">
                    <div className="flex flex-col items-start gap-0.5 text-left">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-white font-semibold flex items-center gap-1.5">
                        <Sparkles className={`w-3.5 h-3.5 ${isAutoTapping ? "text-emerald-400 animate-pulse" : "text-cyan-400"}`} />
                        Ketukan Otomatis (Auto-Tap)
                      </span>
                      <span className="text-[9px] text-gray-400">
                        Sistem akan mengetuk otomatis sesuai baris lirik & lagu
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        const newAuto = !isAutoTapping;
                        setIsAutoTapping(newAuto);
                        if (newAuto) {
                          addLog("Mengaktifkan simulasi ketukan otomatis (Auto-Tap)!", "success");
                          const totalDuration = audioMetadata ? audioMetadata.duration : 30;
                          const computed = await computeAutoTapTimestamps(tappingLyrics, totalDuration);
                          setAutoTapTimestamps(computed);
                        } else {
                          addLog("Beralih ke mode ketukan manual.", "info");
                        }
                      }}
                      className={`px-3 py-1.5 text-[9px] font-mono uppercase font-black tracking-widest rounded-sm border transition-all cursor-pointer ${
                        isAutoTapping 
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.15)] font-bold animate-pulse" 
                          : "bg-[#1E1F22] text-gray-400 border-[#2A2B2F] hover:text-white"
                      }`}
                    >
                      {isAutoTapping ? "ON" : "OFF"}
                    </button>
                  </div>

                  {isAutoTapping && (
                    <div className="bg-[#0A0B0D] border border-[#2A2B2F] p-3 rounded-sm space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-gray-400">
                          Metode Sinkronisasi Presisi
                        </span>
                        {isAligningAI && (
                          <span className="text-[8px] font-mono text-cyan-400 animate-pulse uppercase">
                            Menghitung AI...
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={async () => {
                            setAutoTapMethod('vad');
                            addLog("Mengubah metode Auto-Tap: Pintar (VAD Vocal)", "info");
                            const totalDuration = audioMetadata ? audioMetadata.duration : 30;
                            const computed = await computeAutoTapTimestamps(tappingLyrics, totalDuration);
                            setAutoTapTimestamps(computed);
                          }}
                          className={`py-1.5 text-[9px] font-mono rounded-sm border transition-all cursor-pointer ${
                            autoTapMethod === 'vad'
                              ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-bold"
                              : "bg-[#1E1F22] text-gray-400 border-transparent hover:text-white"
                          }`}
                          title="Menyinkronkan ketukan otomatis langsung ke awal setiap jeda vokal/suara aktif (Offline)"
                        >
                          Pintar (VAD)
                        </button>
                        <button
                          onClick={async () => {
                            setAutoTapMethod('ai');
                            addLog("Mengubah metode Auto-Tap: AI Sync Gemini", "info");
                            const totalDuration = audioMetadata ? audioMetadata.duration : 30;
                            setIsAligningAI(true);
                            try {
                              const response = await fetch('/api/align', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  text: tappingLyrics.join('\n'),
                                  segments: segments.map(s => ({ id: s.id, start: s.start, end: s.end }))
                                })
                              });
                              const data = await response.json();
                              if (response.ok && data.segments && Array.isArray(data.segments)) {
                                addLog('Penyelarasan AI selesai dengan sukses!', 'success');
                                const timestamps = data.segments.map((s: any) => s.start);
                                const lastSeg = data.segments[data.segments.length - 1];
                                timestamps.push(lastSeg.end);
                                setAutoTapTimestamps(timestamps);
                              } else {
                                throw new Error(data.error || 'Respon penyelarasan AI tidak valid.');
                              }
                            } catch (e: any) {
                              addLog(`Penyelarasan AI gagal: ${e.message || e}. Menggunakan mode Pintar (VAD).`, 'error');
                            } finally {
                              setIsAligningAI(false);
                            }
                          }}
                          disabled={isAligningAI}
                          className={`py-1.5 text-[9px] font-mono rounded-sm border transition-all cursor-pointer ${
                            autoTapMethod === 'ai'
                              ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-bold"
                              : "bg-[#1E1F22] text-gray-400 border-transparent hover:text-white disabled:opacity-50"
                          }`}
                          title="Menggunakan server-side AI Gemini untuk mendistribusikan ketukan super presisi"
                        >
                          AI Sync
                        </button>
                        <button
                          onClick={async () => {
                            setAutoTapMethod('proportional');
                            addLog("Mengubah metode Auto-Tap: Proporsional Karakter", "info");
                            const totalDuration = audioMetadata ? audioMetadata.duration : 30;
                            const lineLengths = tappingLyrics.map(line => Math.max(1, line.replace(/\s+/g, '').length));
                            const totalLen = lineLengths.reduce((a, b) => a + b, 0);
                            const startOffset = 0.1;
                            const endOffset = 0.2;
                            const availableDuration = Math.max(1, totalDuration - startOffset - endOffset);
                            const timestamps: number[] = [startOffset];
                            let runningSum = startOffset;
                            for (let i = 0; i < tappingLyrics.length; i++) {
                              const proportion = lineLengths[i] / totalLen;
                              const segmentDuration = proportion * availableDuration;
                              runningSum += segmentDuration;
                              timestamps.push(parseFloat(runningSum.toFixed(2)));
                            }
                            setAutoTapTimestamps(timestamps);
                          }}
                          className={`py-1.5 text-[9px] font-mono rounded-sm border transition-all cursor-pointer ${
                            autoTapMethod === 'proportional'
                              ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-bold"
                              : "bg-[#1E1F22] text-gray-400 border-transparent hover:text-white"
                          }`}
                          title="Membagi waktu secara merata berdasarkan jumlah huruf setiap lirik"
                        >
                          Rata (Char)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cue Instructions Card */}
                <div className="bg-[#0A0B0D] border border-[#2A2B2F] rounded-sm p-3 text-center space-y-1">
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                    {tappedTimestamps.length === 1 ? "Ketukan Pertama" : `Ketukan #${tappedTimestamps.length - 1}`}
                  </p>
                  <p className="text-[11px] font-mono text-cyan-400 font-bold animate-pulse uppercase">
                    {isAutoTapping ? (
                      <span className="text-emerald-400">● [AUTO-TAP AKTIF] Menyinkronkan lirik otomatis seiring pemutaran...</span>
                    ) : (
                      <>
                        {tappedTimestamps.length === 1 && `Ketuk Spasi saat baris pertama selesai: "${tappingLyrics[0]}"`}
                        {tappedTimestamps.length > 1 && tappedTimestamps.length < tappingLyrics.length + 1 && `Ketuk Spasi untuk baris berikutnya: "${tappingLyrics[tappedTimestamps.length - 1]}"`}
                        {tappedTimestamps.length === tappingLyrics.length + 1 && 'Semua baris selesai disinkronisasikan!'}
                      </>
                    )}
                  </p>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-[#151619] h-1 rounded-full overflow-hidden mt-2">
                    <div 
                      className="bg-cyan-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(Math.min(tappingLyrics.length + 1, tappedTimestamps.length) / (tappingLyrics.length + 1)) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Giant Tap Button */}
                <button
                  onClick={handleTapNext}
                  disabled={isAutoTapping || tappedTimestamps.length >= tappingLyrics.length + 1}
                  className={`w-full py-6 text-xs font-mono font-black uppercase tracking-widest rounded-sm transition-all flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                    isAutoTapping 
                      ? "bg-emerald-950/20 text-emerald-500 border border-emerald-500/30 shadow-none animate-pulse cursor-not-allowed" 
                      : "bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-[#0E0F11] shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                  }`}
                >
                  {isAutoTapping ? (
                    <>
                      <span className="text-[10px] tracking-wider opacity-80 font-bold">MODE AUTO-TAP AKTIF</span>
                      <span>TAP OTOMATIS BERJALAN...</span>
                      <span className="text-[9px] uppercase tracking-widest font-normal opacity-70 mt-1">Sistem Sedang Mengetuk Untuk Anda</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] tracking-wider opacity-80 font-bold">KETUK DI SINI</span>
                      <span>TAP SEKARANG!</span>
                      <span className="text-[9px] uppercase tracking-widest font-normal opacity-70 mt-1">Atau Tekan [TOMBOL SPASI]</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-2 pt-4 border-t border-[#2A2B2F] mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleTapBack}
                    disabled={isAutoTapping || tappedTimestamps.length <= 1}
                    className="py-1.5 px-3 bg-[#2A2B2F] hover:bg-[#36373C] text-white text-[10px] font-mono font-bold uppercase rounded-sm transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Batalkan ketukan terakhir dan re-sync baris sebelumnya"
                  >
                    <ArrowLeft className="w-3 h-3 text-cyan-400" />
                    Batal Terakhir
                  </button>
                  <button
                    onClick={() => {
                      setTappedTimestamps([0]);
                      setCurrentTime(0);
                      playFrom(0);
                      addLog("Proses ketukan otomatis / manual diulang dari awal", "warning");
                    }}
                    className="py-1.5 px-3 bg-[#2A2B2F] hover:bg-[#36373C] text-orange-400 hover:text-orange-300 text-[10px] font-mono font-bold uppercase rounded-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Ulangi mengetuk dari baris pertama"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Tapping
                  </button>
                </div>

                <button
                  onClick={() => {
                    setIsTappingMode(false);
                    stopCurrentPlayback();
                    addLog("Keluar dari mode Tapper Sync", "info");
                  }}
                  className="w-full py-1.5 bg-[#1A1B1F] hover:bg-[#25262B] text-gray-400 hover:text-white text-[10px] font-mono font-bold uppercase rounded-sm transition-colors flex items-center justify-center gap-1 cursor-pointer border border-[#2A2B2F]"
                >
                  Keluar Mode Tapper
                </button>
              </div>
            </div>
          ) : (
            /* Left Block: Lyrics input & text controls */
            <div className="lg:col-span-2 bg-[#121316] border border-[#2A2B2F] rounded-sm p-6 shadow-lg flex flex-col justify-between min-h-[380px]">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2A2B2F] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
                    <span className="font-mono text-[10px] uppercase tracking-widest font-semibold text-white">Source Script / Lyrics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      id="text-file-upload" 
                      accept=".txt,.lrc" 
                      onChange={handleTextFileUpload} 
                      className="hidden" 
                    />
                    <label 
                      htmlFor="text-file-upload" 
                      className="text-[9px] bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 border border-white/5 px-2.5 py-1 rounded-sm cursor-pointer transition-colors flex items-center gap-1 font-mono uppercase tracking-wider"
                      title="Impor lirik/teks mentah (.txt, .lrc)"
                    >
                      <FolderOpen className="w-3 h-3 text-cyan-500" />
                      Import LRC/TXT
                    </label>

                    <input 
                      type="file" 
                      id="srt-import-upload" 
                      accept=".srt" 
                      onChange={handleSrtFileUpload} 
                      className="hidden" 
                    />
                    <label 
                      htmlFor="srt-import-upload" 
                      className="text-[9px] bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 border border-white/5 px-2.5 py-1 rounded-sm cursor-pointer transition-colors flex items-center gap-1 font-mono uppercase tracking-wider"
                      title="Impor subtitle .srt untuk otomatis memotong audio sesuai timestamp"
                    >
                      <FileText className="w-3 h-3 text-cyan-500" />
                      Import .SRT (Auto-Split)
                    </label>
                  </div>
                </div>

                <textarea
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  placeholder="Paste lirik lagu, teks naskah, atau naskah naskah dialog di sini (satu baris kalimat per potongan)..."
                  className="w-full h-56 bg-[#0A0B0D] border border-[#2A2B2F] rounded-sm p-3 text-xs font-mono focus:border-cyan-500 focus:outline-none leading-relaxed text-[#E0E0E0] resize-none"
                />
              </div>

              <div className="space-y-3 pt-4 border-t border-[#2A2B2F]">
                {/* Quick adjustment sliders for VAD & Tapper latency */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1 font-mono uppercase tracking-wider">VAD Sensitivity</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="-60" 
                        max="-20" 
                        value={silenceThreshold} 
                        onChange={(e) => setSilenceThreshold(parseInt(e.target.value))}
                        className="w-full accent-cyan-500 h-1 bg-[#2A2B2F] rounded-full appearance-none cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-cyan-400 w-8 text-right">{silenceThreshold}dB</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1 font-mono uppercase tracking-wider">Min Silence</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="0.2" 
                        max="2.0" 
                        step="0.1"
                        value={minSilenceDuration} 
                        onChange={(e) => setMinSilenceDuration(parseFloat(e.target.value))}
                        className="w-full accent-cyan-500 h-1 bg-[#2A2B2F] rounded-full appearance-none cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-cyan-400 w-8 text-right">{minSilenceDuration}s</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1 font-mono uppercase tracking-wider" title="Latency offset compensation in seconds">Tapper Compensation</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="-0.5" 
                        max="0.5" 
                        step="0.01"
                        value={latencyOffset} 
                        onChange={(e) => setLatencyOffset(parseFloat(e.target.value))}
                        className="w-full accent-cyan-500 h-1 bg-[#2A2B2F] rounded-full appearance-none cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-cyan-400 w-12 text-right">{(latencyOffset * 1000).toFixed(0)}ms</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-2 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleManualVADTrigger}
                      className="w-full py-2 bg-[#2A2B2F] hover:bg-[#36373C] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/5"
                      title="Deteksi keheningan secara otomatis untuk menentukan posisi segmen dasar"
                    >
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      Scan Silence
                    </button>
                    <button
                      onClick={handleAIAlyricAlignment}
                      className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-[#0E0F11] text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                      title="Minta Gemini AI untuk mencocokkan baris naskah/lirik dengan waveform audio"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Align
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <button
                      onClick={handleProportionalSplit}
                      className="w-full py-2 bg-[#1A1B1F] hover:bg-[#25262B] text-cyan-400 hover:text-cyan-300 text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-cyan-500/20"
                      title="Solusi Handal: Jika VAD kurang pas, bagi durasi audio secara proporsional sesuai jumlah baris teks"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                      Bagi Rata Sesuai Teks
                    </button>
                    <button
                      onClick={startTappingMode}
                      className="w-full py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-[#0E0F11] text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                      title="Sinkronisasi lirik manual presisi tinggi dengan mengetuk tombol spasi seiring lagu diputar"
                    >
                      <Clock className="w-3.5 h-3.5 text-[#0E0F11]" />
                      Live Tapper Sync
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right Block: Interactive segment table & editor */}
          <div className="lg:col-span-3 bg-[#121316] border border-[#2A2B2F] rounded-sm p-6 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#2A2B2F] pb-3 mb-4">
                <span className="font-mono text-[10px] uppercase tracking-widest font-semibold text-white">Review Timeline Editor</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      // Pre-populate with existing filenames if empty to make editing convenient,
                      // but separated by newlines
                      const existingNames = segments.map(s => {
                        // strip segment id prefix if present so user sees clean names
                        const clean = s.filename.replace(/^\d+_/i, '');
                        return clean;
                      }).join('\n');
                      setBulkRenameText(existingNames);
                      setShowBulkRenameModal(true);
                    }}
                    className="text-[10px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded-sm font-mono uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
                    title="Masukkan daftar nama file secara massal untuk diterapkan pada masing-masing output"
                  >
                    <Edit3 className="w-3 h-3 text-cyan-400" />
                    Rename Masal
                  </button>
                  <span className="text-xs text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded-sm border border-cyan-500/20">
                    {segments.length} Segments
                  </span>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[290px] pr-1 space-y-2">
                {segments.length > 0 ? (
                  segments.map((seg) => {
                    const isSelected = seg.id === selectedSegmentId;
                    const isPlaying = seg.id === playingSegmentId;
                    return (
                      <div
                        key={seg.id}
                        onClick={() => setSelectedSegmentId(seg.id)}
                        className={`border rounded-sm p-3 transition-all flex flex-col gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/5 border-cyan-500 shadow-inner'
                            : 'bg-[#0A0B0D] border-[#2A2B2F] hover:bg-[#151619] hover:border-[#36373C]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-[#1A1B1F] border border-[#2A2B2F] text-cyan-400 font-mono px-2 py-0.5 rounded-sm uppercase tracking-wider">
                              ID {seg.id.toString().padStart(3, '0')}
                            </span>
                            <div className="flex items-center gap-1">
                              {isPlaying ? (
                                !isPlaybackPaused ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      pauseSegment();
                                    }}
                                    className="p-1.5 rounded-sm cursor-pointer transition-colors bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                                    title="Pause segmen ini"
                                  >
                                    <Pause className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      resumeSegment(seg);
                                    }}
                                    className="p-1.5 rounded-sm cursor-pointer transition-colors bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                    title="Lanjutkan segmen ini"
                                  >
                                    <Play className="w-3 h-3 fill-emerald-400 text-emerald-400" />
                                  </button>
                                )
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playSegment(seg);
                                  }}
                                  className="p-1.5 rounded-sm cursor-pointer transition-colors bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                                  title="Putar segmen ini"
                                >
                                  <Play className="w-3 h-3 fill-cyan-400 text-cyan-400" />
                                </button>
                              )}

                              {isPlaying && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    stopSegment(seg);
                                  }}
                                  className="p-1.5 rounded-sm cursor-pointer transition-colors bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                                  title="Stop segmen ini dan reset ke awal"
                                >
                                  <Square className="w-3 h-3 fill-rose-400 text-rose-400" />
                                </button>
                              )}
                            </div>

                            {/* Timing indicators */}
                            <div className="flex items-center gap-1 text-[11px] font-mono text-gray-400">
                              <div className="flex items-center gap-0.5 bg-white/5 px-1 py-0.5 rounded-sm">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={seg.start}
                                  onChange={(e) => handleUpdateSegmentTimes(seg.id, parseFloat(e.target.value), seg.end)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-11 bg-transparent border-none focus:outline-none text-center text-white"
                                  title="Waktu mulai (detik)"
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateSegmentTimes(seg.id, currentTime, seg.end);
                                  }}
                                  className="p-0.5 hover:bg-white/10 text-cyan-400 hover:text-cyan-300 rounded transition-colors cursor-pointer"
                                  title="Atur awal ke playhead saat ini"
                                >
                                  <MapPin className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <span className="text-gray-600">-</span>
                              <div className="flex items-center gap-0.5 bg-white/5 px-1 py-0.5 rounded-sm">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={seg.end}
                                  onChange={(e) => handleUpdateSegmentTimes(seg.id, seg.start, parseFloat(e.target.value))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-11 bg-transparent border-none focus:outline-none text-center text-white"
                                  title="Waktu akhir (detik)"
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateSegmentTimes(seg.id, seg.start, currentTime);
                                  }}
                                  className="p-0.5 hover:bg-white/10 text-cyan-400 hover:text-cyan-300 rounded transition-colors cursor-pointer"
                                  title="Atur akhir ke playhead saat ini"
                                >
                                  <MapPin className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <span className="text-gray-500">({(seg.end - seg.start).toFixed(2)}s)</span>
                            </div>
                          </div>

                          {/* Quick Segment Slicing Actions */}
                          <div className="flex items-center gap-1.5 self-end">
                            {currentTime > seg.start && currentTime < seg.end && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  splitSegmentAtPlayhead(seg.id, currentTime);
                                }}
                                className="p-1 hover:bg-[#2A2B2F] text-gray-400 hover:text-yellow-400 rounded-sm transition-colors cursor-pointer"
                                title="Potong segmen ini di posisi playhead saat ini"
                              >
                                <Scissors className="w-3.5 h-3.5 text-yellow-500" />
                              </button>
                            )}
                            {seg.id < segments.length && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  mergeSegmentWithNext(seg.id);
                                }}
                                className="p-1 hover:bg-[#2A2B2F] text-gray-400 hover:text-cyan-400 rounded-sm transition-colors cursor-pointer"
                                title="Gabung dengan baris berikutnya"
                              >
                                <Merge className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSegment(seg.id);
                                }}
                              className="p-1 hover:bg-[#2A2B2F] text-[#4B5563] hover:text-orange-500 rounded-sm transition-colors cursor-pointer"
                              title="Hapus segmen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Editable Segment Text & output filename */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          <input
                            type="text"
                            value={seg.text}
                            onChange={(e) => handleUpdateSegmentText(seg.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0E0F11] border border-[#2A2B2F] rounded-sm px-2.5 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none w-full"
                            placeholder="Teks lirik / subtitle..."
                          />
                          <div className="flex items-center gap-1 bg-[#0E0F11] border border-[#2A2B2F] rounded-sm px-2 py-0.5">
                            <span className="text-[10px] text-cyan-500 font-mono uppercase">Out:</span>
                            <input
                              type="text"
                              value={seg.filename || ''}
                              onChange={(e) => handleUpdateSegmentFilename(seg.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-transparent text-xs text-white focus:outline-none w-full font-mono text-[11px]"
                              placeholder="nama_file_output"
                            />
                            <span className="text-[10px] text-gray-500 font-mono font-bold">.{exportFormat.toLowerCase()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 text-gray-500 text-[11px] font-mono uppercase tracking-wider">
                    No segments detected. Use VAD scan or AI align to generate slices.
                  </div>
                )}
              </div>
            </div>

            {/* Precision Calibration Dashboard */}
            {selectedSegmentId !== null && segments.find(s => s.id === selectedSegmentId) && (() => {
              const seg = segments.find(s => s.id === selectedSegmentId)!;
              return (
                <div className="mt-4 bg-[#141517] border border-cyan-500/20 rounded-sm p-4 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between border-b border-[#2A2B2F] pb-2">
                    <div className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-white">Precision Calibration [Segmen #{seg.id}]</span>
                    </div>
                    <button
                      onClick={() => {
                        playSegment(seg);
                        addLog(`Memutar loop segmen #${seg.id}...`, 'info');
                      }}
                      className="px-2 py-0.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 text-[9px] font-mono uppercase tracking-wider rounded-sm transition-all"
                    >
                      Loop Playback
                    </button>
                  </div>

                  <p className="text-[11px] font-sans text-gray-300 bg-[#0A0B0D] p-2 border border-[#2A2B2F] rounded-sm italic truncate">
                    "{seg.text}"
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Start Time Fine Tuning */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-wider">
                        <span className="text-gray-400">Waktu Mulai (Start)</span>
                        <span className="text-cyan-400 font-bold">{seg.start.toFixed(2)}s</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleUpdateSegmentTimes(seg.id, seg.start - 0.5, seg.end)}
                          className="flex-1 py-1 bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 text-[10px] font-mono rounded-sm hover:text-white transition-colors cursor-pointer"
                          title="Kurang 0.5 detik"
                        >
                          -0.5
                        </button>
                        <button
                          onClick={() => handleUpdateSegmentTimes(seg.id, seg.start - 0.1, seg.end)}
                          className="flex-1 py-1 bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 text-[10px] font-mono rounded-sm hover:text-white transition-colors cursor-pointer"
                          title="Kurang 0.1 detik"
                        >
                          -0.1
                        </button>
                        <button
                          onClick={() => handleUpdateSegmentTimes(seg.id, seg.start - 0.01, seg.end)}
                          className="flex-1 py-1 bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 text-[9px] font-mono rounded-sm hover:text-white transition-colors cursor-pointer"
                          title="Kurang 0.01 detik (milidetik!)"
                        >
                          -0.01
                        </button>
                        <button
                          onClick={() => handleUpdateSegmentTimes(seg.id, seg.start + 0.01, seg.end)}
                          className="flex-1 py-1 bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 text-[9px] font-mono rounded-sm hover:text-white transition-colors cursor-pointer"
                          title="Tambah 0.01 detik (milidetik!)"
                        >
                          +0.01
                        </button>
                        <button
                          onClick={() => handleUpdateSegmentTimes(seg.id, seg.start + 0.1, seg.end)}
                          className="flex-1 py-1 bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 text-[10px] font-mono rounded-sm hover:text-white transition-colors cursor-pointer"
                          title="Tambah 0.1 detik"
                        >
                          +0.1
                        </button>
                        <button
                          onClick={() => handleUpdateSegmentTimes(seg.id, seg.start + 0.5, seg.end)}
                          className="flex-1 py-1 bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 text-[10px] font-mono rounded-sm hover:text-white transition-colors cursor-pointer"
                          title="Tambah 0.5 detik"
                        >
                          +0.5
                        </button>
                      </div>
                      <button
                        onClick={() => handleUpdateSegmentTimes(seg.id, currentTime, seg.end)}
                        className="w-full py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Tempel waktu mulai ke posisi jarum saat ini"
                      >
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        Set Start to Playhead ({currentTime.toFixed(2)}s)
                      </button>
                    </div>

                    {/* End Time Fine Tuning */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-wider">
                        <span className="text-gray-400">Waktu Akhir (End)</span>
                        <span className="text-cyan-400 font-bold">{seg.end.toFixed(2)}s</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleUpdateSegmentTimes(seg.id, seg.start, seg.end - 0.5)}
                          className="flex-1 py-1 bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 text-[10px] font-mono rounded-sm hover:text-white transition-colors cursor-pointer"
                          title="Kurang 0.5 detik"
                        >
                          -0.5
                        </button>
                        <button
                          onClick={() => handleUpdateSegmentTimes(seg.id, seg.start, seg.end - 0.1)}
                          className="flex-1 py-1 bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 text-[10px] font-mono rounded-sm hover:text-white transition-colors cursor-pointer"
                          title="Kurang 0.1 detik"
                        >
                          -0.1
                        </button>
                        <button
                          onClick={() => handleUpdateSegmentTimes(seg.id, seg.start, seg.end - 0.01)}
                          className="flex-1 py-1 bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 text-[9px] font-mono rounded-sm hover:text-white transition-colors cursor-pointer"
                          title="Kurang 0.01 detik (milidetik!)"
                        >
                          -0.01
                        </button>
                        <button
                          onClick={() => handleUpdateSegmentTimes(seg.id, seg.start, seg.end + 0.01)}
                          className="flex-1 py-1 bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 text-[9px] font-mono rounded-sm hover:text-white transition-colors cursor-pointer"
                          title="Tambah 0.01 detik (milidetik!)"
                        >
                          +0.01
                        </button>
                        <button
                          onClick={() => handleUpdateSegmentTimes(seg.id, seg.start, seg.end + 0.1)}
                          className="flex-1 py-1 bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 text-[10px] font-mono rounded-sm hover:text-white transition-colors cursor-pointer"
                          title="Tambah 0.1 detik"
                        >
                          +0.1
                        </button>
                        <button
                          onClick={() => handleUpdateSegmentTimes(seg.id, seg.start, seg.end + 0.5)}
                          className="flex-1 py-1 bg-[#2A2B2F] hover:bg-[#36373C] text-gray-300 text-[10px] font-mono rounded-sm hover:text-white transition-colors cursor-pointer"
                          title="Tambah 0.5 detik"
                        >
                          +0.5
                        </button>
                      </div>
                      <button
                        onClick={() => handleUpdateSegmentTimes(seg.id, seg.start, currentTime)}
                        className="w-full py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Tempel waktu akhir ke posisi jarum saat ini"
                      >
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        Set End to Playhead ({currentTime.toFixed(2)}s)
                      </button>
                    </div>
                  </div>

                  {/* Cross-Segment Alignment Helpers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        const prevSeg = segments.find(s => s.id === seg.id - 1);
                        if (prevSeg) {
                          handleUpdateSegmentTimes(seg.id, prevSeg.end, seg.end);
                          addLog(`Menyejajarkan awal segmen #${seg.id} dengan akhir segmen #${prevSeg.id}.`, 'info');
                        } else {
                          alert("Ini adalah segmen pertama.");
                        }
                      }}
                      disabled={seg.id === 1}
                      className="py-1.5 bg-[#1A1B1F] hover:bg-[#25262B] border border-[#2A2B2F] text-gray-400 hover:text-white text-[10px] font-mono uppercase rounded-sm flex items-center justify-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Rapatkan waktu mulai segmen ini dengan akhir segmen sebelumnya agar tidak ada gap sunyi"
                    >
                      Snap to Previous Segment
                    </button>
                    <button
                      onClick={() => {
                        const nextSeg = segments.find(s => s.id === seg.id + 1);
                        if (nextSeg) {
                          handleUpdateSegmentTimes(seg.id, seg.start, nextSeg.start);
                          addLog(`Memperluas akhir segmen #${seg.id} ke awal segmen #${nextSeg.id}.`, 'info');
                        } else {
                          const maxDuration = audioMetadata ? audioMetadata.duration : 30;
                          handleUpdateSegmentTimes(seg.id, seg.start, maxDuration);
                        }
                      }}
                      className="py-1.5 bg-[#1A1B1F] hover:bg-[#25262B] border border-[#2A2B2F] text-gray-400 hover:text-white text-[10px] font-mono uppercase rounded-sm flex items-center justify-center gap-1 cursor-pointer"
                      title="Perpanjang waktu akhir segmen ini agar rapat menempel dengan waktu mulai segmen berikutnya"
                    >
                      Auto-Extend to Next
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Bottom Actions of timeline box */}
            <div className="flex justify-between items-center pt-4 border-t border-[#2A2B2F] mt-4">
              <button
                onClick={addNewSegment}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2A2B2F] border border-white/5 hover:bg-[#36373C] text-white text-xs font-mono uppercase tracking-wider rounded-sm transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-500" />
                Add Segment
              </button>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wide">
                Drag bounds on interactive waveform to edit bounds
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: Slicing Output Settings & Export Engine */}
        <div className="bg-[#121316] border border-[#2A2B2F] rounded-sm p-6 shadow-lg">
          <div className="flex items-center gap-2 border-b border-[#2A2B2F] pb-3 mb-5">
            <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
            <span className="font-mono text-[10px] uppercase tracking-widest font-semibold text-white">Slicing Engine Config & Audio Formats</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400 block font-mono uppercase tracking-wider">Output File Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="w-full bg-[#0A0B0D] border border-[#2A2B2F] rounded-sm p-2 text-xs text-white focus:border-cyan-500 focus:outline-none cursor-pointer font-mono"
              >
                <option value="WAV">WAV (Lossless 16-bit PCM)</option>
                <option value="MP3">MP3 (MPEG Layer-3 Audio)</option>
                <option value="OGG">OGG (Ogg PCM Container)</option>
                <option value="FLAC">FLAC (Free Lossless Audio Codec)</option>
                <option value="AAC">AAC/M4A (Apple AAC Standard)</option>
              </select>
            </div>

            {exportFormat === 'MP3' ? (
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 block font-mono uppercase tracking-wider">MP3 Bitrate Quality</label>
                <select
                  value={mp3Bitrate}
                  onChange={(e) => setMp3Bitrate(parseInt(e.target.value))}
                  className="w-full bg-[#0A0B0D] border border-[#2A2B2F] rounded-sm p-2 text-xs text-white focus:border-cyan-500 focus:outline-none cursor-pointer font-mono"
                >
                  <option value={128}>128 kbps (Standard)</option>
                  <option value={192}>192 kbps (Medium High Quality)</option>
                  <option value={256}>256 kbps (Premium Fidelity)</option>
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoNumbering}
                    onChange={(e) => setAutoNumbering(e.target.checked)}
                    className="rounded-sm bg-[#0A0B0D] border-[#2A2B2F] text-cyan-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs text-gray-300 font-mono uppercase tracking-wide">Prefix Auto Number</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={removeSpecialChars}
                    onChange={(e) => setRemoveSpecialChars(e.target.checked)}
                    className="rounded-sm bg-[#0A0B0D] border-[#2A2B2F] text-cyan-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs text-gray-300 font-mono uppercase tracking-wide">Strip Special Chars</span>
                </label>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[10px] text-gray-400 block font-mono uppercase tracking-wider">Encoder Quality Preset</span>
              <span className="text-xs text-white font-mono bg-[#0A0B0D] border border-[#2A2B2F] px-3 py-2 rounded-sm block">
                {exportFormat === 'WAV' && '44.1kHz / 16-bit Lossless Copy'}
                {exportFormat === 'MP3' && `LameJS ${mp3Bitrate}kbps CBR`}
                {exportFormat === 'OGG' && 'OggS Encapsulated PCM'}
                {exportFormat === 'FLAC' && 'FLAC Lossless Stream 16-bit'}
                {exportFormat === 'AAC' && 'M4A CoreAudio Container'}
              </span>
            </div>

            <div className="space-y-2">
              {exportFormat === 'MP3' && (
                <div className="flex gap-4 mb-1">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoNumbering}
                      onChange={(e) => setAutoNumbering(e.target.checked)}
                      className="rounded-sm bg-[#0A0B0D] border-[#2A2B2F] text-cyan-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-[9px] text-gray-400 font-mono uppercase">Prefix Num</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={removeSpecialChars}
                      onChange={(e) => setRemoveSpecialChars(e.target.checked)}
                      className="rounded-sm bg-[#0A0B0D] border-[#2A2B2F] text-cyan-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-[9px] text-gray-400 font-mono uppercase">Strip Chars</span>
                  </label>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button
                  onClick={triggerAudioSlicingExport}
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-[#0E0F11] text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(6,182,212,0.4)] cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#0E0F11]" />
                  Slice & Export (.zip)
                </button>
                <button
                  onClick={exportSrtSubtitleFile}
                  className="w-full py-2 bg-[#1A1B1F] hover:bg-[#25262B] border border-[#2A2B2F] text-cyan-400 hover:text-cyan-300 text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  title="Ekspor berkas subtitle .srt siap upload ke youtube"
                >
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Export Subtitles (.srt)
                </button>
              </div>
            </div>
          </div>

          {/* Export Progress Bar */}
          {exportProgress !== null && (
            <div className="mt-5 space-y-2 bg-[#0A0B0D] border border-[#2A2B2F] rounded-sm p-4 animate-waves">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-cyan-400 font-bold flex items-center gap-1.5 uppercase tracking-wider">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  {exportStatus}
                </span>
                <span className="font-mono text-cyan-400 font-bold">{exportProgress}%</span>
              </div>
              <div className="w-full bg-[#151619] h-2 rounded-sm overflow-hidden">
                <div 
                  className="bg-[#06B6D4] h-full rounded-sm transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Row 5: Live Activity Logger Panel */}
        <div className="bg-[#121316] border border-[#2A2B2F] rounded-sm p-4 shadow-md font-mono text-[11px] leading-normal text-gray-400 space-y-2">
          <div className="flex items-center gap-2 text-white border-b border-[#2A2B2F] pb-2 mb-2 font-mono font-bold uppercase tracking-widest text-xs">
            <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_6px_#06B6D4]"></div>
            <span>Processing Chain Logs</span>
          </div>
          <div className="overflow-y-auto max-h-[90px] space-y-1 pr-1">
            {logs.map((log, idx) => (
              <div key={idx} className="flex gap-2.5 items-start">
                <span className="text-gray-500">[{log.time}]</span>
                <span className={`px-1.5 py-0.2 rounded-sm text-[9px] uppercase font-bold font-mono ${
                  log.type === 'success' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                  log.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  log.type === 'warning' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                  'bg-[#1A1B1F] text-gray-400 border border-[#2A2B2F]'
                }`}>
                  {log.type}
                </span>
                <span className="text-[#E0E0E0] flex-1 font-mono">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Row 6: Companion Python Desktop Code Panel */}
        <PythonCompanion />

      </main>

      {/* Footer Banner */}
      <footer className="border-t border-[#2A2B2F] bg-[#151619] mt-16 py-8 px-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto space-y-2 font-mono uppercase tracking-widest text-[10px]">
          <p>AcousticSplit AI — Companion Desktop Edition.</p>
          <p className="opacity-40">© 2026 Production-Ready Software Suite. Dirancang dengan presisi visual dan performa lossless.</p>
        </div>
      </footer>

      {/* Bulk Rename Modal Overlay */}
      {showBulkRenameModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#121316] border border-cyan-500/35 rounded-sm max-w-xl w-full p-6 shadow-[0_0_40px_rgba(6,182,212,0.3)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2A2B2F] pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-xs uppercase tracking-widest font-black text-white">Import Nama File Masal</span>
              </div>
              <button
                onClick={() => setShowBulkRenameModal(false)}
                className="text-gray-400 hover:text-white font-mono text-[10px] cursor-pointer px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded-sm transition-colors"
              >
                ✕ TUTUP
              </button>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-gray-300">
                Tempel (Copy-Paste) seluruh nama file yang sudah Anda siapkan di bawah ini. Pastikan <strong className="text-cyan-400">satu baris</strong> hanya berisi <strong className="text-cyan-400">satu nama file</strong>.
              </p>
              <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                Sistem akan memetakan baris-baris ini secara berurutan: Baris 1 untuk Segmen #1, Baris 2 untuk Segmen #2, dst. Ekstensi file kustom akan disesuaikan otomatis dengan format ekspor pilihan Anda.
              </p>
            </div>

            <textarea
              value={bulkRenameText}
              onChange={(e) => setBulkRenameText(e.target.value)}
              placeholder="Contoh:&#10;rekaman_pembuka_audio&#10;bait_satu_lagu&#10;bait_dua_lagu&#10;reff_paduan_suara&#10;outro_selesai"
              className="w-full h-44 bg-[#0A0B0D] border border-[#2A2B2F] rounded-sm p-3 text-xs font-mono focus:border-cyan-500 focus:outline-none leading-relaxed text-cyan-100 placeholder-gray-700 resize-none"
            />

            <div className="p-3 bg-[#1A1B1F] border border-[#2A2B2F] rounded-sm space-y-2">
              <span className="text-[9px] font-mono uppercase text-gray-400 block tracking-wider font-bold">Pilihan Aturan Penamaan:</span>
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoNumbering}
                    onChange={(e) => setAutoNumbering(e.target.checked)}
                    className="rounded-sm bg-[#0A0B0D] border-[#2A2B2F] text-cyan-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-[10px] text-gray-300 font-mono uppercase tracking-wide">Prefix Nomor Otomatis (01_, 02_)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={removeSpecialChars}
                    onChange={(e) => setRemoveSpecialChars(e.target.checked)}
                    className="rounded-sm bg-[#0A0B0D] border-[#2A2B2F] text-cyan-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-[10px] text-gray-300 font-mono uppercase tracking-wide">Saring Karakter Khusus & Spasi</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowBulkRenameModal(false);
                  setBulkRenameText('');
                }}
                className="px-4 py-2 bg-[#2A2B2F] hover:bg-[#36373C] text-white text-xs font-mono uppercase tracking-wider rounded-sm transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleBulkRename}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-[#0E0F11] text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer"
              >
                Terapkan Massal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseSrtTimestampToSeconds(timeStr: string): number {
  // Format: HH:MM:SS,mmm or HH:MM:SS.mmm
  const regex = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;
  const match = timeStr.match(regex);
  if (!match) {
    const simpleRegex = /(\d{2}):(\d{2}):(\d{2})/;
    const simpleMatch = timeStr.match(simpleRegex);
    if (simpleMatch) {
      const [, h, m, s] = simpleMatch;
      return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
    }
    const floatSec = parseFloat(timeStr);
    return isNaN(floatSec) ? 0 : floatSec;
  }
  const [, h, m, s, ms] = match;
  return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10) + parseInt(ms, 10) / 1000;
}

function parseSrtContent(srtText: string): AudioSegment[] {
  const segmentsList: AudioSegment[] = [];
  const cleanText = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = cleanText.split(/\n\s*\n/);
  
  let idCounter = 1;
  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) continue;
    
    let timeLineIdx = 0;
    if (/^\d+$/.test(lines[0])) {
      timeLineIdx = 1;
    }
    
    const timeLine = lines[timeLineIdx];
    if (!timeLine || !timeLine.includes('-->')) continue;
    
    const parts = timeLine.split('-->').map(p => p.trim());
    if (parts.length !== 2) continue;
    
    const startSec = parseSrtTimestampToSeconds(parts[0]);
    const endSec = parseSrtTimestampToSeconds(parts[1]);
    
    if (isNaN(startSec) || isNaN(endSec)) continue;
    
    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines.join(' ');
    
    const cleanTxtForFilename = text.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15);
    
    segmentsList.push({
      id: idCounter,
      text: text,
      start: parseFloat(startSec.toFixed(2)),
      end: parseFloat(endSec.toFixed(2)),
      confidence: 100,
      filename: `${idCounter.toString().padStart(2, '0')}_${cleanTxtForFilename}`
    });
    
    idCounter++;
  }
  
  return segmentsList;
}
