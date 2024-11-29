# Netlab - Modern Web Application

## Overview
Netlab is a modern full-stack web application built with Express.js and React, leveraging TypeScript for type safety and reliability. This project demonstrates best practices in modern web development with a focus on user experience and developer productivity.

## Tech Stack
### Frontend
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: 
  - Radix UI (Accessible primitives)
  - Shadcn UI (Pre-built components)
- **State Management**: React Hooks
- **Form Handling**: React Hook Form with Zod validation
- **Development Tools**: Vite
- **Network Visualization**: React Simple Maps

### Backend
- **Runtime**: Node.js (>= 23.0.0)
- **Framework**: Express.js with TypeScript
- **Session Management**: Express Session
- **WebSocket**: ws for real-time updates
- **Development Tools**: tsx for TypeScript execution

## Project Structure
```
.
├── client/                    # Frontend application
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utility functions and configurations
│   │   ├── pages/           # Page components
│   │   └── main.tsx         # Application entry point
│   └── index.html           # HTML template
│
├── server/                   # Backend application
│   ├── routes/              # API route definitions
│   ├── services/            # Business logic and services
│   ├── index.ts             # Server entry point
│   └── vite.ts              # Vite server configuration
│
├── dist/                    # Production build output
├── node_modules/           # Project dependencies
├── package.json            # Project configuration and scripts
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.ts     # Tailwind CSS configuration
└── vite.config.ts         # Vite build configuration
```

## Features
### Network Analysis Tools
#### IP Checker
- Public and private IP address detection
- Geolocation information
- Network interface details
- IPv4 and IPv6 support

#### DNS Tools
##### DNS Lookup
- Multiple record type support (A, AAAA, MX, TXT, NS, etc.)
- Custom DNS server selection
- Detailed record information
- Response time analysis

##### DNS Propagation Checker
- Real-time DNS propagation monitoring
- Support for multiple DNS servers worldwide
- WebSocket-based live updates
- Multiple record type checking
- Detailed propagation status visualization

#### Network Connectivity Tools
##### Ping Tool
- Real-time latency monitoring
- Configurable ping parameters (count, interval)
- WebSocket-based live updates
- Packet loss statistics
- Response time graphs

##### Port Scanner
- Multi-threaded port scanning using Node.js Worker Threads
- TCP and UDP protocol support
- Customizable port ranges and timeout settings
- Real-time scan progress updates via WebSocket
- Common service detection
- Export results in JSON/CSV formats

#### Network Calculator Tools
##### Subnet Calculator
- IPv4 subnet calculations
- CIDR notation support
- Network/Broadcast address calculation
- Available IP range determination
- Subnet mask conversion

#### Domain Tools
##### Whois Lookup
- Domain registration information
- Registrar details
- Name server information
- Domain status checking
- Creation and expiration dates

### Technical Features
- TypeScript for enhanced type safety
- Real-time updates using WebSocket
- Responsive and accessible UI components
- Error handling and validation
- Cross-platform compatibility
- Mobile-friendly interface

## Getting Started

### Prerequisites
- Node.js >= 22.0.0
- npm >= 10.0.0
- Modern web browser with WebSocket support

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd netlab
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Development Mode

1. Start the development server:
```bash
npm run dev
```

2. Start the backend server:
```bash
npm run server:dev
```

The application will be available at `http://localhost:5173`

### Production Build

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.