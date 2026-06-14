import React from 'react';
import { X, MessageCircle, Mail, Download, Share2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Document } from '../types';
import { shareToWhatsApp, shareToEmail, shareToTeams, downloadDocument } from '../lib/shareUtils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
}

export function ShareModal({ isOpen, onClose, document: doc }: ShareModalProps) {
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!doc) return null;

  const shareOptions = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: <MessageCircle className="text-green-500" size={28} />,
      onClick: () => shareToWhatsApp(doc),
    },
    {
      id: 'email',
      label: 'Email',
      icon: <Mail className="text-blue-500" size={28} />,
      onClick: () => shareToEmail(doc),
    },
    {
      id: 'teams',
      label: 'Teams',
      icon: <Users className="text-indigo-500" size={28} />,
      onClick: () => shareToTeams(doc),
    },
    {
      id: 'download',
      label: 'Download PDF',
      icon: <Download className="text-gray-600" size={28} />,
      onClick: () => downloadDocument(doc),
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden p-8"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors z-20"
            >
              <X size={16} />
            </button>

            <div className="text-center mb-8">
               <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-4">
                  <Share2 size={24} />
               </div>
               <h3 className="text-xl font-bold text-gray-900">Share Document</h3>
               <p className="text-gray-500 text-sm mt-1 truncate px-4">{doc.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
               {shareOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      option.onClick();
                      onClose();
                    }}
                    className="flex flex-col items-center justify-center p-6 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all group active:scale-95"
                  >
                    <div className="mb-3 transform group-hover:scale-110 transition-transform">
                      {option.icon}
                    </div>
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{option.label}</span>
                  </button>
               ))}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
               <button 
                 onClick={onClose}
                 className="w-full py-3 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest"
               >
                 Close
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
