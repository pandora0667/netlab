// WebSocket Message Type Definition
export type WebSocketMessage<T = any> = {
  type: string;
  data: T;
};

// WebSocket Service Domain Definition
export enum WebSocketDomain {
  DNS_PROPAGATION = '/ws/dns-propagation',
  NETWORK_SPEED = '/ws/network-speed',
  LATENCY_CHECK = '/ws/latency-check',
  PING = '/ws/ping',
}

// WebSocket Configuration Type
export interface WebSocketConfig {
  domain: WebSocketDomain;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
  onOpen?: () => void;
}
