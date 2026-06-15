import React from 'react';

export default function BrandBackground() {
  return (
    <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-slate-900 transition-colors duration-500">
      {/* Real background image */}
      <img
        src="/src/assets/images/company_background_1781444172477.jpg"
        alt="L & P Trading and Services Background"
        className="absolute inset-0 w-full h-full object-cover opacity-100 transition-opacity duration-500 will-change-transform scale-[1.02]"
        referrerPolicy="no-referrer"
      />
      
      {/* Optional: Add a light vignette to keep text readable if needed, but remove extreme darkened/lightened overlays */}
      <div className="absolute inset-0 bg-black/10 dark:bg-black/20 pointer-events-none transition-shadow duration-500"></div>
    </div>
  );
}

