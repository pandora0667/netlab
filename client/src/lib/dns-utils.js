import { z } from 'zod';
export const isValidIPv4 = (ip) => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip))
        return false;
    const parts = ip.split('.');
    return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
    });
};
export const isValidIPv6 = (ip) => {
    try {
        const address = ip.toLowerCase().trim();
        const parts = address.split(':');
        if (parts.length < 2 || parts.length > 8)
            return false;
        const hasEmptyPart = parts.some(part => part === '');
        const emptyPartCount = parts.filter(part => part === '').length;
        if (hasEmptyPart && emptyPartCount > 1)
            return false;
        return parts.every(part => {
            if (part === '')
                return true;
            if (!/^[0-9a-f]{1,4}$/.test(part))
                return false;
            return true;
        });
    }
    catch {
        return false;
    }
};
export const validateDNSServer = async (serverIP) => {
    try {
        // 기본적인 IP 형식 검증
        if (!isValidIPv4(serverIP) && !isValidIPv6(serverIP)) {
            return {
                isValid: false,
                error: 'Invalid IP address format'
            };
        }
        // Call the server API to validate the DNS server
        const response = await fetch('/api/dns/validate-server', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                serverIP,
            }),
        });
        if (!response.ok) {
            const error = await response.json();
            return {
                isValid: false,
                error: error.message || 'Failed to validate DNS server',
            };
        }
        const result = await response.json();
        return {
            isValid: result.isValid,
            error: result.error,
        };
    }
    catch (error) {
        return {
            isValid: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
};
// Zod 스키마 업데이트
export const dnsServerSchema = z.string().refine((value) => value === '' || isValidIPv4(value) || isValidIPv6(value), {
    message: 'Invalid IP address format',
});
