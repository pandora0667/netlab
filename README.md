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
- Modern React components with TypeScript
- Server-side rendering support
- Responsive and accessible UI using Radix UI
- Efficient styling with Tailwind CSS
- Type-safe backend with Express and TypeScript
- Development and production environment configurations
- Hot module replacement in development

### Network Tools
#### Port Scanner
- Multi-threaded port scanning using Node.js Worker Threads
- Support for both TCP and UDP protocols
- Configurable scan parameters (port range, timeout)
- Real-time scan results with WebSocket updates
- Efficient resource utilization through worker pooling
- Error handling and timeout management
- Inline worker implementation for improved deployment reliability

#### DNS Propagation Checker
- Real-time DNS propagation monitoring
- WebSocket-based updates
- Support for multiple record types
- Global server checking

## Getting Started

### Prerequisites
- Node.js >= 22.0.0
- npm >= 10.0.0

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd netlab
```

2. Install dependencies with legacy peer deps (due to React version compatibility):
```bash
npm install --legacy-peer-deps
```

3. Development Mode:
```bash
# Start development server
npm run dev
```

4. Production Build:
```bash
# Build the application
npm run build

# Start production server
npm start
```

### Development Notes
- The application runs on port 8080 by default
- Uses Vite's development server for hot module replacement
- WebSocket server is automatically started for real-time updates
- API and client application are served from the same server

## Project Configuration
- **TypeScript**: Strict mode enabled for maximum type safety
- **Tailwind CSS**: Custom theme configuration with shadcn/ui integration
- **Vite**: Optimized build setup with ESM support
- **Express**: Configured with TypeScript and WebSocket support

## Troubleshooting

### Common Issues

1. Dependency Conflicts:
   - If you encounter peer dependency issues, use `--legacy-peer-deps` flag
   - Some packages may require specific React versions

2. Build Issues:
   - Clear the dist directory: `rm -rf dist`
   - Rebuild with: `npm run build`

3. WebSocket Connection Issues:
   - Check if port 8080 is available
   - Ensure firewall settings allow WebSocket connections

## Contributing
Contributions are welcome! Please read our contributing guidelines for details on our code of conduct and the process for submitting pull requests.