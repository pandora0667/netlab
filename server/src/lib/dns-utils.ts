import { z } from 'zod';

export const isValidIPv4 = (ip: string): boolean => {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;
  
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

export const isValidIPv6 = (ip: string): boolean => {
  try {
    const address = ip.toLowerCase().trim();
    const parts = address.split(':');
    if (parts.length < 2 || parts.length > 8) return false;
    
    const hasEmptyPart = parts.some(part => part === '');
    const emptyPartCount = parts.filter(part => part === '').length;
    
    if (emptyPartCount > 1) return false;
    if (hasEmptyPart && emptyPartCount === 0) return false;
    
    const validParts = parts.filter(part => part !== '');
    return validParts.every(part => /^[0-9a-f]{1,4}$/.test(part));
  } catch (error) {
    return false;
  }
};

export const dnsServerSchema = z.string().refine(
  (value) => value === '' || isValidIPv4(value) || isValidIPv6(value),
  {
    message: 'Invalid IP address format'
  }
);
