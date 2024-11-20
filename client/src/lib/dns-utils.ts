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
    if (hasEmptyPart && emptyPartCount > 1) return false;
    
    return parts.every(part => {
      if (part === '') return true;
      if (!/^[0-9a-f]{1,4}$/.test(part)) return false;
      return true;
    });
  } catch {
    return false;
  }
};

export const validateDNSServer = async (serverIP: string): Promise<{
  isValid: boolean;
  error?: string;
}> => {
  try {
    // 빈 문자열이면 유효한 것으로 처리 (선택적 필드이므로)
    if (!serverIP.trim()) {
      return {
        isValid: true
      };
    }

    // IP 형식 검증
    if (!isValidIPv4(serverIP) && !isValidIPv6(serverIP)) {
      return {
        isValid: false,
        error: '유효하지 않은 IP 주소 형식입니다.'
      };
    }

    // 서버 API를 통한 DNS 서버 검증
    const response = await fetch('/api/dns/validate-server', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ server: serverIP }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        isValid: false,
        error: error.message || 'DNS 서버 검증에 실패했습니다.'
      };
    }

    const data = await response.json();
    return {
      isValid: data.isValid,
      error: data.error
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'DNS 서버 검증 중 오류가 발생했습니다.'
    };
  }
};

// Zod 스키마 업데이트
export const dnsServerSchema = z.string().refine(
  async (value) => {
    if (!value.trim()) return true;
    const result = await validateDNSServer(value);
    return result.isValid;
  },
  {
    message: '유효하지 않은 DNS 서버입니다.'
  }
);
