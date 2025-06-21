import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Brain, Heart, Users } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ConversationList from './ConversationList';
import RealtimeStatus from './RealtimeStatus';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url?: string;
  emotion_detected?: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const EmpatheticChatbot: React.FC = () => {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Query for conversations list
  const { data: conversationsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-conversations');
      if (error) throw error;
      return data;
    },
  });

  // Query for current conversation messages
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', currentConversationId],
    queryFn: async () => {
      if (!currentConversationId) return { messages: [] };
      const { data, error } = await supabase.functions.invoke('get-conversations', {
        body: { conversationId: currentConversationId }
      });
      if (error) throw error;
      return data;
    },
    enabled: !!currentConversationId,
  });

  // Real-time subscriptions for messages
  useEffect(() => {
    if (!currentConversationId) return;

    const channel = supabase
      .channel(`conversation-${currentConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${currentConversationId}`
        },
        (payload) => {
          console.log('New message received:', payload);
          const newMessage = payload.new as Message;
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(msg => msg.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
          
          // Show notification for new AI responses
          if (newMessage.role === 'assistant') {
            toast({
              title: "AI Response",
              description: "New response received! 🤖",
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${currentConversationId}`
        },
        (payload) => {
          console.log('Message updated:', payload);
          const updatedMessage = payload.new as Message;
          setMessages(prev => 
            prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentConversationId, toast]);

  // Real-time presence tracking
  useEffect(() => {
    const channel = supabase.channel('online-users');

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users = Object.keys(newState).length;
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const presenceTrackStatus = await channel.track({
            user: `user-${Date.now()}`,
            online_at: new Date().toISOString(),
          });
          console.log('Presence tracking:', presenceTrackStatus);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update local messages when query data changes
  useEffect(() => {
    if (messagesData?.messages) {
      setMessages(messagesData.messages);
    } else if (!currentConversationId) {
      setMessages([]);
    }
  }, [messagesData, currentConversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, imageFile }: { message: string; imageFile?: File }) => {
      let imageUrl = null;

      if (imageFile) {
        // Upload image to Supabase Storage
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(fileName, imageFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error('Failed to upload image');
        }

        const { data: { publicUrl } } = supabase.storage
          .from('chat-images')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }

      const { data, error } = await supabase.functions.invoke('chat-with-ai', {
        body: {
          message,
          conversationId: currentConversationId,
          imageUrl
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Update current conversation ID if it's a new conversation
      if (data.conversationId && data.conversationId !== currentConversationId) {
        setCurrentConversationId(data.conversationId);
      }

      // Refresh conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      if (data.emotionDetected) {
        toast({
          title: "Emotion detected",
          description: `I sense you're feeling ${data.emotionDetected}. I'm here to help! 💙`,
        });
      }
    },
    onError: (error: any) => {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (message: string, imageFile?: File) => {
    sendMessageMutation.mutate({ message, imageFile });
  };

  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  const conversations = conversationsData?.conversations || [];

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <ConversationList
        conversations={conversations}
        currentConversationId={currentConversationId || undefined}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-full flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Empathic AI Assistant
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  Understanding images and emotions
                </p>
              </div>
            </div>
            
            {/* Status indicators */}
            <div className="flex items-center gap-4">
              <RealtimeStatus />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{onlineUsers} online</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {messages.length === 0 && !messagesLoading && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Welcome to your AI companion</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  I'm here to understand, support, and help you. I can analyze images, 
                  detect emotions, and engage in meaningful conversations.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-sm">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <Brain className="w-6 h-6 mb-2 text-purple-500" />
                    <h4 className="font-medium mb-1">Intelligent Conversations</h4>
                    <p className="text-muted-foreground">Engage in natural, contextual discussions</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <Heart className="w-6 h-6 mb-2 text-pink-500" />
                    <h4 className="font-medium mb-1">Emotion Detection</h4>
                    <p className="text-muted-foreground">I understand and respond to your feelings</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <Brain className="w-6 h-6 mb-2 text-blue-500" />
                    <h4 className="font-medium mb-1">Image Analysis</h4>
                    <p className="text-muted-foreground">Upload images for detailed analysis</p>
                  </div>
                </div>
              </div>
            )}

            {messagesLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}

            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <ChatInput 
          onSendMessage={handleSendMessage}
          isLoading={sendMessageMutation.isPending}
        />
      </div>
    </div>
  );
};

export default EmpatheticChatbot;
