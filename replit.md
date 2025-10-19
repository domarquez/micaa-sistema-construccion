# MICAA - Sistema Integral de Construcción y Arquitectura

## Overview
MICAA is a comprehensive construction management platform designed for Bolivia. Its main purpose is to streamline construction project management by offering budget estimation, material pricing, activity management, and supplier integration. Key capabilities include APU (Análisis de Precios Unitarios) calculations, regional price adjustments, and a marketplace for construction materials and suppliers. The business vision is to provide an essential tool for the Bolivian construction sector, enhancing efficiency and connectivity.

## Recent Changes (October 2025)
- **PWA Implementation**: Full Progressive Web App configuration with manifest.json, service worker, and multi-size icons
- **App Icons**: Custom construction-themed icons in sizes 96x96, 144x144, 192x192, 256x256, 384x384, 512x512 plus Apple Touch icons and favicons
- **Offline Support**: Service worker enabled for basic offline functionality and faster load times
- **NewsRotator Component**: Created new mobile-optimized news rotator displaying real-time construction industry news from external Neon database
- **External News Database Integration**: Connected to external PostgreSQL database (noticiascons) with table `noticias_construccion_bolivia` containing real sector news
- **3-Tier News Fetching System**: (1) External database as primary source, (2) Web scraping as fallback, (3) Sample news as last resort
- **Automatic News Updates**: System fetches and updates construction news every 6 hours (00:00, 06:00, 12:00, 18:00) and on server startup
- **Mobile-First Design**: Ultra-compact news display optimized for Samsung A05 with responsive text sizes, minimal padding, and touch-friendly navigation
- **Advertising System**: Maintained dual system - Google AdSense for revenue + company advertisements for registered suppliers
- **Unified User Experience**: News rotator integrated across all views (anonymous, authenticated, mobile, desktop)
- **Responsive CSS Consolidation**: Replaced 5+ conflicting `.mobile-padding`/`.mobile-ultra-compact` definitions with tiered responsive system using CSS custom properties (--rs-spacing, --rs-padding-x) toggled by media queries at ultra (≤360px), small (361-480px), compact (481-767px), and base (≥768px) breakpoints
- **Component Wrappers**: Created `.ad-shell`, `.news-panel`, `.table-responsive`, `.auth-card` wrapper classes with `max-width: 100%`, `overflow-x: hidden`, `min-width: 0` to prevent horizontal overflow on all components
- **Overflow Prevention**: Systematic refactoring of Google AdSense ads, NewsRotator, CompanyAdvertisementCarousel, material tables, and auth screens to use component wrappers and eliminate `!important` cascade conflicts
- **Header Optimization (520-560px)**: Fixed header overflow at 520-560px breakpoint with optimized button sizes (text-[9px]), reduced spacing (gap-0.5), hidden "Anónimo" badge on mobile, and flex-shrink controls
- **Google AdSense Aggressive Protection**: Added !important CSS rules to force all AdSense ads, iframes, and children to respect 100% container width, preventing overflow from dynamically injected ad content
- **Advertisement Components Update**: All ad components (AdMobile, AdInFeed, AdFooter, CompanyAdMobile, CompanyAdvertisementCarousel) now have explicit max-w-full and overflow-hidden protection at multiple levels

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Framework**: React 18 with TypeScript, Vite build tool.
- **UI Library**: Shadcn/ui components leveraging Radix UI primitives.
- **Styling**: Tailwind CSS with CSS variables for dynamic theming.
- **Responsiveness**: Fluid responsive design utilizing `rem` units, `clamp()` for typography and spacing, and `min()` for container constraints. Mobile-first approach with optimized touch targets and compact layouts.
- **Mobile Optimization**: Ultra-compact design with square component layouts, minimal padding (0.25rem on mobile), and aggressive space optimization for small screens ≤480px.
- **PWA Support**: Progressive Web App with installable manifest, service worker for offline caching, and custom construction-themed icons.
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
- **Mobile Components**: Square-format advertising carousel and responsive news rotator with controlled layouts, optimized for mobile viewing with minimal vertical space usage.
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