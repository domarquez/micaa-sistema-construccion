import { useEffect, useState } from 'react';
import { ExternalLink, Eye, Users } from 'lucide-react';

interface SiteStats {
  visitCount: number;
  registeredUsers: number;
}

export function AppFooter() {
  const currentYear = new Date().getFullYear();
  const [stats, setStats] = useState<SiteStats>({ visitCount: 30433, registeredUsers: 174 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/site-stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching site stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <footer className="bg-gray-900 text-gray-400 py-3 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5" data-testid="stats-visits">
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-medium text-white">{stats.visitCount.toLocaleString()}</span>
              <span>visitas</span>
            </div>
            <div className="flex items-center gap-1.5" data-testid="stats-users">
              <Users className="w-3.5 h-3.5 text-green-400" />
              <span className="font-medium text-white">{stats.registeredUsers.toLocaleString()}</span>
              <span>registrados</span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs border-t border-gray-700 pt-2">
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
      </div>
    </footer>
  );
}
