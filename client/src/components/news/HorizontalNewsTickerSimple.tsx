import { useState, useEffect, useRef } from 'react';
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

export function HorizontalNewsTickerSimple() {
  const [isPaused, setIsPaused] = useState(false);
  const tickerRef = useRef<HTMLDivElement>(null);

  // Try to fetch from API, fallback to local data
  const { data: fetchedNews, isLoading, error } = useQuery<NewsItem[]>({
    queryKey: ["/api/public/construction-news"],
    staleTime: 5 * 60 * 1000,
  });

  // Use fetched news if available, otherwise fallback
  const news = fetchedNews && fetchedNews.length > 0 ? fetchedNews : fallbackNews;

  const formatTimeAgo = (dateString: string | Date) => {
    const now = new Date();
    const published = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Hace menos de 1 hora';
    if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
  };

  // Auto-scroll effect
  useEffect(() => {
    if (!tickerRef.current || isPaused || news.length === 0) return;

    const ticker = tickerRef.current;
    let scrollAmount = 0;
    const scrollSpeed = 1; // pixels per frame
    const maxScroll = ticker.scrollWidth - ticker.clientWidth;

    const scroll = () => {
      if (!isPaused) {
        scrollAmount += scrollSpeed;
        if (scrollAmount >= maxScroll) {
          scrollAmount = 0;
        }
        ticker.scrollLeft = scrollAmount;
      }
      requestAnimationFrame(scroll);
    };

    const animationId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationId);
  }, [isPaused, news.length]);

  const handleNewsClick = (newsItem: NewsItem) => {
    if (newsItem.sourceUrl) {
      window.open(newsItem.sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (news.length === 0) {
    return null;
  }

  return (
    <div className="mobile-padding mb-2 sm:mb-3 md:mb-4">
      <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-lg border border-blue-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-100 border-b border-blue-200">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <Newspaper className="w-3 h-3 sm:w-4 sm:h-4 text-blue-700" />
            <span className="text-xs sm:text-sm font-semibold text-blue-800">
              Noticias del Sector
            </span>
          </div>
          <Badge variant="outline" className="text-[8px] sm:text-[9px] bg-white">
            {news.length} noticias
          </Badge>
        </div>

        {/* Scrolling News Container */}
        <div 
          ref={tickerRef}
          className="flex gap-4 p-2 sm:p-3 overflow-x-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          style={{ 
            scrollBehavior: 'smooth',
            whiteSpace: 'nowrap'
          }}
        >
          {/* Duplicate news for seamless loop */}
          {[...news, ...news].map((newsItem, index) => {
            const category = newsItem.category as keyof typeof categoryColors;
            return (
              <div
                key={`${newsItem.id}-${index}`}
                className="flex-shrink-0 cursor-pointer hover:shadow-md transition-all duration-200 bg-white rounded-lg border border-gray-200 p-2 sm:p-3 min-w-[280px] sm:min-w-[320px] max-w-[320px] sm:max-w-[360px]"
                onClick={() => handleNewsClick(newsItem)}
              >
                <div className="flex flex-col gap-2">
                  {/* Category and Time */}
                  <div className="flex items-center justify-between">
                    <Badge 
                      variant="outline" 
                      className={`text-[8px] sm:text-[9px] px-1 py-0 ${categoryColors[category] || categoryColors.general}`}
                    >
                      {categoryLabels[category] || categoryLabels.general}
                    </Badge>
                    <span className="text-[8px] sm:text-[9px] text-gray-500">
                      {newsItem.publishedAt ? formatTimeAgo(newsItem.publishedAt) : ''}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="font-semibold text-xs sm:text-sm text-gray-900 line-clamp-2 leading-tight text-left">
                    {newsItem.title}
                  </h4>

                  {/* Summary */}
                  <p className="text-[9px] sm:text-xs text-gray-600 line-clamp-2 text-left">
                    {newsItem.summary}
                  </p>

                  {/* Source and Link */}
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] sm:text-[9px] text-blue-600 font-medium">
                      {newsItem.sourceName}
                    </span>
                    {newsItem.sourceUrl && (
                      <ExternalLink className="w-3 h-3 text-blue-600 hover:text-blue-700" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pause indicator */}
        {isPaused && (
          <div className="absolute top-1 right-1 text-[8px] text-blue-600 bg-white px-1 rounded">
            Pausado
          </div>
        )}
      </div>
    </div>
  );
}