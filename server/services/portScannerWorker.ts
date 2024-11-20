import { parentPort, workerData } from 'worker_threads';
import * as net from 'net';
import * as dgram from 'dgram';
import * as path from 'path';
import * as Worker from 'worker_threads';

interface WorkerData {
  ports: number[];
  targetIp: string;
  protocol: 'TCP' | 'UDP';
  timeout?: number;
}

if (!parentPort || !workerData) {
  throw new Error('This file must be run as a worker thread');
}

const { ports, targetIp, protocol, timeout } = workerData as WorkerData;

// Validate ports data
if (!Array.isArray(ports) || !ports.every(p => typeof p === 'number')) {
  throw new Error('Invalid ports configuration: ports must be an array of numbers');
}

async function scanPort(port: number): Promise<{ port: number; status: string }> {
  return new Promise((resolve) => {
    if (protocol === 'TCP') {
      const socket = new net.Socket();
      let status = 'Filtered';
      
      socket.setTimeout(timeout || 1500);

      socket.on('connect', () => {
        status = 'Open';
        socket.destroy();
      });

      socket.on('error', (error) => {
        if (error.message.includes('ECONNREFUSED')) {
          status = 'Closed';
        } else if (error.message.includes('ETIMEDOUT')) {
          status = 'Filtered';
        }
      });

      socket.on('timeout', () => {
        status = 'Filtered';
        socket.destroy();
      });

      socket.on('close', () => {
        resolve({ port, status });
      });

      socket.connect({
        host: targetIp,
        port: port
      });
    } else {
      // UDP scanning
      const socket = dgram.createSocket('udp4');
      const timeoutDuration = timeout || 1500;
      
      const cleanup = () => {
        socket.close();
        socket.removeAllListeners();
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        resolve({ port, status: 'Open|Filtered' });
      }, timeoutDuration);

      socket.on('error', (err: Error & { code?: string }) => {
        clearTimeout(timeoutId);
        cleanup();
        
        let status: string;
        switch (err.code) {
          case 'ECONNREFUSED':
            status = 'Closed';
            break;
          case 'EHOSTUNREACH':
            status = 'Filtered';
            break;
          case 'EACCES':
            status = 'Permission Denied';
            break;
          default:
            status = 'Error';
        }
        
        resolve({ port, status });
      });

      socket.send(Buffer.from(''), 0, 0, port, targetIp, (err) => {
        if (err) {
          clearTimeout(timeoutId);
          cleanup();
          resolve({ port, status: 'Error' });
        }
      });
    }
  });
}

async function scanPorts() {
  try {
    const results: { [key: number]: string } = {};
    const sortedPorts: number[] = ports.sort((a: number, b: number) => a - b);
    
    // Concurrent port scanning with limited batch size
    const BATCH_SIZE = 50;
    for (let i = 0; i < sortedPorts.length; i += BATCH_SIZE) {
      const batch = sortedPorts.slice(i, i + BATCH_SIZE);
      const promises = batch.map(port => scanPort(port));
      const batchResults = await Promise.all(promises);
      
      batchResults.forEach(result => {
        results[result.port] = result.status;
      });
    }

    if (parentPort) {
      parentPort.postMessage({ type: 'portResult', data: results });
      parentPort.postMessage({ type: 'completed' });
    }
  } catch (error) {
    if (parentPort) {
      parentPort.postMessage({ 
        type: 'error', 
        data: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          ports: ports
        } 
      });
    }
  }
}

scanPorts();
