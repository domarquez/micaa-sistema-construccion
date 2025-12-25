import { ExternalLink } from 'lucide-react';

export function AppFooter() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-900 text-gray-400 py-4 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-1">
            <span>MICAA © {currentYear}</span>
            <span className="hidden sm:inline">- Sistema de Construcción Bolivia</span>
          </div>
          
          <div className="flex items-center gap-1">
            <span>Desarrollado por</span>
            <a 
              href="https://www.xsoleil.lat" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1 transition-colors"
              data-testid="link-creator"
            >
              xsoleil.lat
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
