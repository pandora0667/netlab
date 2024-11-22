import { useEffect, useRef, useCallback } from 'react';
import { WebSocketConfig, WebSocketMessage } from './types';

export const useWebSocket = (config: WebSocketConfig) => {
  const wsRef = useRef<WebSocket | null>(null);
  const configRef = useRef(config);

  // Update configRef when config changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Setup WebSocket connection
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NODE_ENV === 'production'
      ? window.location.host
      : 'localhost:8080';

    try {
      wsRef.current = new WebSocket(`${protocol}//${host}${configRef.current.domain}`);

      wsRef.current.onopen = () => {
        console.log(`WebSocket connected to ${configRef.current.domain}`);
        configRef.current.onOpen?.();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          configRef.current.onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error(`WebSocket error on ${configRef.current.domain}:`, error);
        configRef.current.onError?.(error);
      };

      wsRef.current.onclose = () => {
        console.log(`WebSocket disconnected from ${configRef.current.domain}`);
        configRef.current.onClose?.();
        // Try to reconnect after a delay
        setTimeout(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            wsRef.current = null;  // Reset the ref to trigger a new connection
          }
        }, 3000);
      };
    } catch (error) {
      console.error(`Failed to establish WebSocket connection to ${configRef.current.domain}:`, error);
    }

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);  // Empty dependency array since we use configRef

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }, []);

  return {
    sendMessage,
    webSocket: wsRef.current,
  };
};
