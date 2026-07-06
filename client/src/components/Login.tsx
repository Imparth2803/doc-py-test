import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { motion } from 'motion/react';
import { FileStack, Sparkles } from 'lucide-react';

export function Login() {
  const { login: appLogin } = useApp();

  const googleLoginTrigger = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        console.log('Google Auth Code:', codeResponse.code);
        const response = await axios.post(
          'http://localhost:8000/api/auth/google',
          {
            code: codeResponse.code,
          }
        );

        console.log('Backend Response:', response.data);
        appLogin(response.data.token, response.data.user);
      } catch (error) {
        console.error('Google Login Failed', error);
      }
    },
    flow: 'auth-code',
    scope: 'openid profile email',
  });

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
            DMS
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

          <div className="w-full flex justify-center">
            <button
              onClick={() => googleLoginTrigger()}
              className="flex items-center justify-center gap-3 bg-white text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-300 font-bold px-6 py-3 rounded-2xl shadow-sm hover:shadow transition-all active:scale-[0.98] w-full cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>
          <div className="mt-8 text-center text-xs text-gray-400">
            Secure, structured, and private.
          </div>
        </div>
        </motion.div>
      </div>
    );
}
