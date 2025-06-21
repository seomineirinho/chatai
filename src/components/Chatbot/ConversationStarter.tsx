import React, { useState, useRef } from 'react';
import { MessageSquarePlus, Brain, Sparkles, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ConversationStarterProps {
  onStartConversation: (message: string) => void;
  isLoading: boolean;
}

const ConversationStarter: React.FC<ConversationStarterProps> = ({
  onStartConversation,
  isLoading
}) => {
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleExpand = () => {
    setExpanded(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 300);
  };

  const handleCancel = () => {
    setExpanded(false);
    setMessage('');
  };

  const handleSubmit = () => {
    if (message.trim()) {
      onStartConversation(message);
      setMessage('');
      setExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <AnimatePresence mode="wait">
      <div className="w-full max-w-3xl mx-auto px-4 my-8">
        {!expanded ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 p-8 rounded-xl shadow-lg border border-purple-100 dark:border-slate-700"
          >
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 mb-2">
                Start a New Conversation
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                Begin a fresh dialogue with AI Assistant and explore new ideas together
              </p>
            </div>
            
            <Button
              onClick={handleExpand}
              size="lg"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <MessageSquarePlus className="w-5 h-5 mr-1" />
              Create New Conversation
            </Button>
            
            <div className="mt-6 grid grid-cols-3 gap-4 text-center text-sm">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                <Sparkles className="w-5 h-5 mx-auto mb-2 text-purple-500" />
                <p className="text-slate-600 dark:text-slate-300">Creative Ideas</p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                <Sparkles className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                <p className="text-slate-600 dark:text-slate-300">Knowledge Base</p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                <Sparkles className="w-5 h-5 mx-auto mb-2 text-indigo-500" />
                <p className="text-slate-600 dark:text-slate-300">Visual Analysis</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700"
          >
            <h3 className="text-lg font-medium mb-2 text-slate-800 dark:text-white">
              Name your conversation
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              This text will be used as the title for your new conversation
            </p>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a title or topic for this conversation... (Press Enter to create, Esc to cancel)"
              className="min-h-[80px] mb-4 resize-none focus:border-purple-400 dark:focus:border-purple-500"
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="px-4"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!message.trim() || isLoading}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Create Conversation
                  </span>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
};

export default ConversationStarter; 