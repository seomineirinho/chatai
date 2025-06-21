
import React from 'react';
import { MessageCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation
}) => {
  return (
    <div className="w-80 border-r border-border/50 bg-muted/20 flex flex-col">
      <div className="p-4 border-b border-border/50">
        <Button 
          onClick={onNewConversation}
          className="w-full justify-start gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          {conversations.map((conversation) => (
            <Button
              key={conversation.id}
              variant="ghost"
              className={cn(
                "w-full justify-start mb-1 h-auto p-3 text-left",
                currentConversationId === conversation.id && "bg-muted"
              )}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="flex items-start gap-2 w-full">
                <MessageCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {conversation.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(conversation.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </Button>
          ))}
          
          {conversations.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs">Start a new chat to begin</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ConversationList;
