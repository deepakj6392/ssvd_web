'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useApolloClient, gql } from '@apollo/client';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ConnectionStatus() {
  const [socketConnected, setSocketConnected] = useState(false);
  const [apolloConnected, setApolloConnected] = useState(false);
  const client = useApolloClient();

  useEffect(() => {
    // Check Apollo connection
    const checkApolloConnection = async () => {
      try {
        // Simple query to check if Apollo is connected
        await client.query({
          query: gql`query { __typename }`,
          fetchPolicy: 'network-only',
        });
        setApolloConnected(true);
      } catch (error) {
        setApolloConnected(false);
      }
    };

    // Initialize socket connection for monitoring
    const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://10.160.2.165:3001');

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // Initial Apollo check
    checkApolloConnection();

    // Periodic checks for Apollo
    const interval = setInterval(checkApolloConnection, 5000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [client]);

  const isConnected = socketConnected && apolloConnected;
  const isDisconnected = !socketConnected || !apolloConnected;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all duration-300",
          isConnected
            ? "bg-green-100 text-green-800 border border-green-200"
            : "bg-red-100 text-red-800 border border-red-200"
        )}
      >
        {isDisconnected ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Disconnected</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4" />
            <span className="text-sm font-medium">Connected</span>
          </>
        )}
      </div>
    </div>
  );
}
