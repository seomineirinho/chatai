
import React, { useState, useRef, ChangeEvent } from 'react';
import { Send, Image, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string, imageFile?: File) => void;
  isLoading: boolean;
  isDisabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  isLoading,
  isDisabled = false 
}) => {
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (message.trim() === '' && !imageFile) return;

    onSendMessage(message, imageFile || undefined);
    setMessage('');
    setImageFile(null);
    setImagePreview(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size should not exceed 5MB');
      return;
    }

    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn(
      "border-t border-border/50 bg-background/80 backdrop-blur-sm p-4",
      isDisabled && "opacity-60"
    )}>
      {/* Image preview */}
      {imagePreview && (
        <div className="mb-3 relative w-24 h-24">
          <img 
            src={imagePreview} 
            alt="Selected" 
            className="w-24 h-24 object-cover rounded-md border border-border"
          />
          <Button 
            onClick={handleRemoveImage} 
            size="sm" 
            variant="destructive"
            className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
          >
            ✕
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        <div className="relative flex-1 overflow-hidden">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={isDisabled ? "Connection lost. Reconnecting..." : "Type a message..."}
            className="min-h-[50px] max-h-[200px] resize-none pr-10"
            disabled={isLoading || isDisabled}
          />
          <label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
              disabled={isLoading || isDisabled}
            />
            <Button
              size="icon"
              variant="ghost"
              type="button"
              className="absolute right-2 bottom-2 h-6 w-6"
              disabled={isLoading || isDisabled}
            >
              <Image className="h-4 w-4 text-muted-foreground" />
            </Button>
          </label>
        </div>

        <Button 
          onClick={handleSendMessage}
          disabled={(!message.trim() && !imageFile) || isLoading || isDisabled}
          className="min-h-[50px] px-4"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isDisabled ? (
            <WifiOff className="h-5 w-5" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>

      {isDisabled && (
        <div className="flex items-center justify-center mt-3 text-sm text-amber-600 dark:text-amber-400">
          <WifiOff className="h-4 w-4 mr-2" /> 
          Connection lost. Please wait for reconnection or refresh the page.
        </div>
      )}
    </div>
  );
};

export default ChatInput;
