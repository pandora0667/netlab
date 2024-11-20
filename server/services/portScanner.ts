import net from 'net';
import { EventEmitter } from 'events';
import { RemoteInfo } from 'dgram';

export interface ScanOptions {
  targetIp: string;
  portRange: [number, number];
  protocol: 'TCP' | 'UDP' | 'BOTH';
  timeout?: number;
  exportFormat?: 'JSON' | 'CSV';
  onProgress?: (progress: number, currentResults: ScanResult) => void;
}

export interface ScanResult {
  TCP?: { [key: number]: string };
  UDP?: { [key: number]: string };
}

export type PortStatus = 'Open' | 'Closed' | 'Filtered';

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
} as const;

// Common service probes
const serviceProbes = {
  80: 'GET / HTTP/1.0\r\n\r\n',
  443: '\\x16\\x03\\x01\\x00\\x50\\x01\\x00\\x00\\x4c\\x03\\x03',
  22: '\\x53\\x53\\x48\\x2d\\x32\\x2e\\x30\\x2d\\x4f\\x70\\x65\\x6e\\x53\\x53\\x48',
  25: 'EHLO example.com\r\n',
  21: 'USER anonymous\r\n',
};

export function exportResults(results: ScanResult, format: 'JSON' | 'CSV'): string {
  if (format === 'JSON') {
    return JSON.stringify(results, null, 2);
  } else {
    let csv = 'Protocol,Port,Status\n';
    if (results.TCP) {
      Object.entries(results.TCP).forEach(([port, status]) => {
        csv += `TCP,${port},${status}\n`;
      });
    }
    if (results.UDP) {
      Object.entries(results.UDP).forEach(([port, status]) => {
        csv += `UDP,${port},${status}\n`;
      });
    }
    return csv;
  }
}

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

export async function portScan(options: ScanOptions): Promise<ScanResult> {
  const { targetIp, portRange, protocol, timeout = 1000 } = options;
  const results: ScanResult = {};
  const [startPort, endPort] = portRange;
  
  const BATCH_SIZE = 50;
  const ports = Array.from(
    { length: endPort - startPort + 1 }, 
    (_, i) => startPort + i
  );

  async function scanPort(port: number): Promise<void> {
    return new Promise((resolve) => {
      let tcpCompleted = protocol === 'UDP';  // true if TCP is not needed
      let udpCompleted = protocol === 'TCP';  // true if UDP is not needed

      const checkCompletion = () => {
        if (tcpCompleted && udpCompleted) {
          resolve();
        }
      };

      if (protocol === 'TCP' || protocol === 'BOTH') {
        const socket = new net.Socket();
        let isResolved = false;

        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            results.TCP = results.TCP || {};
            results.TCP[port] = 'Filtered';
            socket.destroy();
            tcpCompleted = true;
            checkCompletion();
          }
        }, timeout);

        socket.on('connect', () => {
          if (!isResolved) {
            isResolved = true;
            results.TCP = results.TCP || {};
            results.TCP[port] = 'Open';
            socket.destroy();
            clearTimeout(timeoutId);
            tcpCompleted = true;
            checkCompletion();
          }
        });

        socket.on('error', (error) => {
          if (!isResolved) {
            isResolved = true;
            results.TCP = results.TCP || {};
            if (error.message.includes('ECONNREFUSED')) {
              results.TCP[port] = 'Closed';
            } else {
              results.TCP[port] = 'Filtered';
            }
            socket.destroy();
            clearTimeout(timeoutId);
            tcpCompleted = true;
            checkCompletion();
          }
        });

        socket.connect({ port, host: targetIp });
      }
      
      if (protocol === 'UDP' || protocol === 'BOTH') {
        try {
          const socket = require('dgram').createSocket('udp4');
          let isResolved = false;
          let responseReceived = false;

          // 서비스별 맞춤 페이로드
          const getUDPPayload = (port: number): Buffer => {
            switch (port) {
              case 53:  // DNS
                return Buffer.from([
                  0x00, 0x00,  // Transaction ID
                  0x01, 0x00,  // Flags: standard query
                  0x00, 0x01,  // Questions: 1
                  0x00, 0x00,  // Answer RRs: 0
                  0x00, 0x00,  // Authority RRs: 0
                  0x00, 0x00,  // Additional RRs: 0
                  0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65,  // "example"
                  0x03, 0x63, 0x6f, 0x6d,  // "com"
                  0x00,  // null terminator
                  0x00, 0x01,  // Type: A
                  0x00, 0x01   // Class: IN
                ]);
              case 161: // SNMP
                return Buffer.from([
                  0x30, 0x26, 0x02, 0x01, 0x01, 0x04, 0x06, 0x70,
                  0x75, 0x62, 0x6c, 0x69, 0x63, 0xa0, 0x19, 0x02,
                  0x04, 0x6b, 0x8b, 0x44, 0x5b, 0x02, 0x01, 0x00,
                  0x02, 0x01, 0x00, 0x30, 0x0b, 0x30, 0x09, 0x06,
                  0x05, 0x2b, 0x06, 0x01, 0x02, 0x01
                ]);
              case 123: // NTP
                return Buffer.from([
                  0x1b, 0x00, 0x00, 0x00,  // LI, VN, Mode
                  0x00, 0x00, 0x00, 0x00,  // Stratum, Poll, Precision
                  0x00, 0x00, 0x00, 0x00,  // Root Delay
                  0x00, 0x00, 0x00, 0x00,  // Root Dispersion
                  0x00, 0x00, 0x00, 0x00,  // Reference ID
                  0x00, 0x00, 0x00, 0x00,  // Reference Timestamp
                  0x00, 0x00, 0x00, 0x00,
                  0x00, 0x00, 0x00, 0x00,  // Origin Timestamp
                  0x00, 0x00, 0x00, 0x00,
                  0x00, 0x00, 0x00, 0x00,  // Receive Timestamp
                  0x00, 0x00, 0x00, 0x00,
                  0x00, 0x00, 0x00, 0x00,  // Transmit Timestamp
                  0x00, 0x00, 0x00, 0x00
                ]);
              default:
                return Buffer.from([0x00]);
            }
          };

          const payload = getUDPPayload(port);

          // 여러 번 시도
          const maxRetries = 2;
          let retryCount = 0;
          
          const sendProbe = () => {
            if (retryCount < maxRetries && !isResolved) {
              socket.send(payload, 0, payload.length, port, targetIp, (err: Error) => {
                if (err && !isResolved) {
                  isResolved = true;
                  results.UDP = results.UDP || {};
                  results.UDP[port] = 'Error';
                  socket.close();
                  udpCompleted = true;
                  checkCompletion();
                }
              });
              retryCount++;
            }
          };

          socket.on('listening', () => {
            sendProbe();
            // 첫 번째 시도 후 일정 시간 후에 재시도
            setTimeout(sendProbe, timeout / 2);
          });

          socket.on('message', (msg: Buffer, rinfo: RemoteInfo) => {
            if (!isResolved && rinfo.address === targetIp) {
              responseReceived = true;
              isResolved = true;
              results.UDP = results.UDP || {};
              results.UDP[port] = 'Open';
              socket.close();
              udpCompleted = true;
              checkCompletion();
            }
          });

          socket.on('error', (error: Error & { code?: string }) => {
            if (!isResolved) {
              isResolved = true;
              results.UDP = results.UDP || {};
              switch (error.code) {
                case 'ECONNREFUSED':
                  results.UDP[port] = 'Closed';
                  break;
                case 'EHOSTUNREACH':
                case 'EACCES':
                  results.UDP[port] = 'Filtered';
                  break;
                default:
                  results.UDP[port] = 'Filtered';
              }
              socket.close();
              udpCompleted = true;
              checkCompletion();
            }
          });

          const timeoutId = setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              results.UDP = results.UDP || {};
              // 응답이 없으면 Open|Filtered로 판단
              results.UDP[port] = responseReceived ? 'Open' : 'Open|Filtered';
              socket.close();
              udpCompleted = true;
              checkCompletion();
            }
          }, timeout);

          socket.bind();
        } catch (error) {
          results.UDP = results.UDP || {};
          results.UDP[port] = 'Error';
          udpCompleted = true;
          checkCompletion();
        }
      }
    });
  }

  for (let i = 0; i < ports.length; i += BATCH_SIZE) {
    const batch = ports.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(port => scanPort(port)));
    
    if (options.onProgress) {
      const progress = Math.min(100, ((i + BATCH_SIZE) / ports.length) * 100);
      options.onProgress(progress, results);
    }
  }

  return results;
}
