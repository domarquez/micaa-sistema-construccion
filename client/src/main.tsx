import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Firefox compatibility polyfills
if (!window.ResizeObserver) {
  // @ts-ignore
  window.ResizeObserver = class ResizeObserver {
    constructor(callback: any) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Check for Firefox specific issues
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

if (isFirefox) {
  console.log('Firefox detected - applying compatibility fixes');
  
  // Apply Firefox-specific styles
  document.documentElement.classList.add('firefox-browser');
}

try {
  const root = document.getElementById("root");
  if (root) {
    createRoot(root).render(<App />);
  } else {
    console.error('Root element not found');
  }
} catch (error) {
  console.error('Error mounting React app:', error);
  
  // Fallback for older browsers
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = '<div style="padding: 20px; text-align: center;"><h2>MICAA - Sistema de Construcción</h2><p>Cargando aplicación...</p><p>Si no carga, intente actualizar la página.</p></div>';
  }
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registrado:', registration.scope);
      })
      .catch((error) => {
        console.log('Error al registrar Service Worker:', error);
      });
  });
}
