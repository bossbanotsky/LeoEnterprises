import React from 'react';

export default function BrandBackground() {
  return (
    <div className="fixed inset-0 -z-20 overflow-hidden bg-[#050b18]">
      {/* Universal Industrial Base Overlay */}
      <img 
        src="https://images.unsplash.com/photo-1516937941344-00b4e0337589?auto=format&fit=crop&q=80&w=2070" 
        alt="Industrial Base" 
        className="fixed inset-0 w-full h-full object-cover opacity-20 pointer-events-none grayscale brightness-50"
        referrerPolicy="no-referrer"
      />

      {/* Brand Base Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#050b18]/60 via-[#0a192f]/40 to-[#050b18]/60" />
      
      {/* Decorative Brand Accent (Top Right) */}
      <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
      
      {/* Decorative Brand Accent (Bottom Left) */}
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[100px]" />

      {/* Grid Pattern for Industrial Feel */}
      <div className="absolute inset-0 opacity-[0.05]" 
           style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Modern Wave Graphic (Simulating the Arrow curve) */}
      <svg className="absolute bottom-0 left-0 w-full h-full opacity-[0.05] pointer-events-none" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M-100 800C200 700 400 400 1440 600V800H-100Z" fill="url(#cyan_grad)" />
        <defs>
          <linearGradient id="cyan_grad" x1="720" y1="400" x2="720" y2="800" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00d2ff" />
            <stop offset="1" stopColor="#00d2ff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Content Protection Layer (ensures dashboard text is always readable) */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[4px]" />
    </div>
  );
}
