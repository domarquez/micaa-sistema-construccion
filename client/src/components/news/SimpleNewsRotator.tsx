import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Newspaper } from 'lucide-react';

interface NewsItem {
  id: number;
  title: string;
  summary: string;
  sourceName: string;
  category: string;
  publishedAt?: string;
  sourceUrl?: string;
}

const categoryColors = {
  economia: 'bg-blue-100 text-blue-700 border-blue-300',
  gobierno: 'bg-green-100 text-green-700 border-green-300', 
  obras: 'bg-orange-100 text-orange-700 border-orange-300',
  tecnologia: 'bg-purple-100 text-purple-700 border-purple-300',
  normativa: 'bg-red-100 text-red-700 border-red-300',
  general: 'bg-gray-100 text-gray-700 border-gray-300'
};

const categoryLabels = {
  economia: 'Economía',
  gobierno: 'Gobierno',
  obras: 'Obras Públicas', 
  tecnologia: 'Tecnología',
  normativa: 'Normativa',
  general: 'General'
};

// Fallback news data
const fallbackNews: NewsItem[] = [
  {
    id: 1,
    title: "Sector construcción en emergencia por crisis de insumos",
    summary: "CABOCO alerta sobre falta de materiales críticos y escasez de dólares",
    sourceName: "Contacto Construcción",
    category: "economia",
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 2,
    title: "Precio del fierro se duplica en 6 meses por crisis de divisas",
    summary: "Material pasó de 60 a 120 bolivianos, afectando costos de construcción",
    sourceName: "Los Tiempos",
    category: "economia",
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 3,
    title: "Decreto Supremo 5321 para ajustar precios en obras públicas",
    summary: "Permite modificar precios unitarios de materiales importados",
    sourceName: "MOPSV",
    category: "gobierno",
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 4,
    title: "30,000 construcciones irregulares reportadas en La Paz",
    summary: "Propietarios se amparan en autorizaciones de municipios aledaños",
    sourceName: "Opinión Bolivia",
    category: "normativa",
    publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 5,
    title: "Tecnología BIM reduce costos 15% en empresas bolivianas",
    summary: "Constructoras adoptan modelado 3D y herramientas digitales",
    sourceName: "Constructivo",
    category: "tecnologia",
    publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export function SimpleNewsRotator() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Fetch from API with fallback and error handling
  const { data: fetchedNews, error, isError } = useQuery<NewsItem[]>({
    queryKey: ["/api/public/construction-news"],
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: 1000,
    onError: (err) => {
      console.error('News fetch error:', err);
      setHasError(true);
    }
  });

  const news = fetchedNews && fetchedNews.length > 0 ? fetchedNews : fallbackNews;

  const formatTimeAgo = (dateString: string | Date) => {
    try {
      const now = new Date();
      const published = new Date(dateString);
      
      // Check for invalid dates
      if (isNaN(published.getTime()) || isNaN(now.getTime())) {
        return 'Hace poco';
      }
      
      const diffInHours = Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Hace menos de 1 hora';
      if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Hace poco';
    }
  };

  // Auto-rotation with Chrome compatibility
  useEffect(() => {
    if (isPaused || news.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % news.length;
        return next;
      });
    }, 4000);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPaused, news.length]);

  // Reset index if it's out of bounds
  useEffect(() => {
    if (currentIndex >= news.length && news.length > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, news.length]);

  const handleNewsClick = (newsItem: NewsItem) => {
    try {
      if (newsItem.sourceUrl) {
        window.open(newsItem.sourceUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Error opening news link:', error);
    }
  };

  const NewsCard = ({ newsItem }: { newsItem: NewsItem }) => {
    const category = newsItem.category as keyof typeof categoryColors;
    return (
      <div className="flex flex-col gap-2 h-full">
        {/* Category and Time */}
        <div className="flex items-center justify-between gap-1">
          <Badge 
            variant="outline" 
            className={`text-[8px] sm:text-[9px] px-1 py-0 flex-shrink-0 ${categoryColors[category] || categoryColors.general}`}
          >
            {categoryLabels[category] || categoryLabels.general}
          </Badge>
          <span className="text-[8px] sm:text-[9px] text-gray-500 flex-shrink-0">
            {newsItem.publishedAt ? formatTimeAgo(newsItem.publishedAt) : ''}
          </span>
        </div>

        {/* Title */}
        <h4 className="font-semibold text-xs sm:text-sm text-gray-900 line-clamp-2 leading-tight">
          {newsItem.title}
        </h4>

        {/* Summary */}
        <p className="text-[9px] sm:text-xs text-gray-600 line-clamp-2 flex-grow">
          {newsItem.summary}
        </p>

        {/* Source and Link */}
        <div className="flex items-center justify-between gap-1 mt-auto">
          <span className="text-[8px] sm:text-[9px] text-blue-600 font-medium truncate">
            {newsItem.sourceName}
          </span>
          {newsItem.sourceUrl && (
            <ExternalLink className="w-3 h-3 text-blue-600 hover:text-blue-700 flex-shrink-0" />
          )}
        </div>
      </div>
    );
  };

  // Early return with error message if needed
  if (hasError && !fetchedNews) {
    return (
      <div className="w-full mb-2 sm:mb-3 md:mb-4 px-2 sm:px-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-yellow-800 text-sm">
            Error cargando noticias. Usando datos locales...
          </p>
        </div>
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="w-full mb-2 sm:mb-3 md:mb-4 px-2 sm:px-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-gray-600 text-sm">No hay noticias disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mb-2 sm:mb-3 md:mb-4 px-2 sm:px-4">
      <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-lg border border-blue-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-blue-100 border-b border-blue-200">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <Newspaper className="w-4 h-4 text-blue-700" />
            <span className="text-sm font-semibold text-blue-800">
              Noticias del Sector
            </span>
          </div>
          <Badge variant="outline" className="text-[9px] bg-white">
            {news.length} noticias
          </Badge>
        </div>

        {/* Mobile: Single news */}
        <div className="md:hidden p-3">
          {news[currentIndex] && (
            <div
              className="cursor-pointer hover:shadow-md transition-all duration-300 bg-white rounded-lg border border-gray-200 p-3"
              onClick={() => handleNewsClick(news[currentIndex])}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              style={{ willChange: 'transform' }}
            >
              <NewsCard newsItem={news[currentIndex]} />
            </div>
          )}
          
          {/* Mobile indicators */}
          <div className="flex justify-center gap-1 mt-3">
            {news.map((_, index) => (
              <button
                key={index}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                }`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        </div>

        {/* Desktop: Two news side by side */}
        <div className="hidden md:block">
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {[0, 1].map((offset) => {
                const newsIndex = (currentIndex + offset) % news.length;
                const newsItem = news[newsIndex];
                
                if (!newsItem) return null;
                
                return (
                  <div
                    key={`desktop-${newsItem.id}-${currentIndex}-${offset}`}
                    className="cursor-pointer hover:shadow-md transition-all duration-300 bg-white rounded-lg border border-gray-200 p-3 h-32"
                    onClick={() => handleNewsClick(newsItem)}
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                    style={{ willChange: 'transform' }}
                  >
                    <NewsCard newsItem={newsItem} />
                  </div>
                );
              })}
            </div>
            
            {/* Desktop indicators */}
            <div className="flex justify-center gap-2 mt-4">
              {news.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Pause indicator */}
        {isPaused && (
          <div className="absolute top-2 right-2 text-[8px] text-blue-600 bg-white px-2 py-1 rounded shadow-sm z-10">
            Pausado
          </div>
        )}
        
        {/* Debug info for Chrome */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute bottom-2 left-2 text-[8px] text-gray-400 bg-white px-1 py-0.5 rounded text-xs z-10">
            {currentIndex + 1}/{news.length}
          </div>
        )}
      </div>
    </div>
  );
}