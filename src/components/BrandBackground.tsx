import React from 'react';

export default function BrandBackground() {
  return (
    <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-slate-900 transition-colors duration-500">
      {/* Real background image, slightly darkened on dark mode, slightly brightened on light mode using mixing */}
      <img
        src="/src/assets/images/company_background_1781444172477.jpg"
        alt="L & P Trading and Services Background"
        className="absolute inset-0 w-full h-full object-cover opacity-60 dark:opacity-30 transition-opacity duration-500 will-change-transform scale-[1.02]"
        referrerPolicy="no-referrer"
      />
      
      {/* Light Mode Overlay */}
      <div className="absolute inset-0 bg-white/70 dark:hidden transition-opacity duration-500"></div>
      
      {/* Dark Mode Overlay */}
      <div className="absolute inset-0 bg-black/60 hidden dark:block transition-opacity duration-500"></div>

      {/* High-end slight vignette shadow effect around edges */}
      <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_150px_rgba(0,0,0,0.4)] pointer-events-none transition-shadow duration-500"></div>
    </div>
  );
}

