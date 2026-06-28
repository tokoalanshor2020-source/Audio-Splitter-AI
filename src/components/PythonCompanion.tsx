import React, { useState } from 'react';
import { FileCode, Terminal, Download, Copy, Check, FileText } from 'lucide-react';
import { PYTHON_PROJECT_FILES } from '../data/pythonCode';
import JSZip from 'jszip';

export default function PythonCompanion() {
  const [selectedFile, setSelectedFile] = useState<string>('setup_instructions.md');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const code = PYTHON_PROJECT_FILES[selectedFile as keyof typeof PYTHON_PROJECT_FILES];
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    
    // Add all project files
    Object.entries(PYTHON_PROJECT_FILES).forEach(([filename, content]) => {
      zip.file(filename, content);
    });

    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'AudioSlicerPro-Python-Desktop.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal mendownload zip project python:", err);
    }
  };

  return (
    <div className="bg-[#151619] border border-[#2A2B2F] rounded-sm p-6 shadow-[0_4px_20px_rgba(0,0,0,0.5)] text-gray-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-[#2A2B2F] pb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-cyan-500 rounded-sm flex items-center justify-center text-[#0E0F11] font-bold italic tracking-tighter shrink-0 font-mono">PY</div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-white flex items-center gap-2">
              Python Desktop Companion
              <span className="text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded-sm">v1.2.0-OFFLINE</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Unduh atau jelajahi kode sumber aplikasi desktop Python mandiri yang dilengkapi GUI offline, pemrosesan audio, dan Whisper AI.
            </p>
          </div>
        </div>
        <button
          onClick={handleDownloadZip}
          className="px-4 py-1.5 rounded-sm bg-cyan-600 text-[#0E0F11] text-xs font-bold hover:bg-cyan-500 transition-colors cursor-pointer shrink-0 uppercase tracking-wider"
        >
          Download Python (.zip)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar file tree */}
        <div className="lg:col-span-1 space-y-1 bg-[#0E0F11] p-3 rounded-sm border border-[#2A2B2F]">
          <div className="text-[10px] font-mono font-bold uppercase text-cyan-500 mb-3 px-2 tracking-widest">
            Source Tree
          </div>
          {Object.keys(PYTHON_PROJECT_FILES).map((filename) => {
            const isSelected = selectedFile === filename;
            const isMd = filename.endsWith('.md');
            const isTxt = filename.endsWith('.txt');
            return (
              <button
                key={filename}
                onClick={() => {
                  setSelectedFile(filename);
                  setCopied(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-sm text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/10 text-cyan-400 font-bold border-l-2 border-cyan-500 pl-2.5'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                {isMd ? (
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                ) : isTxt ? (
                  <FileCode className="w-3.5 h-3.5 text-orange-500" />
                ) : (
                  <FileCode className="w-3.5 h-3.5 text-cyan-500" />
                )}
                <span className="font-mono text-[11px] truncate">{filename}</span>
              </button>
            );
          })}
        </div>

        {/* Code viewing window */}
        <div className="lg:col-span-3 flex flex-col h-[400px] border border-[#2A2B2F] rounded-sm overflow-hidden bg-[#0A0B0D]">
          <div className="flex justify-between items-center px-4 py-2 bg-[#151619] border-b border-[#2A2B2F]">
            <span className="font-mono text-xs text-white uppercase tracking-wider">{selectedFile}</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors cursor-pointer font-mono"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-bold">COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY CODE</span>
                </>
              )}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-[#E0E0E0]">
            <pre className="whitespace-pre">{PYTHON_PROJECT_FILES[selectedFile as keyof typeof PYTHON_PROJECT_FILES]}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
