
import React from 'react';
import { MessageSquarePlus, Search, List, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface ConversationListProps {
  conversations: {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  }[];
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
  const [search, setSearch] = React.useState('');
  const [isMobile, setIsMobile] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };
  
  const filteredConversations = React.useMemo(() => {
    return conversations.filter(c => 
      c.title.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }, [conversations, search]);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    // For today's dates, show time only
    if (date.toDateString() === now.toDateString()) {
      return format(date, 'h:mm a');
    }
    
    // For dates within last 7 days, show day of week
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 7) {
      return format(date, 'EEE');
    }
    
    // Otherwise show short date
    return format(date, 'MM/dd/yy');
  };
  
  return (
    <>
      {isMobile && (
        <Button 
          size="icon" 
          variant="outline"
          className="fixed left-2 top-2 z-30 md:hidden"
          onClick={toggleSidebar}
          aria-label="Toggle conversation list"
        >
          <List className="h-5 w-5" />
        </Button>
      )}
      
      <motion.div 
        initial={isMobile ? { x: -300 } : { x: 0 }}
        animate={{ x: isOpen ? 0 : -300 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "bg-white dark:bg-slate-950 border-r border-border relative",
          "w-[300px] min-w-[300px] h-full z-20",
          isMobile && !isOpen && "hidden"
        )}
      >
        <div className="p-4 border-b border-border/50">
          <Button 
            variant="default" 
            className="w-full justify-start gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            onClick={onNewConversation}
          >
            <MessageSquarePlus className="h-5 w-5" />
            New Conversation
          </Button>
          
          <div className="mt-3 relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search conversations" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        
        <ScrollArea className="h-[calc(100vh-5rem)]">
          <div className="p-2">
            {filteredConversations.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No conversations found
              </div>
            ) : (
              filteredConversations.map(conversation => (
                <div 
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-md cursor-pointer mb-1 group hover:bg-slate-100 dark:hover:bg-slate-800",
                    "transition-colors duration-200",
                    currentConversationId === conversation.id && "bg-slate-100 dark:bg-slate-800"
                  )}
                >
                  <div className="w-8 h-8 bg-gradient-to-tr from-purple-200 to-blue-200 dark:from-purple-800 dark:to-blue-900 rounded-md flex items-center justify-center flex-shrink-0">
                    <Tag className={cn(
                      "w-4 h-4 text-purple-700 dark:text-purple-300",
                      currentConversationId === conversation.id ? "text-blue-600 dark:text-blue-300" : ""
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h3 className={cn(
                        "font-medium text-sm truncate",
                        currentConversationId === conversation.id ? "text-blue-600 dark:text-blue-400" : ""
                      )}>
                        {conversation.title}
                      </h3>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {formatDate(conversation.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </motion.div>
    </>
  );
};

export default ConversationList;
