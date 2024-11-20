import { z } from 'zod';

export interface IPValidationResult {
  isValid: boolean;
  type?: 'IPv4' | 'IPv6';
  error?: string;
}

export const validateIPAddress = (ip: string): IPValidationResult => {
  const trimmedIP = ip.trim();
  
  if (!trimmedIP) {
    return {
      isValid: false,
      error: 'IP address cannot be empty'
    };
  }

  if (isValidIPv4(trimmedIP)) {
    return {
      isValid: true,
      type: 'IPv4'
    };
  }

  if (isValidIPv6(trimmedIP)) {
    return {
      isValid: true,
      type: 'IPv6'
    };
  }

  // Determine specific error message
  if (trimmedIP.includes('.')) {
    const parts = trimmedIP.split('.');
    if (parts.length !== 4) {
      return {
        isValid: false,
        error: 'IPv4 address must contain exactly 4 parts separated by dots'
      };
    }
    const invalidPart = parts.find(part => {
      const num = parseInt(part, 10);
      return isNaN(num) || num < 0 || num > 255;
    });
    if (invalidPart) {
      return {
        isValid: false,
        error: `Invalid IPv4 part: ${invalidPart}. Each part must be between 0 and 255`
      };
    }
  } else if (trimmedIP.includes(':')) {
    return {
      isValid: false,
      error: 'Invalid IPv6 format. Example of valid format: 2001:0db8:85a3::8a2e:0370:7334'
    };
  }

  return {
    isValid: false,
    error: 'Invalid IP address format. Please enter a valid IPv4 (e.g., 8.8.8.8) or IPv6 (e.g., 2001:4860:4860::8888) address'
  };
};

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

// Zod schema for DNS server validation
export const dnsServerSchema = z.string().refine(
  (value) => {
    const result = validateIPAddress(value);
    return result.isValid;
  },
  {
    message: 'Please enter a valid IPv4 (e.g., 8.8.8.8) or IPv6 (e.g., 2001:4860:4860::8888) address'
  }
);
