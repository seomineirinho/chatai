import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Brain, Users, Trash2, AlertTriangle, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ConversationList from './ConversationList';
import RealtimeStatus from './RealtimeStatus';
import ConversationStarter from './ConversationStarter';
import ConversationTransition from './ConversationTransition';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url?: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// Maximum number of retry attempts
const MAX_RETRIES = 3;

// Define o tipo dos canais Realtime do Supabase
type SupabaseRealtimeChannel = ReturnType<typeof supabase.channel>;

const EmpatheticChatbot: React.FC = () => {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    return localStorage.getItem('currentConversationId') || null;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  const [pendingMessage, setPendingMessage] = useState<{message: string, imageFile?: File} | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'inactive' | 'error'>('inactive');
  const [showTransition, setShowTransition] = useState(false);
  const [transitionTitle, setTransitionTitle] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const realtimeChannelRef = useRef<SupabaseRealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Persist currentConversationId to localStorage
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('currentConversationId', currentConversationId);
    } else {
      localStorage.removeItem('currentConversationId');
    }
  }, [currentConversationId]);

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

  // Setup realtime connection monitoring
  useEffect(() => {
    const handleOnlineStatus = () => {
      setConnectionStatus('connected');
      
      // Check if there was a pending message that failed due to connection issues
      if (pendingMessage) {
        toast({
          title: "Connection restored",
          description: "Resending your previous message",
        });
        handleSendMessage(pendingMessage.message, pendingMessage.imageFile);
        setPendingMessage(null);
      }
      
      // Re-establish subscription if it was broken
      if (subscriptionStatus === 'error' && currentConversationId) {
        setupRealtimeSubscription(currentConversationId);
      }
    };
    
    const handleOfflineStatus = () => {
      setConnectionStatus('disconnected');
      toast({
        title: "Connection lost",
        description: "Please check your internet connection",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOfflineStatus);
      
      // Clear any pending retry timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [pendingMessage, currentConversationId, subscriptionStatus, toast]);

  // Function to setup realtime subscription
  const setupRealtimeSubscription = (conversationId: string) => {
    try {
      // Clean up existing subscription if any
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      
      setSubscriptionStatus('inactive');
      
      const channel = supabase
        .channel(`conversation-${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
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
            
            // Reset retry count on successful message
            retryCountRef.current = 0;
            
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
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload) => {
            console.log('Message updated:', payload);
            const updatedMessage = payload.new as Message;
            setMessages(prev => 
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            );
          }
        )
        .subscribe((status) => {
          console.log('Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            setSubscriptionStatus('active');
            setConnectionStatus('connected');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Subscription error');
            setSubscriptionStatus('error');
            
            // Attempt to reconnect with backoff
            if (retryCountRef.current < MAX_RETRIES) {
              const delayMs = Math.pow(2, retryCountRef.current) * 1000;
              retryTimeoutRef.current = setTimeout(() => {
                retryCountRef.current++;
                setConnectionStatus('reconnecting');
                setupRealtimeSubscription(conversationId);
              }, delayMs);
            } else {
              toast({
                title: "Connection error",
                description: "Failed to maintain connection. Please reload the page.",
                variant: "destructive",
              });
            }
          }
        });

      realtimeChannelRef.current = channel;
      
    } catch (error) {
      console.error('Error setting up realtime subscription:', error);
      setSubscriptionStatus('error');
    }
  };

  // Real-time subscriptions for messages
  useEffect(() => {
    if (!currentConversationId) {
      // Clean up any existing subscription
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
        setSubscriptionStatus('inactive');
      }
      return;
    }

    // Reset retry count when conversation changes
    retryCountRef.current = 0;
    
    // Set up subscription for the current conversation
    setupRealtimeSubscription(currentConversationId);

    return () => {
      // Clean up subscription on component unmount or conversation change
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [currentConversationId]);

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
  
  // Check for missing AI responses on reload
  useEffect(() => {
    // Execute only when messages are loaded initially and we have messages
    if (messagesData?.messages && !messagesLoading && messages.length > 0) {
      const msgs = messages;
      
      // Check if the last message is from the user (no AI response)
      if (msgs.length > 0 && msgs[msgs.length - 1].role === 'user') {
        // Retrieve last user message
        const lastUserMsg = msgs[msgs.length - 1];
        
        console.log('Detected message without AI response', lastUserMsg);
        
        // Show notification that we're retrieving the response
        toast({
          title: "Retrieving AI response",
          description: "Fetching the response to your last message",
        });
        
        // Request AI to respond to this message
        supabase.functions.invoke('chat-with-ai', {
          body: {
            message: lastUserMsg.content,
            conversationId: currentConversationId,
            imageUrl: lastUserMsg.image_url,
            isRetry: true // Flag to indicate this is a retry
          }
        });
      }
    }
  }, [messagesData, currentConversationId, messagesLoading, messages, toast]);

  // Mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, imageFile }: { message: string; imageFile?: File }) => {
      let imageUrl = null;

      try {
        // Store original message for retry purposes
        setPendingMessage({ message, imageFile });
        
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

        // Add user message immediately for better UX (optimistic update)
        const optimisticUserMsg: Message = {
          id: `optimistic-user-${Date.now()}`,
          role: 'user',
          content: message,
          image_url: imageUrl,
          created_at: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, optimisticUserMsg]);

        // Add a temporary AI message that will be updated with streaming content
        const tempMessageId = `temp-${Date.now()}`;
        const tempMessage: Message = {
          id: tempMessageId,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString()
        };
        
        // Small delay before showing typing indicator
        await new Promise(resolve => setTimeout(resolve, 300));
        setMessages(prev => [...prev, tempMessage]);

        const { data, error } = await supabase.functions.invoke('chat-with-ai', {
          body: {
            message,
            conversationId: currentConversationId,
            imageUrl
          }
        });

        if (error) throw error;
        
        // If we reach here, message was sent successfully - clear pending message
        setPendingMessage(null);
        
        // Remove the temporary and optimistic messages once real messages come through realtime
        setTimeout(() => {
          setMessages(prev => prev.filter(msg => 
            msg.id !== tempMessageId && !msg.id.startsWith('optimistic-')
          ));
        }, 500);
        
        return data;
      } catch (error) {
        console.error('Error in sendMessageMutation:', error);
        
        // Keep the pending message for retry
        // Show a retry button or auto-retry on reconnection
        toast({
          title: "Message failed to send",
          description: "We'll retry when connection is restored",
          variant: "destructive",
        });
        
        throw error;
      }
    },
    onSuccess: (data) => {
      // Update current conversation ID if it's a new conversation
      if (data.conversationId && data.conversationId !== currentConversationId) {
        setCurrentConversationId(data.conversationId);
      }

      // Refresh conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: unknown) => {
      console.error('Chat error:', error);
      
      // Only show toast if not a connection-related error (handled elsewhere)
      if (navigator.onLine) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Mutation for starting a new conversation
  const startConversationMutation = useMutation({
    mutationFn: async (message: string) => {
      setShowTransition(true);
      
      // Calculate a title based on the first message
      let suggestedTitle = "";
      
      if (message.length <= 30) {
        suggestedTitle = message;
      } else {
        // Take first 30 chars and add ellipsis
        suggestedTitle = message.substring(0, 30) + "...";
      }
      
      setTransitionTitle(`Creating conversation: "${suggestedTitle}"`);
      
      // Create new conversation
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({ title: suggestedTitle })
        .select()
        .single();

      if (convError) throw convError;
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 1800));
      
      return { 
        conversationId: newConversation.id,
        title: suggestedTitle
      };
    },
    onSuccess: (data) => {
      const { conversationId } = data;
      
      // Set the new conversation as active
      setCurrentConversationId(conversationId);
      
      // Hide transition after a delay
      setTimeout(() => {
        setShowTransition(false);
        
        // We don't send the initial message to chat anymore
        // Just show empty conversation with the title
        
        // Update conversation list to show the new conversation
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }, 500);
    },
    onError: (error: unknown) => {
      setShowTransition(false);
      console.error('Error starting conversation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start conversation. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Mutation for deleting the current conversation
  const deleteConversationMutation = useMutation({
    mutationFn: async () => {
      if (!currentConversationId) return;
      
      setIsDeletingConversation(true);
      
      // Delete from Supabase
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', currentConversationId);
      
      if (error) throw error;
      
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
      
      // Clear current conversation and messages
      setCurrentConversationId(null);
      setMessages([]);
      
      // Clear from localStorage
      localStorage.removeItem('currentConversationId');
      
      // Refresh conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setIsDeletingConversation(false);
    },
    onError: (error: unknown) => {
      console.error('Delete conversation error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete conversation",
        variant: "destructive",
      });
      setIsDeletingConversation(false);
    }
  });

  const handleSendMessage = (message: string, imageFile?: File) => {
    // Don't attempt to send if offline
    if (!navigator.onLine) {
      setPendingMessage({ message, imageFile });
      toast({
        title: "You're offline",
        description: "Message will be sent when connection is restored",
        variant: "destructive",
      });
      return;
    }
    
    sendMessageMutation.mutate({ message, imageFile });
  };

  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    localStorage.setItem('currentConversationId', conversationId);
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    localStorage.removeItem('currentConversationId');
  };

  const handleStartConversation = (message: string) => {
    startConversationMutation.mutate(message);
  };

  const handleDeleteConversation = () => {
    deleteConversationMutation.mutate();
  };

  const handleRetryMessage = () => {
    if (pendingMessage) {
      // Clear the current pending message
      const messageToRetry = pendingMessage;
      setPendingMessage(null);
      
      // Attempt to resend the message
      handleSendMessage(messageToRetry.message, messageToRetry.imageFile);
    }
  };

  const handleForceReconnect = () => {
    setConnectionStatus('reconnecting');
    
    // Force reconnection of realtime subscription
    if (currentConversationId) {
      setupRealtimeSubscription(currentConversationId);
    }
    
    // Attempt to resend any pending messages
    if (pendingMessage) {
      setTimeout(() => {
        handleRetryMessage();
      }, 1000);
    }
  };

  const conversations = conversationsData?.conversations || [];

  // Show conversation starter screen if no active conversation
  if (!currentConversationId) {
    return (
      <>
        <ConversationTransition 
          visible={showTransition} 
          title={transitionTitle} 
        />
        
        <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <ConversationList
            conversations={conversations}
            currentConversationId={undefined}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
          />
          
          <div className="flex-1 flex flex-col">
            <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-full flex items-center justify-center">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      AI Assistant
                    </h1>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      Understanding images and providing help
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {connectionStatus === 'connected' ? (
                    <div className="flex items-center gap-1 text-xs text-emerald-500">
                      <Wifi className="h-3 w-3" />
                      <span>Connected</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleForceReconnect}
                      className="gap-1 text-amber-500 border-amber-500"
                    >
                      {connectionStatus === 'reconnecting' ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <WifiOff className="h-3 w-3" />
                      )}
                      {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Reconnect'}
                    </Button>
                  )}
                  <RealtimeStatus />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{onlineUsers} online</span>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              <ConversationStarter 
                onStartConversation={handleStartConversation}
                isLoading={startConversationMutation.isPending}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ConversationTransition 
        visible={showTransition} 
        title={transitionTitle}
      />
      
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
                    AI Assistant
                  </h1>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Understanding images and providing help
                  </p>
                </div>
              </div>
              
              {/* Status indicators */}
              <div className="flex items-center gap-4">
                {connectionStatus !== 'connected' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleForceReconnect}
                    className="gap-1 text-amber-500 border-amber-500"
                  >
                    {connectionStatus === 'reconnecting' ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <WifiOff className="h-3 w-3" />
                    )}
                    {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Reconnect'}
                  </Button>
                )}
                
                {pendingMessage && connectionStatus === 'connected' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetryMessage}
                    className="gap-1 text-amber-500 border-amber-500"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry message
                  </Button>
                )}
                
                {currentConversationId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="opacity-60 hover:opacity-100 transition-opacity"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete this
                          conversation and all its messages.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteConversation}
                          className="bg-red-500 hover:bg-red-600"
                          disabled={isDeletingConversation}
                        >
                          {isDeletingConversation ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>Delete</>
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {connectionStatus === 'connected' ? (
                  <div className="flex items-center gap-1 text-xs text-emerald-500">
                    <Wifi className="h-3 w-3" />
                    <span>Connected</span>
                  </div>
                ) : null}
                <RealtimeStatus />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{onlineUsers} online</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {subscriptionStatus === 'error' && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800 p-2 text-sm flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span>Connection issues detected. Some messages may be delayed.</span>
              <Button variant="outline" size="sm" onClick={handleForceReconnect} className="ml-2 h-7 text-xs border-amber-400">
                <RefreshCw className="h-3 w-3 mr-1" />
                Reconnect
              </Button>
            </div>
          )}

          {/* Messages Area */}
          <ScrollArea className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentConversationId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="p-6"
              >
                {messages.length === 0 && !messagesLoading && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Brain className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Welcome to your AI companion</h3>
                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                      I'm here to understand, support, and help you. I can analyze images
                      and engage in meaningful conversations.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-sm">
                      <div className="bg-muted/30 rounded-lg p-4">
                        <Brain className="w-6 h-6 mb-2 text-purple-500" />
                        <h4 className="font-medium mb-1">Intelligent Conversations</h4>
                        <p className="text-muted-foreground">Engage in natural, contextual discussions</p>
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
              </motion.div>
            </AnimatePresence>
          </ScrollArea>

          {/* Input Area */}
          <ChatInput 
            onSendMessage={handleSendMessage}
            isLoading={sendMessageMutation.isPending || connectionStatus === 'reconnecting'}
            isDisabled={connectionStatus === 'disconnected'}
          />
        </div>
      </div>
    </>
  );
};

export default EmpatheticChatbot;
