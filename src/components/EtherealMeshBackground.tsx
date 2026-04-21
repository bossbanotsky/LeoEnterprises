import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';

export default function EtherealMeshBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        containerRef.current.style.setProperty('--mouse-x', `${e.clientX}px`);
        containerRef.current.style.setProperty('--mouse-y', `${e.clientY}px`);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-slate-50 dark:bg-slate-950"
      style={{ '--mouse-x': '50%', '--mouse-y': '50%' } as any}
    >
      {/* Animated Mesh Blobs - Reduced blur for better mobile performance */}
      <motion.div
        className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-900/20 blur-[80px] will-change-transform"
        animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute top-[20%] right-[5%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 dark:bg-indigo-900/20 blur-[100px] will-change-transform"
        animate={{ x: [0, -30, 0], y: [0, 50, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute -bottom-[10%] left-[20%] w-[40%] h-[40%] rounded-full bg-violet-400/10 dark:bg-violet-900/20 blur-[60px] will-change-transform"
        animate={{ x: [0, 30, 0], y: [0, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      />

      {/* Grain Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04] pointer-events-none" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>

      {/* Ambient Spotlight - Using CSS Variables to avoid React Re-renders */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          background: `radial-gradient(400px at var(--mouse-x) var(--mouse-y), rgba(59, 130, 246, 0.04), transparent 80%)`,
        }}
      />
    </div>
  );
}
