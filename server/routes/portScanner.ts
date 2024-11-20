import { Router } from 'express';
import { z } from 'zod';
import { portScan, exportResults } from '../services/portScanner';

const router = Router();

const portScanSchema = z.object({
  targetIp: z.string().ip(),
  portRange: z.tuple([
    z.number().int().min(1).max(65535),
    z.number().int().min(1).max(65535)
  ]).refine(([start, end]) => start <= end, {
    message: "Start port must be less than or equal to end port"
  }),
  protocol: z.enum(['TCP', 'UDP', 'BOTH']),
  timeout: z.number().int().min(100).max(10000).optional(),
  exportFormat: z.enum(['JSON', 'CSV']).optional()
});

const exportSchema = z.object({
  results: z.object({
    TCP: z.record(z.string()).optional(),
    UDP: z.record(z.string()).optional(),
  }),
  format: z.enum(['JSON', 'CSV'])
});

// SSE endpoint for real-time progress updates
router.get('/stream', async (req, res) => {
  const { targetIp, startPort, endPort, protocol, timeout } = req.query;

  try {
    const data = portScanSchema.parse({
      targetIp,
      portRange: [parseInt(startPort as string), parseInt(endPort as string)],
      protocol,
      timeout: timeout ? parseInt(timeout as string) : undefined
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let progress = 0;
    let currentResults: any = {};

    const results = await portScan({
      ...data,
      onProgress: (newProgress: number, results: any) => {
        progress = newProgress;
        currentResults = results;
        res.write(`data: ${JSON.stringify({ progress, results: currentResults })}\n\n`);
      }
    });

    res.write(`data: ${JSON.stringify({ progress: 100, results })}\n\n`);
    res.end();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Export endpoint
router.post('/export', async (req, res) => {
  try {
    const { results, format } = exportSchema.parse(req.body);
    const exportedData = exportResults(results, format);

    res.setHeader('Content-Type', format === 'JSON' ? 'application/json' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=port-scan-${Date.now()}.${format.toLowerCase()}`);
    res.send(exportedData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

router.post('/scan', async (req, res) => {
  try {
    const data = portScanSchema.parse(req.body);
    const results = await portScan(data);
    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
