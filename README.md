# Netlab - Network Tools Suite

## Overview
Netlab is a full-stack web application built with Express.js and React, providing comprehensive network utilities for administrators and developers. The suite offers essential networking tools through an intuitive web interface, making network diagnostics and management accessible and efficient.

## Tech Stack
- **Backend**: Express.js
- **Frontend**: React 
- **Build Tool**: Vite
- **Package Manager**: npm/yarn
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js
- **UI Components**: Radix UI, Shadcn
- **Form Handling**: React Hook Form
- **Data Fetching**: SWR

## Key Features
- **IP Address Checker**: Validate and analyze IP addresses, including geolocation and network details
- **DNS Lookup Tool**: Query DNS records, nameservers, and perform reverse DNS lookups
- **Subnet Calculator**: Calculate network ranges, subnet masks, and CIDR notations
- **Ping Tool**: Test network connectivity and measure response times
- **WHOIS Lookup**: Retrieve detailed domain registration and ownership information

## Project Structure
```
.
├── server/                      # Backend server code
│   ├── index.ts                # Main server entry point
│   ├── routes.ts               # API route definitions
│   ├── vite.ts                 # Vite server configuration
│   └── services/               # Business logic services
│       └── network.ts          # Network-related services
│
├── client/                     # Frontend application
│   ├── index.html             # Main HTML template
│   └── src/
│       ├── main.tsx           # React entry point
│       ├── index.css          # Global styles
│       ├── lib/               # Utility functions
│       ├── pages/             # Page components
│       └── components/        # React components
│           ├── layout/        # Layout components
│           ├── tools/         # Network tool components
│           └── ui/            # Reusable UI components
│
├── dist/                      # Production build output
│   └── public/               # Static assets
│
└── package.json              # Project dependencies and scripts
```

## Getting Started

### Prerequisites
- Node.js >=18


### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Development
The server runs on port 8080 and serves both the API and client application. In development mode, it uses Vite's development server for hot module replacement.

### API Endpoints   
- /api/ip - Get IP information
- /api/dns - DNS lookup
- /api/subnet - Subnet calculation
- /api/ping - Ping host
- /api/whois - WHOIS lookup


## Contributing
Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## Support
For support, please open an issue in the GitHub repository or contact the maintainers.

For detailed code examples and implementation details, please refer to the source code in the repository.