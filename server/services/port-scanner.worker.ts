import { parentPort, workerData } from 'worker_threads';
import * as net from 'net';
import * as dgram from 'dgram';

async function scanTCPPort(ip: string, port: number, timeout: number): Promise<string> {
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

async function scanUDPPort(ip: string, port: number, timeout: number): Promise<string> {
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
  const results: { [key: number]: string } = {};

  const scanFn = protocol === 'TCP' ? scanTCPPort : scanUDPPort;

  for (const port of ports) {
    results[port] = await scanFn(ip, port, timeout);
  }

  parentPort.postMessage(results);
}

workerScan();
