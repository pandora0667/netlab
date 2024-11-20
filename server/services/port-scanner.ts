import { Worker } from 'worker_threads';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ScanOptions {
  targetIp: string;
  portRange: [number, number];
  protocol: 'TCP' | 'UDP' | 'BOTH';
  timeout?: number;
  exportFormat?: 'JSON' | 'CSV';
}

interface ScanResult {
  TCP?: { [key: number]: string };
  UDP?: { [key: number]: string };
}

// 메인 스캔 함수
export async function portScan(options: ScanOptions): Promise<ScanResult> {
  const {
    targetIp,
    portRange,
    protocol,
    timeout = 1000,
    exportFormat
  } = options;

  const [startPort, endPort] = portRange;
  const ports = Array.from({ length: endPort - startPort + 1 }, (_, i) => startPort + i);
  const numWorkers = Math.min(10, ports.length); // 최대 10개의 워커
  const portsPerWorker = Math.ceil(ports.length / numWorkers);
  const results: ScanResult = {};

  async function scanWithProtocol(proto: 'TCP' | 'UDP') {
    const workers: Worker[] = [];
    const protocolResults: { [key: number]: string } = {};

    for (let i = 0; i < numWorkers; i++) {
      const start = i * portsPerWorker;
      const workerPorts = ports.slice(start, start + portsPerWorker);
      
      if (workerPorts.length === 0) continue;

      // Worker 코드를 문자열로 생성
      const workerCode = `
        import { parentPort, workerData } from 'worker_threads';
        import * as net from 'net';
        import * as dgram from 'dgram';

        async function scanTCPPort(ip, port, timeout) {
          return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(timeout);

            socket.on('connect', () => {
              socket.destroy();
              resolve('Open');
            });

            socket.on('timeout', () => {
              socket.destroy();
              resolve('Closed');
            });

            socket.on('error', () => {
              socket.destroy();
              resolve('Closed');
            });

            socket.connect(port, ip);
          });
        }

        async function scanUDPPort(ip, port, timeout) {
          return new Promise((resolve) => {
            const socket = dgram.createSocket('udp4');
            const message = Buffer.from('Scanner probe');
            let responded = false;

            socket.on('message', () => {
              responded = true;
              socket.close();
              resolve('Open');
            });

            socket.on('error', () => {
              socket.close();
              resolve('Closed');
            });

            setTimeout(() => {
              if (!responded) {
                socket.close();
                resolve('Closed');
              }
            }, timeout);

            socket.send(message, port, ip, (error) => {
              if (error) {
                socket.close();
                resolve('Closed');
              }
            });
          });
        }

        async function workerScan() {
          if (!parentPort || !workerData) return;

          const { ip, ports, protocol, timeout } = workerData;
          const results = {};

          const scanFn = protocol === 'TCP' ? scanTCPPort : scanUDPPort;

          for (const port of ports) {
            results[port] = await scanFn(ip, port, timeout);
          }

          parentPort.postMessage(results);
        }

        workerScan();
      `;

      // Worker 생성
      const worker = new Worker(workerCode, { 
        eval: true,
        workerData: {
          ip: targetIp,
          ports: workerPorts,
          protocol: proto,
          timeout
        }
      });

      workers.push(worker);

      worker.on('message', (workerResults) => {
        Object.assign(protocolResults, workerResults);
      });
    }

    await Promise.all(workers.map(worker => 
      new Promise(resolve => worker.on('exit', resolve))
    ));

    return protocolResults;
  }

  if (protocol === 'TCP' || protocol === 'BOTH') {
    results.TCP = await scanWithProtocol('TCP');
  }

  if (protocol === 'UDP' || protocol === 'BOTH') {
    results.UDP = await scanWithProtocol('UDP');
  }

  // Export results if requested
  if (exportFormat) {
    if (exportFormat === 'CSV') {
      // TODO: Implement CSV export
    }
  }

  return results;
}
