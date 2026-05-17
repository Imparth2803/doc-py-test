import React from 'react';
import { useApp } from '../context/AppContext';
import { motion } from 'motion/react';
import { FileStack, Sparkles } from 'lucide-react';

export function Login() {
  const { login } = useApp();

  return (
    <div className="min-h-screen bg-[#f7f7f9] flex flex-col items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
             <FileStack size={32} strokeWidth={1.5} />
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-3">
            Life-Sync
          </h1>
          <p className="text-gray-500 mb-8 leading-relaxed text-base max-w-[280px]">
            The smarter way to organize your life's paperwork.
          </p>

          <div className="space-y-4 mb-10 w-full">
            <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-left">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white shrink-0">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-900 leading-tight">AI Auto-Filing</p>
                <p className="text-[10px] text-blue-700/70">Automatic categorization & tagging</p>
              </div>
            </div>
          </div>

          <button 
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 hover:bg-gray-800 text-white py-4 px-6 rounded-2xl font-semibold transition-all active:scale-[0.98] shadow-lg shadow-gray-200"
          >
            Sign in with Google
          </button>
        </div>
        
        <div className="mt-8 text-center text-xs text-gray-400">
          Secure, structured, and private.
        </div>
      </motion.div>
    </div>
  );
}
