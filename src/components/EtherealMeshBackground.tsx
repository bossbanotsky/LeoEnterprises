import { motion } from 'motion/react';
import { useState } from 'react';

export default function EtherealMeshBackground() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-slate-50 dark:bg-slate-950"
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
    >
      {/* Animated Mesh Blobs */}
      <motion.div
        className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-500/10 dark:bg-blue-900/20 blur-[100px]"
        animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[20%] right-[5%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 dark:bg-indigo-900/20 blur-[120px]"
        animate={{ x: [0, -50, 0], y: [0, 100, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-[10%] left-[20%] w-[40%] h-[40%] rounded-full bg-violet-400/10 dark:bg-violet-900/20 blur-[80px]"
        animate={{ x: [0, 50, 0], y: [0, -50, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Grain Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>

      {/* Ambient Spotlight */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px at ${mousePos.x}px ${mousePos.y}px, rgba(59, 130, 246, 0.05), transparent 80%)`,
        }}
      />
    </div>
  );
}
