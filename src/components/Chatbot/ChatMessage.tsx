
import React, { useState, useEffect } from 'react';
import { Bot, User, Heart, Frown, Smile, Meh, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    image_url?: string;
    emotion_detected?: string;
    created_at: string;
  };
}

const EmotionIcon = ({ emotion }: { emotion?: string }) => {
  if (!emotion) return null;

  const icons = {
    happy: <Smile className="w-4 h-4 text-green-500" />,
    sad: <Frown className="w-4 h-4 text-blue-500" />,
    angry: <AlertCircle className="w-4 h-4 text-red-500" />,
    anxious: <AlertCircle className="w-4 h-4 text-yellow-500" />,
    confused: <Meh className="w-4 h-4 text-gray-500" />
  };

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {icons[emotion as keyof typeof icons] || <Heart className="w-4 h-4" />}
      <span className="capitalize">{emotion}</span>
    </div>
  );
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isFullyDisplayed, setIsFullyDisplayed] = useState(isUser); // User messages show immediately
  
  // Simulate typing effect for AI messages
  useEffect(() => {
    if (isUser) {
      setDisplayedText(message.content);
      return;
    }
    
    // Reset state when message changes
    setDisplayedText('');
    setIsFullyDisplayed(false);
    
    if (!message.content) return;
    
    // Calculate typing speed based on content length
    // Shorter response = faster typing, longer = slightly slower
    const baseSpeed = 15; // base ms per character
    const speedFactor = Math.max(1, Math.min(3, message.content.length / 500));
    const typingSpeed = baseSpeed * speedFactor;
    
    let currentIndex = 0;
    setIsTyping(true);
    
    // Start typing effect with a small initial delay
    const typingTimer = setTimeout(() => {
      const intervalId = setInterval(() => {
        if (currentIndex < message.content.length) {
          setDisplayedText(message.content.substring(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsTyping(false);
          setIsFullyDisplayed(true);
          clearInterval(intervalId);
        }
      }, typingSpeed);
      
      return () => clearInterval(intervalId);
    }, 300);
    
    return () => clearTimeout(typingTimer);
  }, [message.content, isUser]);
  
  return (
    <div className={cn(
      'flex gap-3 mb-6 animate-fadeIn',
      isUser ? 'justify-end' : 'justify-start'
    )}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}
      
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3 break-words',
        isUser 
          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
          : 'bg-muted/50 border border-border/50'
      )}>
        {message.image_url && (
          <div className="mb-3">
            <img 
              src={message.image_url} 
              alt="User uploaded image" 
              className="max-w-full h-auto rounded-lg border border-border/20"
            />
          </div>
        )}
        
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {displayedText}
          {isTyping && (
            <span className="inline-block animate-pulse">▊</span>
          )}
        </div>
        
        {isFullyDisplayed && message.emotion_detected && (
          <div className="mt-2 pt-2 border-t border-border/20">
            <EmotionIcon emotion={message.emotion_detected} />
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
