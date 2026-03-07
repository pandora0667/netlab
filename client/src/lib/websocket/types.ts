// WebSocket Message Type Definition
export type WebSocketMessage<T = any> = {
  type: string;
  data: T;
};

// WebSocket Service Domain Definition
export enum WebSocketDomain {
  DNS_PROPAGATION = '/ws/dns-propagation',
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
