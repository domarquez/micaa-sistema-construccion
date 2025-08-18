import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    screens: {
      'xs': '20rem',     // 320px - Extra small devices (fluid)
      'sm': '40rem',     // 640px - Small devices (fluid)
      'md': '48rem',     // 768px - Medium devices (fluid)
      'lg': '64rem',     // 1024px - Large devices (fluid)
      'xl': '80rem',     // 1280px - Extra large devices (fluid)
      '2xl': '96rem',    // 1536px - 2X large devices (fluid)
      'mobile': {'max': '39.9375rem'}, // Mobile-first approach (fluid)
      'tablet': {'min': '40rem', 'max': '63.9375rem'}, // Tablet range (fluid)
      'desktop': {'min': '64rem'}, // Desktop range (fluid)
    },
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      // Fluid spacing system
      spacing: {
        'fluid-xs': 'clamp(0.25rem, 1vw, 0.5rem)',
        'fluid-sm': 'clamp(0.5rem, 2vw, 0.75rem)',
        'fluid-md': 'clamp(0.75rem, 2.5vw, 1rem)',
        'fluid-lg': 'clamp(1rem, 3vw, 1.5rem)',
        'fluid-xl': 'clamp(1.5rem, 4vw, 2rem)',
        'fluid-2xl': 'clamp(2rem, 5vw, 3rem)',
      },
      // Fluid font sizes
      fontSize: {
        'fluid-xs': ['clamp(0.625rem, 2vw, 0.75rem)', { lineHeight: '1.4' }],
        'fluid-sm': ['clamp(0.75rem, 2.5vw, 0.875rem)', { lineHeight: '1.5' }],
        'fluid-base': ['clamp(0.875rem, 3vw, 1rem)', { lineHeight: '1.6' }],
        'fluid-lg': ['clamp(1rem, 3.5vw, 1.125rem)', { lineHeight: '1.6' }],
        'fluid-xl': ['clamp(1.125rem, 4vw, 1.25rem)', { lineHeight: '1.5' }],
        'fluid-2xl': ['clamp(1.25rem, 4.5vw, 1.5rem)', { lineHeight: '1.4' }],
        'fluid-3xl': ['clamp(1.5rem, 5vw, 1.875rem)', { lineHeight: '1.3' }],
        'fluid-4xl': ['clamp(1.875rem, 6vw, 2.25rem)', { lineHeight: '1.2' }],
      },
      // Fluid responsive containers
      maxWidth: {
        'fluid': 'min(90vw, 1200px)',
        'fluid-sm': 'min(95vw, 640px)',
        'fluid-md': 'min(92vw, 768px)',
        'fluid-lg': 'min(90vw, 1024px)',
        'fluid-xl': 'min(88vw, 1280px)',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"), 
    require("@tailwindcss/typography")
  ],
} satisfies Config;
