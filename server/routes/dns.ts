import { Router } from 'express';
import dns from 'dns/promises';
import { networkServices } from '../services/network';

const router = Router();

router.post('/', async (req, res) => {
  const { domain, servers, includeAllRecords } = req.body;

  if (!domain || !servers || !servers.length) {
    return res.status(400).json({
      success: false,
      error: 'Domain and servers are required'
    });
  }

  try {
    const resolver = new dns.Resolver();
    const recordTypes = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'SOA', 'CNAME'];
    const results: Record<string, any[]> = {};

    for (const recordType of recordTypes) {
      results[recordType] = [];
      
      for (const serverAddress of servers) {
        try {
          resolver.setServers([serverAddress]);
          const startTime = Date.now();
          const result = await networkServices.dnsLookup(domain, recordType, serverAddress);
          
          results[recordType].push({
            server: serverAddress,
            records: result.records,
            queryTime: Date.now() - startTime,
            timestamp: Date.now(),
            info: result.info
          });
        } catch (error) {
          console.debug(`DNS lookup for ${recordType} from ${serverAddress}: No records found`);
          results[recordType].push({
            server: serverAddress,
            records: [],
            queryTime: 0,
            timestamp: Date.now(),
            info: `No ${recordType} records found`
          });
        }
      }
    }

    res.json({
      success: true,
      domain,
      results
    });
  } catch (error: any) {
    console.error('DNS Lookup error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'DNS lookup failed'
    });
  }
});

export default router;
