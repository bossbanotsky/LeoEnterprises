import React from 'react';
import { motion } from 'motion/react';

interface InteractiveProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Interactive = ({ children, className = "", onClick }: InteractiveProps) => {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className={`cursor-pointer ${className}`}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
};
