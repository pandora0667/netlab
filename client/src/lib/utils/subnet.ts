import { z } from "zod";

// Constants for validation
const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;
const CIDR_PATTERN = /^\/\d{1,2}$/;
const NETMASK_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;

// Utility functions for subnet calculations
export function isValidIP(ip: string): boolean {
  if (!IP_PATTERN.test(ip)) return false;
  return ip.split('.').every(octet => {
    const num = parseInt(octet);
    return num >= 0 && num <= 255;
  });
}

export function cidrToNetmask(cidr: number): string {
  const mask = ~((1 << (32 - cidr)) - 1);
  return [
    (mask >>> 24) & 255,
    (mask >>> 16) & 255,
    (mask >>> 8) & 255,
    mask & 255,
  ].join('.');
}

export function netmaskToCidr(netmask: string): number {
  return netmask.split('.').reduce((bits, octet) => {
    return bits + (parseInt(octet) >>> 0).toString(2).split('1').length - 1;
  }, 0);
}

export function calculateSubnetInfo(networkAddress: string, maskBits: number) {
  const octets = networkAddress.split('.').map(Number);
  const mask = parseInt('1'.repeat(maskBits) + '0'.repeat(32 - maskBits), 2);
  
  // Calculate network address
  const networkNum = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) & mask;
  
  // Calculate broadcast address
  const broadcastNum = networkNum | (~mask >>> 0);
  
  // Convert back to string format
  const network = [
    (networkNum >>> 24) & 255,
    (networkNum >>> 16) & 255,
    (networkNum >>> 8) & 255,
    networkNum & 255,
  ].join('.');
  
  const broadcast = [
    (broadcastNum >>> 24) & 255,
    (broadcastNum >>> 16) & 255,
    (broadcastNum >>> 8) & 255,
    broadcastNum & 255,
  ].join('.');
  
  const numHosts = Math.pow(2, 32 - maskBits) - 2;
  
  // Calculate first and last usable IP
  const firstUsable = incrementIP(network);
  const lastUsable = decrementIP(broadcast);
  
  return {
    networkAddress: network,
    broadcastAddress: broadcast,
    firstUsableIP: firstUsable,
    lastUsableIP: lastUsable,
    numHosts,
    netmask: cidrToNetmask(maskBits),
    subnetMask: maskBits,
  };
}

export function incrementIP(ip: string): string {
  const parts = ip.split('.').map(Number);
  for (let i = 3; i >= 0; i--) {
    parts[i]++;
    if (parts[i] <= 255) break;
    parts[i] = 0;
  }
  return parts.join('.');
}

export function decrementIP(ip: string): string {
  const parts = ip.split('.').map(Number);
  for (let i = 3; i >= 0; i--) {
    parts[i]--;
    if (parts[i] >= 0) break;
    parts[i] = 255;
  }
  return parts.join('.');
}

export function divideSubnet(networkAddress: string, currentMask: number, newMask: number) {
  if (newMask <= currentMask) throw new Error("New mask must be larger than current mask");
  
  const subnets: ReturnType<typeof calculateSubnetInfo>[] = [];
  const numSubnets = Math.pow(2, newMask - currentMask);
  
  let currentNetwork = networkAddress;
  for (let i = 0; i < numSubnets; i++) {
    subnets.push(calculateSubnetInfo(currentNetwork, newMask));
    // Calculate next network address
    const octets = currentNetwork.split('.').map(Number);
    const hostBits = 32 - newMask;
    const increment = Math.pow(2, hostBits);
    let num = ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
    num += increment;
    currentNetwork = [
      (num >>> 24) & 255,
      (num >>> 16) & 255,
      (num >>> 8) & 255,
      num & 255,
    ].join('.');
  }
  
  return subnets;
}

export function areAdjacent(subnet1: ReturnType<typeof calculateSubnetInfo>, subnet2: ReturnType<typeof calculateSubnetInfo>): boolean {
  if (subnet1.subnetMask !== subnet2.subnetMask) return false;
  
  const broadcast1Parts = subnet1.broadcastAddress.split('.').map(Number);
  const network2Parts = subnet2.networkAddress.split('.').map(Number);
  
  const broadcast1Num = ((broadcast1Parts[0] << 24) >>> 0) + (broadcast1Parts[1] << 16) + 
                       (broadcast1Parts[2] << 8) + broadcast1Parts[3];
  const network2Num = ((network2Parts[0] << 24) >>> 0) + (network2Parts[1] << 16) + 
                     (network2Parts[2] << 8) + network2Parts[3];
                     
  return broadcast1Num + 1 === network2Num;
}

export function exportToCSV(subnets: ReturnType<typeof calculateSubnetInfo>[], visibleColumns: string[]) {
  return subnets.map(subnet => {
    return [
      subnet.networkAddress,
      subnet.broadcastAddress,
      subnet.firstUsableIP,
      subnet.lastUsableIP,
      subnet.numHosts,
      `${subnet.netmask} (/${subnet.subnetMask})`
    ].join(',');
  }).join('\n');
}
