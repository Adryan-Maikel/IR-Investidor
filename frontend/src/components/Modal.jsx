import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) {

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm"
        style={{ animation: 'backdropIn 0.2s ease forwards' }}
      />

      {/* Modal — centered, scales up from center-bottom */}
      <div
        className={`fixed z-[9999] w-full ${maxWidth} glass-modal rounded-2xl shadow-2xl flex flex-col max-h-[90vh]`}
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'modalIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          transformOrigin: 'center bottom',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.015] rounded-t-2xl">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/8 text-zinc-500 hover:text-white transition-all hover:rotate-90 duration-200"
            title="Fechar"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes backdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translate(-50%, -44%) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </>
  );
}
