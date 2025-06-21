import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Tag } from 'lucide-react';

interface ConversationTransitionProps {
  visible: boolean;
  title?: string;
}

const ConversationTransition: React.FC<ConversationTransitionProps> = ({ 
  visible,
  title
}) => {
  if (!visible) return null;
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ 
          scale: [0.8, 1.05, 1],
          opacity: 1
        }}
        transition={{
          duration: 0.6,
          times: [0, 0.7, 1],
          ease: "easeInOut"
        }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 relative overflow-hidden"
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -inset-[10px] opacity-20 bg-gradient-to-tr from-purple-500 via-blue-500 to-pink-500 blur-3xl"></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex justify-center mb-3">
            <motion.div 
              animate={{ 
                rotate: [0, 15, -15, 0],
                scale: [1, 1.2, 1]
              }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              className="bg-gradient-to-br from-purple-500 to-blue-600 p-3 rounded-full"
            >
              <Tag className="w-8 h-8 text-white" />
            </motion.div>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-xl font-bold text-center mb-2">
              {title || "Creating Conversation"}
            </h3>
            
            <div className="flex justify-center space-x-2 mb-4">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                  className="w-3 h-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                />
              ))}
            </div>
            
            <p className="text-slate-600 dark:text-slate-300 text-center text-sm">
              Setting up your conversation with the given title
            </p>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ConversationTransition; 