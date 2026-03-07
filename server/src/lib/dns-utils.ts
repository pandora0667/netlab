import { z } from 'zod';
import { validateIPAddress } from '../../../shared/network/ip';

export {
  isValidIPv4,
  isValidIPv6,
  normalizeIPAddress,
  validateIPAddress,
  type IPValidationResult,
} from '../../../shared/network/ip';

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
