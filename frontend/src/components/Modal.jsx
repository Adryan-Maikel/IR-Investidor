import React, { useEffect, useState, useRef } from 'react';
import { X, GripHorizontal, ChevronDown } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasPosition, setHasPosition] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const modalRef = useRef(null);

  // Center the modal on the screen when first opened
  useEffect(() => {
    if (isOpen && !hasPosition) {
      const width = maxWidth.includes('max-w-xl') ? 576 : maxWidth.includes('max-w-lg') ? 512 : 448;
      const x = Math.max(20, (window.innerWidth - width) / 2 + (Math.random() * 80 - 40));
      const y = Math.max(20, (window.innerHeight - 400) / 2 + (Math.random() * 80 - 40));
      setPosition({ x, y });
      setHasPosition(true);
    }
  }, [isOpen, hasPosition, maxWidth]);

  // Reset position cache when closed
  useEffect(() => {
    if (!isOpen) {
      setHasPosition(false);
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.modal-drag-handle')) {
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newX = Math.max(10, Math.min(e.clientX - dragStart.current.x, window.innerWidth - 100));
      const newY = Math.max(10, Math.min(e.clientY - dragStart.current.y, window.innerHeight - 100));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  return (
    <div 
      ref={modalRef}
      onMouseDown={handleMouseDown}
      style={{ 
        position: 'fixed', 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        zIndex: 9999 
      }}
      className={`w-full ${maxWidth} glass-modal rounded-2xl shadow-2xl flex flex-col max-h-[90vh] scale-100 ${isDragging ? '' : 'transition-all duration-300'} animate-fade-in select-none`}
    >
      {/* Header / Drag Handle */}
      <div className="modal-drag-handle flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02] cursor-grab active:cursor-grabbing rounded-t-2xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-zinc-500" />
          {title}
        </h3>
        <div className="flex items-center gap-1">
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Retornar aos Comandos"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 overflow-y-auto flex-1 select-text">
        {children}
      </div>
    </div>
  );
}
