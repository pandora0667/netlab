import { Router } from 'express';
import { DNSPropagationService } from '../services/dns-propagation.service.js';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';

const router = Router();
const dnsService = new DNSPropagationService();

export function handleDNSWebSocket(ws: WebSocket, req: IncomingMessage) {
  console.log('New DNS Propagation WebSocket connection from:', req.socket.remoteAddress);

  const cleanup = dnsService.onQueryResult((result) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'queryResult', data: result }));
      } catch (error) {
        console.error('Failed to send DNS result:', error);
        ws.close(1011, 'Failed to send result');
      }
    }
  });

  ws.on('close', (code, reason) => {
    cleanup();
    console.log('DNS client disconnected:', code, reason?.toString());
  });

  ws.on('error', (error) => {
    console.error('DNS WebSocket error:', error);
    try {
      ws.close(1011, 'Internal server error');
    } catch (e) {
      console.error('Failed to close WebSocket:', e);
    }
  });
}

router.post('/propagation', async (req, res) => {
  try {
    const { domain, region } = req.body;
    
    if (!domain) {
      return res.status(400).json({ message: 'Domain name is required' });
    }

    await dnsService.checkPropagation(domain, region);
    res.status(200).json({ message: 'DNS propagation check started' });
  } catch (error) {
    console.error('Error in DNS propagation:', error);
    res.status(500).json({ message: 'Failed to start DNS propagation check' });
  }
});

export default router;
