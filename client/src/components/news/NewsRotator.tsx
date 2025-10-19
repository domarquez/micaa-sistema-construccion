import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Newspaper } from 'lucide-react';

interface NewsItem {
  id: number;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl?: string;
  category: string;
  publishedAt: string;
}

const categoryColors: Record<string, string> = {
  economia: 'bg-blue-100 text-blue-700',
  gobierno: 'bg-green-100 text-green-700',
  obras: 'bg-orange-100 text-orange-700',
  tecnologia: 'bg-purple-100 text-purple-700',
  normativa: 'bg-red-100 text-red-700',
  construccion: 'bg-yellow-100 text-yellow-700',
  general: 'bg-gray-100 text-gray-700'
};

const categoryLabels: Record<string, string> = {
  economia: 'Economía',
  gobierno: 'Gobierno',
  obras: 'Obras',
  tecnologia: 'Tecnología',
  normativa: 'Normativa',
  construccion: 'Construcción',
  general: 'General'
};

export function NewsRotator() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Obtener noticias del API
  const { data: newsData, isLoading, isError } = useQuery<NewsItem[]>({
    queryKey: ["/api/public/construction-news"],
    staleTime: 5 * 60 * 1000,
    retry: 2
  });

  // Auto-rotación cada 5 segundos
  useEffect(() => {
    if (!newsData || newsData.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % newsData.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [newsData]);

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const published = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Hace menos de 1h';
    if (diffInHours < 24) return `Hace ${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `Hace ${diffInDays}d`;
  };

  if (isLoading) {
    return (
      <div className="w-full bg-gradient-to-r from-blue-50 to-orange-50 rounded-lg border border-blue-200 p-2 sm:p-4 mx-2 sm:mx-0 mb-3">
        <div className="flex items-center gap-1 sm:gap-2 text-blue-700">
          <Newspaper className="w-3 h-3 sm:w-5 sm:h-5 animate-pulse" />
          <span className="text-xs sm:text-sm font-semibold">Cargando noticias...</span>
        </div>
      </div>
    );
  }

  if (isError || !newsData || newsData.length === 0) {
    return (
      <div className="w-full bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200 p-2 sm:p-4 mx-2 sm:mx-0 mb-3">
        <div className="flex items-center gap-1 sm:gap-2 text-yellow-700">
          <Newspaper className="w-3 h-3 sm:w-5 sm:h-5" />
          <span className="text-xs sm:text-sm font-semibold">No hay noticias disponibles</span>
        </div>
      </div>
    );
  }

  const currentNews = newsData[currentIndex];

  return (
    <div className="news-panel w-full mb-2 sm:mb-3 px-1 sm:px-2 md:px-4">
      <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-md sm:rounded-lg border sm:border-2 border-blue-300 shadow-sm sm:shadow-md">
        {/* Header - Compacto en móvil */}
        <div className="flex items-center justify-between px-2 py-1 sm:px-4 sm:py-2 bg-gradient-to-r from-blue-600 to-blue-500">
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full animate-pulse"></div>
            <Newspaper className="w-3 h-3 sm:w-5 sm:h-5 text-white" />
            <span className="text-[10px] sm:text-sm md:text-base font-bold text-white truncate">
              NOTICIAS DEL SECTOR
            </span>
          </div>
          <Badge variant="secondary" className="text-[8px] sm:text-xs bg-white text-blue-700 font-semibold px-1 py-0 sm:px-2 sm:py-1">
            {newsData.length}
          </Badge>
        </div>

        {/* News Content - Optimizado para móvil */}
        <div className="p-2 sm:p-3 md:p-4 bg-white">
          <div className="flex flex-col gap-2 sm:gap-3 md:gap-4">
            {/* Main News */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-1 sm:mb-2 gap-1">
                <Badge className={`text-[8px] sm:text-xs px-1 py-0 ${categoryColors[currentNews.category] || categoryColors.general}`}>
                  {categoryLabels[currentNews.category] || currentNews.category}
                </Badge>
                <span className="text-[8px] sm:text-xs text-gray-500 flex-shrink-0">
                  {formatTimeAgo(currentNews.publishedAt)}
                </span>
              </div>

              <h3 className="font-bold text-xs sm:text-sm md:text-base lg:text-lg text-gray-900 mb-1 sm:mb-2 line-clamp-2 leading-tight">
                {currentNews.title}
              </h3>

              <p className="text-[10px] sm:text-xs md:text-sm text-gray-600 mb-2 sm:mb-3 line-clamp-2 sm:line-clamp-3 leading-snug">
                {currentNews.summary}
              </p>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[8px] sm:text-xs text-blue-600 font-medium truncate">
                  📰 {currentNews.sourceName}
                </span>
                
                {currentNews.sourceUrl && (
                  <a
                    href={currentNews.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 sm:gap-1 text-[8px] sm:text-xs text-blue-600 hover:text-blue-700 hover:underline flex-shrink-0"
                  >
                    Ver <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Indicators - Compacto y minimalista */}
            <div className="flex items-center justify-between border-t pt-1.5 sm:pt-2">
              <span className="text-[10px] sm:text-xs text-gray-500 font-medium">
                {currentIndex + 1}/{newsData.length}
              </span>
              
              <div className="flex gap-1 sm:gap-1.5">
                {newsData.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full transition-colors ${
                      index === currentIndex 
                        ? 'bg-blue-600' 
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                    style={{ 
                      minWidth: '0.25rem',
                      minHeight: '0.25rem',
                      padding: '0.25rem'
                    }}
                    aria-label={`Ver noticia ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Oculto en móvil pequeño */}
        <div className="hidden sm:block px-2 sm:px-4 py-1 sm:py-2 bg-gray-50 border-t">
          <div className="text-[8px] sm:text-xs text-gray-500 text-center">
            Actualizado cada 6 horas • Click en los puntos para navegar
          </div>
        </div>
      </div>
    </div>
  );
}
