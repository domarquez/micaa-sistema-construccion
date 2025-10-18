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
      <div className="w-full bg-gradient-to-r from-blue-50 to-orange-50 rounded-lg border border-blue-200 p-4">
        <div className="flex items-center gap-2 text-blue-700">
          <Newspaper className="w-5 h-5 animate-pulse" />
          <span className="text-sm font-semibold">Cargando noticias...</span>
        </div>
      </div>
    );
  }

  if (isError || !newsData || newsData.length === 0) {
    return (
      <div className="w-full bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200 p-4">
        <div className="flex items-center gap-2 text-yellow-700">
          <Newspaper className="w-5 h-5" />
          <span className="text-sm font-semibold">No hay noticias disponibles</span>
        </div>
      </div>
    );
  }

  const currentNews = newsData[currentIndex];

  return (
    <div className="w-full mb-3 px-2 sm:px-4">
      <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-lg border-2 border-blue-300 overflow-hidden shadow-md">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <Newspaper className="w-5 h-5 text-white" />
            <span className="text-sm font-bold text-white">
              NOTICIAS DEL SECTOR CONSTRUCCIÓN
            </span>
          </div>
          <Badge variant="secondary" className="text-xs bg-white text-blue-700 font-semibold">
            {newsData.length} noticias
          </Badge>
        </div>

        {/* News Content */}
        <div className="p-4 bg-white">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Main News */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <Badge className={`text-xs ${categoryColors[currentNews.category] || categoryColors.general}`}>
                  {categoryLabels[currentNews.category] || currentNews.category}
                </Badge>
                <span className="text-xs text-gray-500">
                  {formatTimeAgo(currentNews.publishedAt)}
                </span>
              </div>

              <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
                {currentNews.title}
              </h3>

              <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                {currentNews.summary}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-600 font-medium">
                  📰 {currentNews.sourceName}
                </span>
                
                {currentNews.sourceUrl && (
                  <a
                    href={currentNews.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Ver más <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Indicators */}
            <div className="md:w-32 flex md:flex-col items-center justify-center gap-2 md:border-l md:pl-4">
              <div className="text-center mb-2">
                <div className="text-2xl font-bold text-blue-600">
                  {currentIndex + 1}
                </div>
                <div className="text-xs text-gray-500">
                  de {newsData.length}
                </div>
              </div>
              
              <div className="flex md:flex-col gap-2">
                {newsData.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentIndex 
                        ? 'bg-blue-600 scale-125' 
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                    aria-label={`Ver noticia ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-50 border-t">
          <div className="text-xs text-gray-500 text-center">
            Actualizado automáticamente cada 6 horas • Click en los puntos para navegar
          </div>
        </div>
      </div>
    </div>
  );
}
