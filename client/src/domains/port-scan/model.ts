export interface PortInfo {
  port: number;
  service: string;
  description: string;
}

export interface PortGroup {
  name: string;
  ports: PortInfo[];
}

export const PORT_SCAN_MAX_PORTS = 256;
export const PORT_SCAN_MAX_TIMEOUT_MS = 2_000;

export const PORT_GROUPS: PortGroup[] = [
  {
    name: "HTTP/HTTPS",
    ports: [
      { port: 80, service: "HTTP", description: "Hypertext Transfer Protocol" },
      { port: 443, service: "HTTPS", description: "HTTP Secure" },
    ],
  },
  {
    name: "Email",
    ports: [
      { port: 25, service: "SMTP", description: "Simple Mail Transfer Protocol" },
      { port: 587, service: "SMTP", description: "SMTP with STARTTLS" },
      { port: 465, service: "SMTPS", description: "SMTP over SSL" },
      { port: 110, service: "POP3", description: "Post Office Protocol v3" },
      { port: 995, service: "POP3S", description: "POP3 over SSL" },
      { port: 143, service: "IMAP", description: "Internet Message Access Protocol" },
      { port: 993, service: "IMAPS", description: "IMAP over SSL" },
    ],
  },
  {
    name: "File Transfer",
    ports: [
      { port: 20, service: "FTP-DATA", description: "File Transfer Protocol (Data)" },
      { port: 21, service: "FTP", description: "File Transfer Protocol (Control)" },
      { port: 22, service: "SSH/SFTP", description: "Secure Shell/File Transfer" },
      { port: 69, service: "TFTP", description: "Trivial File Transfer Protocol" },
    ],
  },
  {
    name: "Database",
    ports: [
      { port: 1433, service: "MSSQL", description: "Microsoft SQL Server" },
      { port: 3306, service: "MySQL", description: "MySQL Database" },
      { port: 5432, service: "PostgreSQL", description: "PostgreSQL Database" },
      { port: 27017, service: "MongoDB", description: "MongoDB Database" },
      { port: 6379, service: "Redis", description: "Redis Database" },
    ],
  },
];

export type ScanStatus = "Open" | "Closed" | "Filtered" | "Open|Filtered";
export type ScanProtocol = "TCP" | "UDP";
export type ScanMode = "range" | "well-known";
export type ScanTransport = "TCP" | "UDP" | "BOTH";

export interface ScanResult {
  port: number;
  status: ScanStatus;
  protocol: ScanProtocol;
  service?: string;
  description?: string;
}

export interface ScanSummary {
  totalScanned: number;
  openPorts: number;
  filteredPorts: number;
  uncertainPorts: number;
  closedPorts: number;
  results: ScanResult[];
}

export interface ScanProgress {
  scannedPorts: number;
  totalPorts: number;
  percentage: number;
  currentPort?: number;
}

export interface PortScannerFormValues {
  targetIp: string;
  scanMode: ScanMode;
  startPort: number;
  endPort: number;
  selectedGroups: string[];
  protocol: ScanTransport;
  timeout: number;
  showAllPorts: boolean;
}
