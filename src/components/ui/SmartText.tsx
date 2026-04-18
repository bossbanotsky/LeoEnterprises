import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SmartTextProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  fallback?: boolean;
}

/**
 * A component that automatically detects its parent's background color 
 * and adjusts its text color for optimal contrast.
 */
export const SmartText: React.FC<SmartTextProps> = ({ 
  children, 
  className = '', 
  as: Tag = 'span',
  fallback = true,
  ...props 
}) => {
  const ref = useRef<HTMLElement>(null);
  const [color, setColor] = useState<'#ffffff' | '#111111' | 'inherit'>('inherit');

  useEffect(() => {
    const detectContrast = () => {
      if (!ref.current) return;
      
      let parent = ref.current.parentElement;
      let bg = 'transparent';
      
      // Traverse up to find a non-transparent background
      while (parent) {
        const style = window.getComputedStyle(parent);
        bg = style.backgroundColor;
        
        // If it's not transparent (rgba with alpha > 0), break
        const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
          const alpha = match[4] === undefined ? 1 : parseFloat(match[4]);
          if (alpha > 0.1) break; // Consider 0.1 alpha enough to influence color
        }
        
        parent = parent.parentElement;
      }

      if (bg && bg !== 'transparent') {
        const match = bg.match(/\d+/g);
        if (match) {
          const [r, g, b] = match.map(Number);
          
          // Relative luminance calculation
          const getL = (v: number) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          };
          
          const luminance = 0.2126 * getL(r) + 0.7152 * getL(g) + 0.0722 * getL(b);
          
          // W3C suggests 0.179 as the threshold, but 0.45 or 0.5 works better for UI readability
          setColor(luminance > 0.45 ? '#111111' : '#ffffff');
        }
      } else {
        // Fallback to theme default - assuming dark theme as per app design
        setColor('#ffffff');
      }
    };

    detectContrast();
    
    // Optional: Re-detect on window resize or theme change if relevant
    window.addEventListener('resize', detectContrast);
    return () => window.removeEventListener('resize', detectContrast);
  }, [children]); // Re-detect if children change as it might trigger layout shifts

  return (
    <Tag 
      ref={ref} 
      className={cn(fallback && 'text-contrast-safe', className)} 
      style={{ color: color === 'inherit' ? undefined : color }}
      {...props}
    >
      {children}
    </Tag>
  );
};
