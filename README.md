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

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js with TypeScript
- **Session Management**: Express Session
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

## Getting Started

### Prerequisites
- Node.js >= 18
- npm or yarn

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
The application runs on port 8080 and serves both the API and client application. In development mode, it utilizes Vite's development server for hot module replacement and fast refresh capabilities.

## Project Configuration
- **TypeScript**: Strict mode enabled for maximum type safety
- **Tailwind CSS**: Custom theme configuration
- **Vite**: Optimized build setup for both development and production
- **Express**: Configured with TypeScript support and session management

## Best Practices
- Component-based architecture
- Type-safe development with TypeScript
- Accessible UI components with Radix UI
- Responsive design with Tailwind CSS
- Separation of concerns between client and server
- Environment-specific configurations

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License
This project is licensed under the MIT License.