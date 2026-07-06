import React from 'react';
import { X, MessageCircle, Mail, Download, Share2, Users, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Document } from '../types';
import { shareToWhatsApp, shareToEmail, shareToTeams, downloadDocument } from '../lib/shareUtils';
import { ContactSuggestion, getGoogleAccessToken, searchGoogleContacts } from '../utils/googleContacts';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
}

export function ShareModal({ isOpen, onClose, document: doc }: ShareModalProps) {
  const [isEmailMode, setIsEmailMode] = React.useState(false);
  const [emailInput, setEmailInput] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const [suggestions, setSuggestions] = React.useState<ContactSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [googleAccessToken, setGoogleAccessToken] = React.useState<string | null>(null);
  const [contactsForbidden, setContactsForbidden] = React.useState(false);
  const debounceRef = React.useRef<any>(null);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (isOpen) {
      getGoogleAccessToken().then(token => {
        setGoogleAccessToken(token);
      }).catch(err => {
        console.error('Failed to retrieve google token', err);
      });
    } else {
      setIsEmailMode(false);
      setEmailInput('');
      setIsSubmitting(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      setSuggestions([]);
      setShowDropdown(false);
      setContactsForbidden(false);
    }
  }, [isOpen]);

  if (!doc) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailInput || !emailRegex.test(emailInput.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await shareToEmail(doc, emailInput.trim());
      if (result.success) {
        setSuccessMessage('Email sent successfully!');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMessage(result.error || 'Failed to send email.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmailInput(value);
    setErrorMessage(null);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    if (!googleAccessToken) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { suggestions: results, status } = await searchGoogleContacts(value, googleAccessToken);
      if (status === 403) {
        setContactsForbidden(true);
        setSuggestions([]);
        setShowDropdown(false);
      } else {
        setContactsForbidden(false);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      }
    }, 300);
  };

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
      onClick: () => setIsEmailMode(true),
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

            {!isEmailMode ? (
              <>
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
                          if (option.id !== 'email') {
                            onClose();
                          }
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
              </>
            ) : (
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEmailMode(false);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ArrowLeft size={20} className="text-gray-600" />
                  </button>
                  <h3 className="text-lg font-bold text-gray-900">Send via Email</h3>
                </div>

                <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                  Enter the recipient's email address below to send the document as a real file attachment.
                </p>

                {errorMessage && (
                  <div className="bg-red-50 border border-red-100 text-red-600 px-3 py-2 rounded-xl text-xs font-semibold">
                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div className="bg-green-50 border border-green-100 text-green-600 px-3 py-2 rounded-xl text-xs font-semibold">
                    {successMessage}
                  </div>
                )}

                <div className="flex flex-col gap-1.5 relative">
                  <label htmlFor="recipient-email" className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Recipient Email
                  </label>
                  <input
                    id="recipient-email"
                    type="email"
                    placeholder="name@example.com"
                    value={emailInput}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    disabled={isSubmitting || !!successMessage}
                    className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 text-gray-800 w-full"
                    autoFocus
                    autoComplete="off"
                  />
                  {showDropdown && (
                    <ul className="absolute z-50 top-[70px] left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-50 py-1">
                      {suggestions.map((s, i) => (
                        <li
                          key={i}
                          onMouseDown={() => {
                            setEmailInput(s.email);
                            setShowDropdown(false);
                          }}
                          className="px-4 py-2.5 hover:bg-blue-50/50 cursor-pointer flex flex-col transition-colors text-left"
                        >
                          <span className="text-xs font-bold text-gray-800">{s.name}</span>
                          <span className="text-[10px] text-gray-400 font-medium">{s.email}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {contactsForbidden && (
                    <p className="text-[11px] text-gray-400 mt-1 font-medium pl-1 leading-normal text-left">
                      Connect Google Contacts for suggestions
                    </p>
                  )}
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEmailMode(false);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    disabled={isSubmitting}
                    className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors active:scale-95"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !!successMessage || !emailInput.trim()}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-1 shadow-md shadow-blue-500/10"
                  >
                    {isSubmitting ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
