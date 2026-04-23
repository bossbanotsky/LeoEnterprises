import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'motion/react';

export default function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent browser from showing default prompt
      e.preventDefault();
      // Store the event
      setInstallPrompt(e);
      // Show custom prompt after a delay
      setTimeout(() => setIsVisible(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    
    // Show system prompt
    installPrompt.prompt();
    
    // Wait for resolution
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted PWA install');
    }
    
    // Clear prompt state
    setInstallPrompt(null);
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 right-6 left-6 md:left-auto md:w-80 z-[100]"
        >
          <div className="bg-white/80 border border-white/40 shadow-2xl rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
            <div className="w-12 h-12 bg-blue-600/10 rounded-xl flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-900 text-sm">Install App</h4>
              <p className="text-xs text-slate-500 truncate">Use Leo Enterprises as an app</p>
            </div>
            <div className="flex flex-col gap-1">
              <Button 
                onClick={handleInstallClick}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold h-7 px-3 rounded-lg"
              >
                Install
              </Button>
              <button 
                onClick={() => setIsVisible(false)}
                className="text-[10px] text-slate-400 font-bold hover:text-slate-600 text-center uppercase tracking-wider"
              >
                Not now
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
