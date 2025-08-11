# MICAA - Sistema Integral de Construcción y Arquitectura

## Overview
MICAA is a comprehensive construction management platform designed for Bolivia. Its main purpose is to streamline construction project management by offering budget estimation, material pricing, activity management, and supplier integration. Key capabilities include APU (Análisis de Precios Unitarios) calculations, regional price adjustments, and a marketplace for construction materials and suppliers. The business vision is to provide an essential tool for the Bolivian construction sector, enhancing efficiency and connectivity.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js 20 with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based authentication with bcryptjs
- **File Uploads**: Multer with Sharp for image processing
- **API Design**: RESTful endpoints

### Core Modules
- **User Management**: Authentication, authorization, role-based access.
- **Materials Management**: Catalog with categories, pricing, and supplier relationships.
- **Activities Management**: Construction activities with APU calculations and compositions.
- **Budget Management**: Multi-phase project budgets with detailed item breakdowns.
- **Supplier Network**: Company profiles, pricing, and marketplace integration.
- **Price Intelligence**: Regional price factors and dynamic pricing adjustments.

### Specialized Features
- **APU Calculator**: Detailed unit price analysis following Bolivian construction standards.
- **City Price Factors**: Geographic pricing adjustments for different Bolivian cities.
- **Supplier Marketplace**: Platform for material suppliers with advertising capabilities.
- **Tools & Labor Management**: Equipment and workforce cost tracking.
- **Custom Activities**: User-defined activities with custom compositions.

### Data Flow Principles
- **Authentication**: JWT-based token management for secure user access.
- **Budget Creation**: System-calculated compositions, material price fetching, regional factor application, and final cost computation.
- **Price Calculation**: Integration of base material prices, activity compositions, labor/equipment costs, regional adjustments, administrative costs, utility margins, and tax calculations.

### Deployment Strategy
- **Environments**: Configured for Replit development and Render production deployment.
- **Build Process**: Client (Vite) and Server (esbuild) optimization, static asset serving, Drizzle migrations.
- **Scaling**: Optimized for connection pooling, error handling, asset optimization, and environment-specific plugin loading.

## External Dependencies

- **Database**: `@neondatabase/serverless`, `drizzle-orm`
- **Authentication**: `jsonwebtoken`, `bcryptjs`
- **File Processing**: `multer`, `sharp`
- **UI Components**: `@radix-ui/*` packages
- **Validation**: `zod`, `@hookform/resolvers`
- **Charts**: `recharts`
- **Deployment Platform**: Render
- **Monetization**: Google AdSense (ca-pub-8854811165812956)
- **Email Service**: SMTP (mail.micaa.store) for notifications and password recovery.