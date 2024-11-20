import net from 'net';
import dgram from 'dgram';
import { EventEmitter } from 'events';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

interface ScanOptions {
  targetIp: string;
  portRange: [number, number];
  ports?: number[];
  protocol: 'TCP' | 'UDP' | 'BOTH';
  timeout?: number;
  onProgress?: (currentPort: number, results: ScanResult) => void;
}

interface ScanResult {
  TCP?: { [key: number]: string };
  UDP?: { [key: number]: string };
}

// Common service signatures for better port detection
const commonServices = {
  TCP: {
    20: { signature: Buffer.from('220'), service: 'FTP-DATA' },
    21: { signature: Buffer.from('220'), service: 'FTP' },
    22: { signature: Buffer.from('SSH'), service: 'SSH' },
    23: { signature: Buffer.from([0xff, 0xfd]), service: 'Telnet' },
    25: { signature: Buffer.from('220'), service: 'SMTP' },
    80: { signature: Buffer.from('HTTP'), service: 'HTTP' },
    443: { signature: Buffer.from('HTTP'), service: 'HTTPS' }
  },
  UDP: {
    53: { signature: Buffer.from([0x00]), service: 'DNS' },
    161: { signature: Buffer.from([0x30]), service: 'SNMP' },
    123: { signature: Buffer.from([0x23]), service: 'NTP' }
  }
};

async function scanTCPPort(ip: string, port: number, timeout: number): Promise<string> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve('Open');
      }
    });

    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve('Filtered');
      }
    });

    socket.on('error', (error: Error & { code?: string }) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(error.code === 'ECONNREFUSED' ? 'Closed' : 'Filtered');
      }
    });

    try {
      socket.connect(port, ip);
    } catch (error) {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve('Filtered');
      }
    }
  });
}

async function scanUDPPort(ip: string, port: number, timeout: number): Promise<string> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.close();
        resolve('Open|Filtered');
      }
    }, timeout);

    socket.on('error', (error: Error & { code?: string }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        socket.close();
        resolve(error.code && error.code === 'ECONNREFUSED' ? 'Closed' : 'Filtered');
      }
    });

    try {
      // Send an empty packet
      socket.send(Buffer.alloc(0), port, ip, (error) => {
        if (error && !resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          socket.close();
          resolve('Filtered');
        }
      });
    } catch (error) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        socket.close();
        resolve('Filtered');
      }
    }
  });
}

export async function portScan(options: ScanOptions): Promise<ScanResult> {
  const {
    targetIp,
    portRange,
    ports = Array.from(
      { length: portRange[1] - portRange[0] + 1 },
      (_, i) => portRange[0] + i
    ),
    protocol = 'TCP',
    timeout = 1000,
    onProgress
  } = options;

  const results: ScanResult = {};
  const scanProtocols = protocol === 'BOTH' ? ['TCP', 'UDP'] : [protocol];

  for (const proto of scanProtocols) {
    results[proto as 'TCP' | 'UDP'] = {};
    
    for (const port of ports) {
      try {
        const scanFunction = proto === 'TCP' ? scanTCPPort : scanUDPPort;
        const status = await scanFunction(targetIp, port, timeout);

        // Type-safe indexing
        if (proto === 'TCP') {
          results.TCP![port] = status;
        } else {
          results.UDP![port] = status;
        }

        if (onProgress) {
          onProgress(port, results);
        }
      } catch (error) {
        // Optional: Handle scan errors
        console.warn(`Port ${port} (${proto}) scan failed:`, error);
      }
    }
  }

  return results;
}

export function exportResults(results: ScanResult, format: 'JSON' | 'CSV'): string {
  if (format === 'JSON') {
    return JSON.stringify(results, null, 2);
  }

  // CSV format
  const rows = ['Protocol,Port,Status'];
  
  // Handle TCP results
  if (results.TCP) {
    Object.entries(results.TCP).forEach(([port, status]) => {
      rows.push(`TCP,${port},${status}`);
    });
  }
  
  // Handle UDP results
  if (results.UDP) {
    Object.entries(results.UDP).forEach(([port, status]) => {
      rows.push(`UDP,${port},${status}`);
    });
  }
  
  return rows.join('\n');
}

export const WELL_KNOWN_PORTS = {
  TCP: {
    20: { service: 'FTP-DATA', description: 'File Transfer Protocol (Data)' },
    21: { service: 'FTP', description: 'File Transfer Protocol (Control)' },
    22: { service: 'SSH', description: 'Secure Shell' },
    23: { service: 'Telnet', description: 'Telnet protocol' },
    25: { service: 'SMTP', description: 'Simple Mail Transfer Protocol' },
    53: { service: 'DNS', description: 'Domain Name System' },
    80: { service: 'HTTP', description: 'Hypertext Transfer Protocol' },
    110: { service: 'POP3', description: 'Post Office Protocol v3' },
    143: { service: 'IMAP', description: 'Internet Message Access Protocol' },
    443: { service: 'HTTPS', description: 'HTTP over TLS/SSL' },
    465: { service: 'SMTPS', description: 'SMTP over TLS/SSL' },
    587: { service: 'SUBMISSION', description: 'Message Submission' },
    993: { service: 'IMAPS', description: 'IMAP over TLS/SSL' },
    995: { service: 'POP3S', description: 'POP3 over TLS/SSL' },
    1433: { service: 'MSSQL', description: 'Microsoft SQL Server' },
    3306: { service: 'MySQL', description: 'MySQL Database' },
    5432: { service: 'PostgreSQL', description: 'PostgreSQL Database' },
    27017: { service: 'MongoDB', description: 'MongoDB Database' },
    6379: { service: 'Redis', description: 'Redis Database' },
    3389: { service: 'RDP', description: 'Remote Desktop Protocol' },
    5900: { service: 'VNC', description: 'Virtual Network Computing' },
    853: { service: 'DNS-TLS', description: 'DNS over TLS' },
    1935: { service: 'RTMP', description: 'Real-Time Messaging Protocol' },
    5353: { service: 'mDNS', description: 'Multicast DNS' },
    27015: { service: 'Source', description: 'Source Engine Game Server' },
    161: { service: 'SNMP', description: 'Simple Network Management Protocol' },
    162: { service: 'SNMPTRAP', description: 'SNMP Trap' },
    88: { service: 'Kerberos', description: 'Kerberos Authentication' },
    389: { service: 'LDAP', description: 'Lightweight Directory Access Protocol' },
    636: { service: 'LDAPS', description: 'LDAP over TLS/SSL' },
  },
  UDP: {
    53: { service: 'DNS', description: 'Domain Name System' },
    67: { service: 'DHCP', description: 'Dynamic Host Configuration Protocol (Server)' },
    68: { service: 'DHCP', description: 'Dynamic Host Configuration Protocol (Client)' },
    69: { service: 'TFTP', description: 'Trivial File Transfer Protocol' },
    123: { service: 'NTP', description: 'Network Time Protocol' },
    161: { service: 'SNMP', description: 'Simple Network Management Protocol' },
    162: { service: 'SNMPTRAP', description: 'SNMP Trap' },
    514: { service: 'Syslog', description: 'System Logging Protocol' },
  }
} as const;

export class PortScanError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'PortScanError';
  }
}
