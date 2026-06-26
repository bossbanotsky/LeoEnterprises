import { LucideIcon } from 'lucide-react';
import { Button } from './button';
import { motion } from 'motion/react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = ''
}: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center p-8 text-center bg-black/40 border border-white/10 rounded-[30px] shadow-2xl backdrop-blur-sm ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-inner">
        <Icon className="w-8 h-8 text-white/40" />
      </div>
      <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">{title}</h3>
      <p className="text-sm font-medium text-white/50 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button 
          onClick={onAction}
          className="bg-white text-black hover:bg-white/90 font-bold uppercase tracking-widest text-[10px] h-10 px-6 rounded-xl"
        >
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
