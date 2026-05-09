import React, { useRef, useState, useCallback } from 'react';
import { Camera, X, Check, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const startCamera = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    try {
      // Explicitly stop previous tracks if any
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        } 
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Force play and handle metadata
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(err => {
            console.error('Video play error:', err);
            setError('Could not start video playback.');
          });
        };
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please enable camera permissions.');
      } else {
        setError('Could not access camera. Please ensure no other app is using it.');
      }
      console.error('Camera error:', err);
    } finally {
      setIsStarting(false);
    }
  }, [stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Target dimensions for compression
      const MAX_DIM = 1024;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height) {
        if (width > MAX_DIM) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        }
      } else {
        if (height > MAX_DIM) {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        // High quality but highly compressed JPG
        const base64 = canvas.toDataURL('image/jpeg', 0.5);
        setCapturedImage(base64);
        stopCamera();
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleSave = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  React.useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden"
      style={{ height: '100dvh' }}
    >
      <div className="absolute inset-0 w-full h-full flex items-center justify-center">
        {error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-950 w-full h-full">
            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-6">
              <X className="w-10 h-10 text-rose-500" />
            </div>
            <p className="text-white font-black text-lg mb-8 leading-relaxed max-w-xs">{error}</p>
            <button 
              onClick={startCamera}
              className="px-10 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-200 active:scale-95 transition-all"
            >
              Retry Camera
            </button>
          </div>
        ) : capturedImage ? (
          <motion.img 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            src={capturedImage} 
            alt="Captured" 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-6">
                  <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin" />
                  <span className="text-xs font-black text-white uppercase tracking-[0.4em] animate-pulse">Loading Camera</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls Overlay - Compact horizontal bar */}
      <div className="absolute inset-x-0 bottom-0 pb-8 pt-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col items-center z-20">
        {!error && (
          <div className="flex items-center justify-around w-full max-w-md px-6">
            <button 
              onClick={() => { stopCamera(); onClose(); }}
              className="w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all border border-white/10 active:scale-90"
            >
              <X className="w-5 h-5" />
            </button>

            {!capturedImage ? (
              <div className="relative">
                <div className="absolute -inset-4 bg-white/20 rounded-full blur-2xl animate-pulse" />
                <button 
                  onClick={capturePhoto}
                  disabled={!stream || isStarting}
                  className="relative w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-90 transition-all disabled:opacity-20"
                >
                  <div className="w-16 h-16 rounded-full border-[4px] border-slate-950 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-slate-950" />
                  </div>
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button 
                  onClick={handleRetake}
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest border border-white/20 hover:bg-white/20 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake
                </button>
                <button 
                  onClick={handleSave}
                  className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-2xl shadow-blue-500/40 hover:bg-blue-500 active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
              </div>
            )}

            <div className="w-12 h-12" /> {/* Balanced spacer */}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
