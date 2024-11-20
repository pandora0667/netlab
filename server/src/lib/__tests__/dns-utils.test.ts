import { validateIPAddress, isValidIPv4, isValidIPv6 } from '../dns-utils';

describe('DNS Utilities', () => {
  describe('validateIPAddress', () => {
    it('should validate correct IPv4 addresses', () => {
      const validIPv4s = [
        '192.168.1.1',
        '8.8.8.8',
        '255.255.255.255',
        '0.0.0.0'
      ];

      validIPv4s.forEach(ip => {
        const result = validateIPAddress(ip);
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('IPv4');
        expect(result.error).toBeUndefined();
      });
    });

    it('should validate correct IPv6 addresses', () => {
      const validIPv6s = [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        '2001:db8:85a3::8a2e:370:7334',
        'fe80::1',
        '::1'
      ];

      validIPv6s.forEach(ip => {
        const result = validateIPAddress(ip);
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('IPv6');
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid IPv4 addresses', () => {
      const invalidIPv4s = [
        '256.1.2.3',
        '1.2.3.4.5',
        '192.168.1',
        'a.b.c.d',
        '192.168.1.'
      ];

      invalidIPv4s.forEach(ip => {
        const result = validateIPAddress(ip);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject invalid IPv6 addresses', () => {
      const invalidIPv6s = [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334:',
        '::::::',
        '2001:0db8:85a3:0000:0000:8a2e:0370:733g',
        '1:2:3:4:5:6:7:8:9'
      ];

      invalidIPv6s.forEach(ip => {
        const result = validateIPAddress(ip);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should handle empty input', () => {
      const result = validateIPAddress('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('IP address cannot be empty');
    });

    it('should handle whitespace input', () => {
      const result = validateIPAddress('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('IP address cannot be empty');
    });
  });
});
