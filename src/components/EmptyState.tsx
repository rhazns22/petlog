import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  title, 
  description, 
  actionLabel, 
  onAction,
  icon = "/images/empty-pet.png" 
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
    >
      <div className="relative mb-6">
        <motion.div
          animate={{ 
            y: [0, -10, 0],
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="w-40 h-40 md:w-56 md:h-56 rounded-full bg-gradient-to-b from-[#E9FBF5] to-transparent flex items-center justify-center overflow-hidden"
        >
          <img 
            src={icon} 
            alt="Empty state illustration" 
            className="w-full h-full object-contain opacity-80"
          />
        </motion.div>
        
        {/* Decorative elements */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute -top-4 -right-4 w-8 h-8 bg-[#12B886] rounded-full blur-xl"
        />
        <motion.div 
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, delay: 1 }}
          className="absolute -bottom-6 -left-6 w-12 h-12 bg-[#20C997] rounded-full blur-xl"
        />
      </div>

      <h3 className="text-xl font-black text-[#191F28] mb-2 tracking-tight">
        {title}
      </h3>
      <p className="text-sm font-medium text-[#8B95A1] mb-8 max-w-[240px] leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 bg-[#12B886] text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-[#12B886]/10 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
};

export default EmptyState;
