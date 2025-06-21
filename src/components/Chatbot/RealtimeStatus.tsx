
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const RealtimeStatus: React.FC = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionCount, setConnectionCount] = useState(0);

  useEffect(() => {
    const channel = supabase.channel('connection-status');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setConnectionCount(Object.keys(state).length);
        setIsConnected(true);
      })
      .on('presence', { event: 'join' }, () => {
        setIsConnected(true);
      })
      .on('presence', { event: 'leave' }, () => {
        // Connection might be lost
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          await channel.track({
            user_id: `user-${Date.now()}`,
            online_at: new Date().toISOString(),
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
        }
      });

    // Monitor network status
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors",
      isConnected 
        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    )}>
      {isConnected ? (
        <Wifi className="w-3 h-3" />
      ) : (
        <WifiOff className="w-3 h-3" />
      )}
      <span>
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
      {isConnected && connectionCount > 0 && (
        <span className="ml-1">({connectionCount})</span>
      )}
    </div>
  );
};

export default RealtimeStatus;
