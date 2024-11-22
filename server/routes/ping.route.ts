import { Router } from 'express';
import { networkServices } from '../services/network.js';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { PingResult, PingOptions } from '../services/network.js';

const router = Router();

export function handlePingWebSocket(ws: WebSocket, req: IncomingMessage) {
  console.log('New Ping WebSocket connection from:', req.socket.remoteAddress);
  let isExecutingPing = false;

  ws.on('message', async (message) => {
    try {
      if (isExecutingPing) {
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Another ping operation is in progress' }
        }));
        return;
      }

      const { type, data } = JSON.parse(message.toString());
      
      if (type === 'startPing') {
        if (!data.host) {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Host is required' }
          }));
          return;
        }

        isExecutingPing = true;
        const startTime = Date.now();
        const allResults: PingResult[] = [];

        try {
          for (let i = 0; i < (data.count || 4); i++) {
            const results = await networkServices.executePing({
              ...data,
              count: 1  // Execute one ping at a time
            });

            if (results && results.length > 0) {
              const pingResult = results[0];
              allResults.push(pingResult);
              
              // Send each result immediately
              if (ws.readyState === WebSocket.OPEN) {
                try {
                  const statistics = networkServices.calculateStatistics(allResults);
                  ws.send(JSON.stringify({
                    type: 'pingResult',
                    data: {
                      ...pingResult,
                      host: data.host,
                      type: data.type,
                      statistics,
                      sequence: i,  // Start from 0 to match macOS output
                      totalSequences: data.count || 4,
                      elapsedTime: Date.now() - startTime,
                      latencyText: pingResult.success 
                        ? `${pingResult.latency?.toFixed(2)}ms`
                        : 'Failed'
                    }
                  }));
                } catch (sendError) {
                  console.error('Error sending ping result:', sendError);
                }
              }
            }

            // Add a small delay between pings
            if (i < (data.count || 4) - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (error) {
          console.error('Error executing ping:', error);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'error',
              data: { 
                message: 'Failed to execute ping',
                details: error instanceof Error ? error.message : 'Unknown error'
              }
            }));
          }
        } finally {
          isExecutingPing = false;
          
          // Send completion message
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'pingComplete',
              data: {
                host: data.host,
                type: data.type,
                totalTime: Date.now() - startTime,
                statistics: networkServices.calculateStatistics(allResults)
              }
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error processing ping message:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          data: { 
            message: 'Failed to process ping request',
            details: error instanceof Error ? error.message : 'Unknown error'
          }
        }));
      }
    }
  });

  ws.on('error', (error) => {
    console.error('Ping WebSocket error:', error);
    try {
      ws.close(1011, 'Internal server error');
    } catch (e) {
      console.error('Failed to close WebSocket:', e);
    }
  });

  ws.on('close', (code, reason) => {
    console.log('Ping client disconnected:', code, reason?.toString());
    isExecutingPing = false;  // Reset the flag when connection closes
  });
}

export default router;
