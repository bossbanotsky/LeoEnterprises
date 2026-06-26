import React from 'react';

export default function BrandBackground() {
  return (
    <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-stone-950 transition-colors duration-500">
      {/* New high-resolution L&P logo centered globally as primary background */}
      <img
        src="/src/assets/images/lp_background_logo_1782471044742.jpg"
        alt="L & P Trading and Services Logo"
        className="w-full h-full object-cover opacity-[0.08] transition-all duration-700 select-none scale-105 filter blur-[1px]"
        referrerPolicy="no-referrer"
      />
      {/* Dark vignette gradient overlay to ensure perfect readability of text on top */}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950 via-stone-950/80 to-stone-950" />
    </div>
  );
}

