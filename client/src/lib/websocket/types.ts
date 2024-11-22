// WebSocket 메시지 타입 정의
export type WebSocketMessage<T = any> = {
  type: string;
  data: T;
};

// WebSocket 서비스 도메인 정의
export enum WebSocketDomain {
  DNS_PROPAGATION = '/ws/dns-propagation',
  NETWORK_SPEED = '/ws/network-speed',
  LATENCY_CHECK = '/ws/latency-check',
}

// WebSocket 설정 타입
export interface WebSocketConfig {
  domain: WebSocketDomain;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
  onOpen?: () => void;
}
