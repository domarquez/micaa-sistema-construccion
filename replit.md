# MICAA - Sistema Integral de Construcción y Arquitectura

## Overview
MICAA is a comprehensive construction management platform designed for Bolivia. Its main purpose is to streamline construction project management by offering budget estimation, material pricing, activity management, and supplier integration. Key capabilities include APU (Análisis de Precios Unitarios) calculations, regional price adjustments, and a marketplace for construction materials and suppliers. The business vision is to provide an essential tool for the Bolivian construction sector, enhancing efficiency and connectivity.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Framework**: React 18 with TypeScript, Vite build tool.
- **UI Library**: Shadcn/ui components leveraging Radix UI primitives.
- **Styling**: Tailwind CSS with CSS variables for dynamic theming.
- **Responsiveness**: Fluid responsive design utilizing `rem` units, `clamp()` for typography and spacing, and `min()` for container constraints. Mobile-first approach with optimized touch targets and compact layouts.
- **User Experience**: Anonymous project creation via `sessionStorage` for temporary access, clear color-coded action buttons with tooltips, and professional PDF export for APU documents.

### Technical Implementation
- **Frontend State Management**: TanStack Query for server state, React hooks for local state.
- **Routing**: Wouter for client-side navigation.
- **Forms**: React Hook Form with Zod for validation.
- **Backend Runtime**: Node.js 20 with Express.js.
- **Language**: TypeScript with ES modules.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: JWT-based with bcryptjs for secure password hashing.
- **File Uploads**: Multer for handling file uploads, Sharp for image processing.
- **API Design**: RESTful endpoints.

### Feature Specifications
- **Core Modules**: User management (authentication, authorization, roles), materials catalog, construction activities (with APU and compositions), multi-phase budget management, supplier network with marketplace integration, and regional price intelligence.
- **Specialized Features**: APU Calculator based on Bolivian standards, city-specific price factors, supplier marketplace with advertising, tools & labor cost tracking, and user-defined custom activities.
- **Data Flow**: Secure JWT-based authentication. Budget creation involves system-calculated compositions, material price fetching, regional factor application, and comprehensive cost computation (materials, labor, equipment, admin, utility, tax).
- **PDF Export**: Generation of professional APU PDF documents with detailed breakdowns, project information, and custom activity identification.

### System Design Choices
- **Deployment**: Configured for Replit development and Render production.
- **Build Process**: Optimized client and server builds with Drizzle migrations.
- **Scalability**: Designed for connection pooling, robust error handling, asset optimization, and environment-specific configurations.

## External Dependencies

- **Database**: `@neondatabase/serverless`, `drizzle-orm`
- **Authentication**: `jsonwebtoken`, `bcryptjs`
- **File Processing**: `multer`, `sharp`
- **UI Components**: `@radix-ui/*` packages
- **Validation**: `zod`, `@hookform/resolvers`
- **Charts**: `recharts`
- **Deployment Platform**: Render
- **Monetization**: Google AdSense (publisher ID `ca-pub-8854811165812956`)
- **Email Service**: SMTP (mail.micaa.store) for notifications and password recovery.