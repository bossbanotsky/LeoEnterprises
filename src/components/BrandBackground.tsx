import React from 'react';

export default function BrandBackground() {
  return (
    <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-black transition-colors duration-500">
      {/* New high-resolution L&P logo centered globally as primary background */}
      <img
        src="/src/assets/images/lp_background_logo_1782471044742.jpg"
        alt="L & P Trading and Services Logo"
        className="w-full h-full object-cover transition-all duration-700"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

