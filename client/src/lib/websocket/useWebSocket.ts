import { useEffect, useRef, useCallback } from 'react';
import { WebSocketConfig, WebSocketMessage } from './types';

export const useWebSocket = (config: WebSocketConfig) => {
  const wsRef = useRef<WebSocket | null>(null);
  const configRef = useRef(config);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Update configRef when config changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Setup WebSocket connection
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      // Reset connection if we've exceeded max attempts
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.log(`Max reconnection attempts (${maxReconnectAttempts}) reached for ${configRef.current.domain}`);
        reconnectAttemptsRef.current = 0;
        configRef.current.onError?.(new Event('Max reconnection attempts reached'));
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = process.env.NODE_ENV === 'production'
        ? window.location.host
        : 'localhost:8080';

      try {
        // Clean up existing connection
        if (wsRef.current) {
          wsRef.current.close(1000, 'Reconnecting');
          wsRef.current = null;
        }

        const ws = new WebSocket(`${protocol}//${host}${configRef.current.domain}`);
        console.log(`Attempting to connect to ${protocol}//${host}${configRef.current.domain}`);

        ws.onopen = () => {
          console.log(`WebSocket connected to ${configRef.current.domain}`);
          reconnectAttemptsRef.current = 0;
          configRef.current.onOpen?.();
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            configRef.current.onMessage?.(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            configRef.current.onError?.(new Event('Failed to parse message'));
          }
        };

        ws.onerror = (error) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`WebSocket error on ${configRef.current.domain}:`, errorMessage);
          configRef.current.onError?.(error);
        };

        ws.onclose = (event) => {
          console.log(`WebSocket disconnected from ${configRef.current.domain}:`, {
            code: event.code,
            reason: event.reason || 'No reason provided',
            wasClean: event.wasClean
          });
          
          wsRef.current = null;
          configRef.current.onClose?.();
          
          // Try to reconnect after a delay, unless it was a normal closure
          if (event.code !== 1000 && event.code !== 1001 && reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
            console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${delay}ms...`);
            reconnectTimeout = setTimeout(connectWebSocket, delay);
          }
        };

        wsRef.current = ws;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to establish WebSocket connection to ${configRef.current.domain}:`, errorMessage);
        wsRef.current = null;
        configRef.current.onError?.(new Event(errorMessage));
        
        // Try to reconnect after a delay
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${delay}ms...`);
          reconnectTimeout = setTimeout(connectWebSocket, delay);
        }
      }
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
    };
  }, []);  // Empty dependency array since we use configRef

  const sendMessage = useCallback((message: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error(`WebSocket is not connected to ${configRef.current.domain}`);
      return false;
    }
    try {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to send message:', errorMessage);
      return false;
    }
  }, []);

  return {
    sendMessage,
    webSocket: wsRef.current,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnectAttempts: reconnectAttemptsRef.current,
  };
};
