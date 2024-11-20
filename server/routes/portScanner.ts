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
  portList: z.array(z.number()).optional(),
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
  const { targetIp, startPort, endPort, portList, protocol, timeout, showAllPorts } = req.query;

  try {
    let ports: number[];
    let portRange: [number, number];

    if (portList) {
      // If portList is provided (well-known ports mode)
      ports = (portList as string).split(',').map(Number);
      portRange = [Math.min(...ports), Math.max(...ports)];
    } else {
      // Port range mode
      const data = portScanSchema.parse({
        targetIp,
        portRange: [parseInt(startPort as string), parseInt(endPort as string)],
        protocol,
        timeout: timeout ? parseInt(timeout as string) : undefined
      });
      portRange = data.portRange;
      ports = Array.from(
        { length: portRange[1] - portRange[0] + 1 },
        (_, i) => portRange[0] + i
      );
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let scanned = 0;
    const total = ports.length;

    const results = await portScan({
      targetIp: targetIp as string,
      portRange,
      ports,
      protocol: protocol as 'TCP' | 'UDP' | 'BOTH',
      timeout: timeout ? parseInt(timeout as string) : undefined,
      onProgress: (currentPort: number, results: any) => {
        scanned++;
        const progress = {
          scanned,
          total,
          currentPort,
          status: 'scanning'
        };
        res.write(`data: ${JSON.stringify({ 
          progress, 
          results,
          showAllPorts: showAllPorts === 'true'
        })}\n\n`);
      }
    }).catch(error => {
      const errorMessage = {
        type: 'error',
        message: error instanceof Error ? error.message : 'Port scanning failed'
      };
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      throw error;
    });

    res.write(`data: ${JSON.stringify({ 
      progress: { 
        scanned: total, 
        total, 
        currentPort: ports[total - 1],
        status: 'completed'
      }, 
      results,
      showAllPorts: showAllPorts === 'true'
    })}\n\n`);
    
    res.end();
  } catch (error) {
    console.error('Port scan error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
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
