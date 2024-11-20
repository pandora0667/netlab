import { Router } from 'express';
import { z } from 'zod';
import { portScan } from '../services/port-scanner';

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

router.post('/scan', async (req, res) => {
  try {
    const data = portScanSchema.parse(req.body);
    const results = await portScan(data);
    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('Port scan error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
