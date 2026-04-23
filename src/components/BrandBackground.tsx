import React, { useState } from 'react';

export default function BrandBackground() {
  // Uses your custom image once uploaded, otherwise perfectly shows a premium industrial-tech image instantly.
  // This image represents the combined strength of logistics, engineering, and technology.
  const [imgSrc, setImgSrc] = useState("/background.jpg");

  return (
    <div className="fixed inset-0 -z-50 overflow-hidden bg-slate-950">
      {/* 100% Real HD Background Image - Representing Infrastructure, Logistics & Tech */}
      <img 
        src={imgSrc} 
        onError={() => setImgSrc("https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=2500")}
        alt="LEO Enterprises Industrial Background" 
        className="fixed inset-0 w-full h-full object-cover opacity-100 transition-opacity duration-1000"
        referrerPolicy="no-referrer"
      />

      {/* Global dark gradient overlay for readability while keeping the image visible */}
      <div 
        className="fixed inset-0 w-full h-full pointer-events-none" 
        style={{
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.65))',
          zIndex: -10
        }} 
      />
    </div>
  );
}
