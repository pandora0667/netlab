import { Router } from 'express';
import { DNSResolver, DNSError } from '../services/dnsResolver';
import { z } from 'zod';

const router = Router();

// 요청 검증을 위한 Zod 스키마
const dnsQuerySchema = z.object({
  domain: z.string()
    .min(1, "Domain is required")
    .refine(domain => {
      // 기본적인 도메인 형식 검증
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
    // 요청 데이터 검증
    const validatedData = dnsQuerySchema.parse(req.body);
    
    // DNS 리졸버 인스턴스 생성
    const resolver = new DNSResolver({
      timeout: 5000,
      retries: 2
    });

    // 결과 수집
    const results = await resolver.queryAll(
      validatedData.domain,
      validatedData.servers
    );

    // 응답 전송
    res.json({
      domain: validatedData.domain,
      results: results.reduce((acc, result) => {
        const { recordType, ...rest } = result;
        if (!acc[recordType]) {
          acc[recordType] = [];
        }
        acc[recordType].push(rest);
        return acc;
      }, {} as Record<string, any[]>)
    });
  } catch (error) {
    console.error('DNS query error:', error);

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

    const resolver = new DNSResolver({
      timeout: 5000,
      retries: 2,
      servers: [serverIP]
    });

    try {
      await resolver.validateDNSServer(serverIP);
      res.json({ isValid: true });
    } catch (error) {
      if (error instanceof DNSError) {
        res.json({
          isValid: false,
          error: error.message
        });
      } else {
        throw error;
      }
    }
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
