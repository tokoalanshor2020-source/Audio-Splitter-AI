import React, { useRef, useEffect, useState } from 'react';
import { AudioSegment } from '../types';
import { Sliders, ZoomIn, ZoomOut } from 'lucide-react';

interface WaveformViewProps {
  audioBuffer: AudioBuffer | null;
  segments: AudioSegment[];
  currentTime: number;
  selectedSegmentId: number | null;
  onSelectSegment: (id: number) => void;
  onUpdateSegmentTimes: (id: number, start: number, end: number) => void;
  onSeek: (time: number) => void;
  isDemo?: boolean;
}

export default function WaveformView({
  audioBuffer,
  segments,
  currentTime,
  selectedSegmentId,
  onSelectSegment,
  onUpdateSegmentTimes,
  onSeek,
  isDemo = false,
}: WaveformViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1); // Zoom level from 1x to 15x
  const [draggedHandle, setDraggedHandle] = useState<{ id: number; type: 'start' | 'end' } | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<{ id: number; type: 'start' | 'end' } | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);

  // Auto-scroll to follow playhead when zoomed
  useEffect(() => {
    if (zoom === 1 || !scrollContainerRef.current || !canvasRef.current) return;
    const scrollContainer = scrollContainerRef.current;
    const canvas = canvasRef.current;
    const duration = isDemo ? 30 : (audioBuffer ? audioBuffer.duration : 0);
    if (duration <= 0) return;

    const playheadRatio = currentTime / duration;
    const canvasWidth = canvas.getBoundingClientRect().width;
    const targetScrollLeft = playheadRatio * canvasWidth - scrollContainer.clientWidth / 2;

    // Smooth scroll following the playhead
    scrollContainer.scrollLeft = Math.max(0, targetScrollLeft);
  }, [currentTime, zoom, isDemo, audioBuffer]);

  // Generate peaks dynamically based on zoom level to increase visual resolution!
  useEffect(() => {
    const peakResolution = Math.floor(250 * zoom);

    if (isDemo) {
      // Mock wave peaks for immediate zero-file discovery with dynamic resolution
      const mockPeaks = Array.from({ length: peakResolution }, (_, i) => {
        const sin1 = Math.sin(i * 0.05) * 0.4;
        const sin2 = Math.sin(i * 0.2) * 0.3;
        const noise = (Math.random() - 0.5) * 0.15;
        // make speech-like silent gaps
        const gap = i % 45 < 10 ? 0.02 : 1;
        return Math.max(0.01, (Math.abs(sin1 + sin2) + noise) * gap);
      });
      setPeaks(mockPeaks);
      return;
    }

    if (!audioBuffer) {
      setPeaks([]);
      return;
    }

    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / peakResolution);
    const generatedPeaks: number[] = [];

    for (let i = 0; i < peakResolution; i++) {
      let maxVal = 0;
      const startIdx = i * step;
      const endIdx = Math.min(startIdx + step, channelData.length);
      for (let j = startIdx; j < endIdx; j++) {
        const val = Math.abs(channelData[j]);
        if (val > maxVal) maxVal = val;
      }
      generatedPeaks.push(maxVal);
    }

    // Normalize peaks
    const maxPeak = Math.max(...generatedPeaks, 0.001);
    const normalized = generatedPeaks.map(p => p / maxPeak);
    setPeaks(normalized);
  }, [audioBuffer, isDemo, zoom]);

  const duration = isDemo ? 30 : (audioBuffer ? audioBuffer.duration : 0);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear background
    ctx.fillStyle = '#0E0F11';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = '#1F2023';
    ctx.lineWidth = 1;
    const numGridLines = 10 * zoom;
    for (let x = 0; x < width; x += width / numGridLines) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw waveform bars
    if (peaks.length > 0) {
      const barWidth = width / peaks.length;
      const centerY = height / 2;

      peaks.forEach((peak, index) => {
        const barHeight = peak * (height - 40);
        const x = index * barWidth;
        const y = centerY - barHeight / 2;

        // Color based on active playhead
        const barTime = (index / peaks.length) * duration;
        const isPlayed = barTime <= currentTime;

        // Check if bar falls inside any active segment
        let isInSegment = false;
        let isSelected = false;
        segments.forEach(seg => {
          if (barTime >= seg.start && barTime <= seg.end) {
            isInSegment = true;
            if (seg.id === selectedSegmentId) {
              isSelected = true;
            }
          }
        });

        // Determine bar colors
        if (isSelected) {
          ctx.fillStyle = isPlayed ? '#06B6D4' : '#0891b2'; // Cyan
        } else if (isInSegment) {
          ctx.fillStyle = isPlayed ? '#10B981' : '#047857'; // Emerald
        } else {
          ctx.fillStyle = isPlayed ? '#4B5563' : '#1F2937'; // Slate
        }

        ctx.fillRect(x + 1, y, barWidth - 1, barHeight);
      });
    } else {
      // Draw placeholder guide
      ctx.fillStyle = '#4B5563';
      ctx.textAlign = 'center';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('Unggah file audio untuk menganalisis dan memvisualisasikan waveform...', width / 2, height / 2);
    }

    // Draw segments colored overlay
    segments.forEach(seg => {
      const xStart = (seg.start / duration) * width;
      const xEnd = (seg.end / duration) * width;
      const isSelected = seg.id === selectedSegmentId;

      ctx.fillStyle = isSelected 
        ? 'rgba(6, 182, 212, 0.12)' // Cyan overlay
        : 'rgba(16, 185, 129, 0.05)'; // Emerald overlay

      ctx.fillRect(xStart, 0, xEnd - xStart, height);

      // Draw bounding lines
      ctx.strokeStyle = isSelected ? '#06B6D4' : '#10B981';
      ctx.lineWidth = isSelected ? 2.5 : 1.2;

      // Start line
      ctx.beginPath();
      ctx.moveTo(xStart, 0);
      ctx.lineTo(xStart, height);
      ctx.stroke();

      // End line
      ctx.beginPath();
      ctx.moveTo(xEnd, 0);
      ctx.lineTo(xEnd, height);
      ctx.stroke();

      // Draw handle flags at the top for easier clicking
      ctx.fillStyle = isSelected ? '#06B6D4' : '#10B981';
      ctx.fillRect(xStart - 5, 0, 10, 12);
      ctx.fillRect(xEnd - 5, 0, 10, 12);

      // Label segment ID on start handle flag
      ctx.fillStyle = '#0E0F11';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(seg.id.toString(), xStart, 9);
    });

    // Draw Current Time Playhead
    if (duration > 0) {
      const xPlayhead = (currentTime / duration) * width;
      ctx.strokeStyle = '#ef4444'; // bright red
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xPlayhead, 0);
      ctx.lineTo(xPlayhead, height);
      ctx.stroke();

      // Playhead triangle top
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(xPlayhead - 8, 0);
      ctx.lineTo(xPlayhead + 8, 0);
      ctx.lineTo(xPlayhead, 10);
      ctx.fill();
    }
  }, [peaks, segments, currentTime, selectedSegmentId, duration, zoom]);

  // Handle Mouse Down for dragging or seeking
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (duration === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickTime = (clickX / rect.width) * duration;

    // Check if clicked near a handle (start/end lines of any segment)
    // Dynamic handle threshold based on zoom
    const handleThreshold = 10; // pixels
    for (const seg of segments) {
      const startX = (seg.start / duration) * rect.width;
      const endX = (seg.end / duration) * rect.width;

      if (Math.abs(clickX - startX) < handleThreshold) {
        setDraggedHandle({ id: seg.id, type: 'start' });
        onSelectSegment(seg.id);
        return;
      }
      if (Math.abs(clickX - endX) < handleThreshold) {
        setDraggedHandle({ id: seg.id, type: 'end' });
        onSelectSegment(seg.id);
        return;
      }
    }

    // Check if clicked inside a segment to select it
    for (const seg of segments) {
      if (clickTime >= seg.start && clickTime <= seg.end) {
        onSelectSegment(seg.id);
        onSeek(clickTime);
        return;
      }
    }

    // Default seek
    onSeek(clickTime);
  };

  // Handle Mouse Move for hover indicators and dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (duration === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const moveX = e.clientX - rect.left;

    if (draggedHandle) {
      // Dragging a handle
      const newTime = Math.max(0, Math.min(duration, (moveX / rect.width) * duration));
      const targetSeg = segments.find(s => s.id === draggedHandle.id);
      if (targetSeg) {
        if (draggedHandle.type === 'start') {
          // Keep start before end
          const startVal = parseFloat(Math.min(newTime, targetSeg.end - 0.01).toFixed(2));
          onUpdateSegmentTimes(draggedHandle.id, startVal, targetSeg.end);
        } else {
          // Keep end after start
          const endVal = parseFloat(Math.max(newTime, targetSeg.start + 0.01).toFixed(2));
          onUpdateSegmentTimes(draggedHandle.id, targetSeg.start, endVal);
        }
      }
      return;
    }

    // Hover handle detection
    const handleThreshold = 10;
    let foundHover = false;
    for (const seg of segments) {
      const startX = (seg.start / duration) * rect.width;
      const endX = (seg.end / duration) * rect.width;

      if (Math.abs(moveX - startX) < handleThreshold) {
        setHoveredHandle({ id: seg.id, type: 'start' });
        foundHover = true;
        break;
      }
      if (Math.abs(moveX - endX) < handleThreshold) {
        setHoveredHandle({ id: seg.id, type: 'end' });
        foundHover = true;
        break;
      }
    }

    if (!foundHover) {
      setHoveredHandle(null);
    }
  };

  const handleMouseUp = () => {
    setDraggedHandle(null);
  };

  return (
    <div className="bg-[#151619] border border-[#2A2B2F] rounded-sm p-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)] select-none">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"></div>
          <span className="font-mono text-xs uppercase font-semibold tracking-wider text-white">Interactive Zoom Waveform Editor</span>
          {isDemo && (
            <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px] px-2 py-0.5 rounded-sm font-mono uppercase">
              Demo Mode
            </span>
          )}
        </div>

        {/* High-fidelity visual control toolbar */}
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          {/* Zoom controls */}
          <div className="flex items-center gap-2 bg-[#0E0F11] border border-[#2A2B2F] rounded-sm px-2.5 py-1 text-[10px] font-mono">
            <span className="text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <ZoomOut className="w-3 h-3 text-gray-500" />
              Scale
            </span>
            <input
              type="range"
              min="1"
              max="15"
              step="1"
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value))}
              className="w-20 sm:w-28 accent-cyan-500 h-1 bg-[#2A2B2F] rounded-full appearance-none cursor-pointer"
              title="Perbesar waveform untuk pemotongan sangat presisi"
            />
            <span className="text-cyan-400 font-bold w-6 text-right flex items-center gap-0.5">
              {zoom}x
              <ZoomIn className="w-3 h-3 text-cyan-400" />
            </span>
          </div>

          <div className="flex gap-4 text-[10px] font-mono uppercase tracking-wider text-gray-400 ml-auto sm:ml-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
              <span>Segments</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]"></span>
              <span>Selected</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative group">
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-cyan-500 scrollbar-track-[#0A0B0D] max-w-full pb-2"
        >
          {/* Dynamic width scaling based on zoom parameter */}
          <div style={{ width: `${zoom * 100}%`, minWidth: '100%' }}>
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ width: '100%' }}
              className={`h-44 rounded-sm border border-[#2A2B2F] transition-shadow duration-300 ${
                hoveredHandle || draggedHandle ? 'cursor-col-resize bg-[#0E0F11]/90' : 'cursor-pointer bg-[#0E0F11]'
              }`}
            />
          </div>
        </div>
        
        {/* Absolute indicators */}
        <div className="absolute left-2 bottom-4 bg-[#151619]/95 border border-[#2A2B2F] rounded-sm px-2.5 py-1 text-[10px] font-mono text-cyan-400 shadow-md">
          Playhead: <span className="text-white font-bold">{currentTime.toFixed(3)}s</span> / {duration.toFixed(3)}s
          {zoom > 1 && <span className="text-gray-500 text-[9px] ml-1 uppercase"> (Scroll left/right to view)</span>}
        </div>
      </div>
    </div>
  );
}
