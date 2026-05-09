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
      className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden select-none touch-none"
      style={{ height: '100dvh' }}
    >
      {/* Header Overlay */}
      <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-center z-30 pointer-events-none">
        <button 
          onClick={() => { stopCamera(); onClose(); }}
          className="p-3 bg-black/40 text-white rounded-full backdrop-blur-md border border-white/10 active:scale-95 transition-all pointer-events-auto"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Camera Viewport */}
      <div className="flex-1 relative bg-slate-950 overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center w-full h-full relative z-10">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6">
              <X className="w-8 h-8 text-rose-500" />
            </div>
            <p className="text-white font-black text-sm mb-8 leading-relaxed max-w-xs">{error}</p>
            <button 
              onClick={startCamera}
              className="px-8 py-3 bg-white text-slate-900 rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
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
            className="w-full h-full object-contain" 
          />
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <RefreshCw className="w-8 h-8 text-white/20 animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Control Bar Overlay - Absolutely positioned at bottom with safe area padding */}
      <div className="absolute bottom-6 inset-x-0 px-6 flex flex-col items-center z-40">
        {!error && (
          <div className="flex items-center justify-center w-full max-w-sm">
            {!capturedImage ? (
              <div className="relative">
                <div className="absolute -inset-6 bg-white/10 rounded-full blur-3xl animate-pulse" />
                <button 
                  onClick={capturePhoto}
                  disabled={!stream || isStarting}
                  className="relative w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.3)] active:scale-90 transition-all disabled:opacity-20 z-10"
                >
                  <div className="w-16 h-16 rounded-full border-[6px] border-slate-950 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-slate-950" />
                  </div>
                </button>
              </div>
            ) : (
              <div className="flex gap-4 w-full bg-black/60 backdrop-blur-xl p-4 rounded-[40px] border border-white/10 shadow-2xl">
                <button 
                  onClick={handleRetake}
                  className="flex-1 flex items-center justify-center gap-2 h-14 bg-white/10 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest border border-white/20 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                  Retake
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-[1.8] flex items-center justify-center gap-2 h-14 bg-blue-600 text-white rounded-3xl font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-blue-500/40 active:scale-95 transition-all"
                >
                  <Check className="w-5 h-5" />
                  Use Photo
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
