import { Router } from 'express';
import { DNSResolver, DNSError } from '../services/dnsResolver';
import { z } from 'zod';
import { networkServices } from '../services/network'; // Import networkServices

const router = Router();

// Request validation schema
const dnsQuerySchema = z.object({
  domain: z.string()
    .min(1, "Domain is required")
    .refine(domain => {
      // Basic domain format validation
      const domainRegex = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
      return domainRegex.test(domain);
    }, "Invalid domain format"),
  
  servers: z.array(z.string())
    .min(1, "At least one DNS server is required")
    .max(5, "Maximum 5 DNS servers allowed"),
  
  includeAllRecords: z.boolean().optional().default(false),
});

router.post('/', async (req, res) => {
  try {
    // Validate request data
    const validatedData = dnsQuerySchema.parse(req.body);
    
    // Create DNS resolver instance
    const resolver = new DNSResolver({
      timeout: 5000,
      retries: 2
    });

    // Collect results
    const results = await resolver.queryAll(
      validatedData.domain,
      validatedData.servers
    );

    // Send response
    res.json({
      domain: validatedData.domain,
      results
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
      return;
    }

    if (error instanceof DNSError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error occurred"
    });
  }
});

router.post('/validate-server', async (req, res) => {
  try {
    const { serverIP } = req.body;
    
    if (!serverIP) {
      throw new DNSError('DNS server IP is required', 'MISSING_SERVER_IP');
    }

    const { success, error } = await networkServices.validateDNSServer(serverIP);
    if (!success) {
      throw new DNSError(error || 'DNS server validation failed', 'INVALID_DNS_SERVER');
    }
    
    res.json({ success, message: 'DNS server validated successfully' });
  } catch (error) {
    if (error instanceof DNSError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
});

export default router;
