import { Router } from 'express';
import { DNSPropagationService } from '../services/dns-propagation.service.js';
import { WebSocketServer } from 'ws';
import { Server } from 'http';
import { parse as parseUrl } from 'url';

const router = Router();
const dnsService = new DNSPropagationService();

// WebSocket setup
export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/dns-propagation',
    verifyClient: (info, cb) => {
      const { pathname } = parseUrl(info.req.url || '');
      if (pathname === '/ws/dns-propagation') {
        cb(true);
      } else {
        cb(false, 404, 'Not Found');
      }
    }
  });

  wss.on('connection', (ws, req) => {
    console.log('New DNS Propagation WebSocket connection from:', req.socket.remoteAddress);

    const cleanup = dnsService.onQueryResult((result) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'queryResult', data: result }));
      }
    });

    ws.on('close', () => {
      cleanup();
      console.log('Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });
}

router.post('/propagation', async (req, res) => {
  try {
    const { domain, region } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain name is required' });
    }

    const results = await dnsService.checkPropagation(domain, region);
    res.json(results);
  } catch (error) {
    console.error('DNS Propagation check error:', error);
    res.status(500).json({ error: 'Failed to check DNS propagation' });
  }
});

export default router;
