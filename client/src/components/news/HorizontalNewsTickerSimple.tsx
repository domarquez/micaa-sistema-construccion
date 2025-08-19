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
  const [currentIndex, setCurrentIndex] = useState(0);
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

  // Auto-rotation effect for mobile (single news rotation)
  useEffect(() => {
    if (isPaused || news.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % news.length);
    }, 4000); // Change news every 4 seconds

    return () => clearInterval(interval);
  }, [isPaused, news.length]);

  // Responsive desktop view with different layouts
  const [visibleNewsCount, setVisibleNewsCount] = useState(1);

  // Update visible news count based on screen size
  useEffect(() => {
    const updateVisibleCount = () => {
      const width = window.innerWidth;
      if (width >= 1200) {
        setVisibleNewsCount(3); // XL screens: 3 news
      } else if (width >= 1024) {
        setVisibleNewsCount(2); // LG screens: 2 news
      } else if (width >= 768) {
        setVisibleNewsCount(1); // MD screens: 1 news with arrows
      } else {
        setVisibleNewsCount(1); // Mobile handled separately
      }
    };

    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, []);

  // Desktop scroll effect for XL screens only
  useEffect(() => {
    if (!tickerRef.current || isPaused || news.length === 0) return;
    
    // Only apply scroll effect on XL screens (3+ news)
    const isXLScreen = window.innerWidth >= 1200;
    if (!isXLScreen) return;

    const ticker = tickerRef.current;
    let scrollAmount = 0;
    const scrollSpeed = 0.3; // Slower scroll for better readability
    const maxScroll = ticker.scrollWidth - ticker.clientWidth;

    const scroll = () => {
      if (!isPaused && maxScroll > 0) {
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
  }, [isPaused, news.length, visibleNewsCount]);

  const handleNewsClick = (newsItem: NewsItem) => {
    if (newsItem.sourceUrl) {
      window.open(newsItem.sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const NewsCard = ({ newsItem }: { newsItem: NewsItem }) => {
    const category = newsItem.category as keyof typeof categoryColors;
    return (
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
    );
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

        {/* News Container - Mobile: Single rotating news, Desktop: Scrolling */}
        <div className="relative">
          {/* Mobile View - Single News Rotation */}
          <div className="md:hidden">
            <div className="p-2 sm:p-3">
              {news.length > 0 && (
                <div
                  className="cursor-pointer hover:shadow-md transition-all duration-500 bg-white rounded-lg border border-gray-200 p-3 w-full"
                  onClick={() => handleNewsClick(news[currentIndex])}
                >
                  <NewsCard newsItem={news[currentIndex]} />
                </div>
              )}
            </div>
            
            {/* Mobile Indicators */}
            <div className="flex justify-center gap-1 pb-2">
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

          {/* Desktop View - Responsive Layout */}
          <div className="hidden md:block">
            {/* XL Screens (1200px+): Horizontal scroll with 3+ news */}
            {visibleNewsCount === 3 && (
              <div 
                ref={tickerRef}
                className="flex gap-4 p-3 overflow-x-hidden"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                style={{ 
                  scrollBehavior: 'smooth',
                  whiteSpace: 'nowrap'
                }}
              >
                {/* Duplicate news for seamless loop */}
                {[...news, ...news].map((newsItem, index) => (
                  <div
                    key={`${newsItem.id}-${index}`}
                    className="flex-shrink-0 cursor-pointer hover:shadow-md transition-all duration-200 bg-white rounded-lg border border-gray-200 p-3 w-80"
                    onClick={() => handleNewsClick(newsItem)}
                  >
                    <NewsCard newsItem={newsItem} />
                  </div>
                ))}
              </div>
            )}

            {/* LG Screens (1024px-1199px): 2 news side by side */}
            {visibleNewsCount === 2 && (
              <div className="grid grid-cols-2 gap-4 p-3">
                {news.slice(currentIndex, currentIndex + 2).concat(
                  currentIndex + 2 > news.length ? news.slice(0, (currentIndex + 2) % news.length) : []
                ).slice(0, 2).map((newsItem, index) => (
                  <div
                    key={`${newsItem.id}-${index}`}
                    className="cursor-pointer hover:shadow-md transition-all duration-200 bg-white rounded-lg border border-gray-200 p-3"
                    onClick={() => handleNewsClick(newsItem)}
                  >
                    <NewsCard newsItem={newsItem} />
                  </div>
                ))}
              </div>
            )}

            {/* MD Screens (768px-1023px): 1 news with navigation */}
            {visibleNewsCount === 1 && (
              <div className="relative p-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentIndex((prev) => (prev - 1 + news.length) % news.length)}
                    className="flex-shrink-0 p-2 rounded-full bg-blue-100 hover:bg-blue-200 transition-colors"
                  >
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div
                    className="flex-1 cursor-pointer hover:shadow-md transition-all duration-500 bg-white rounded-lg border border-gray-200 p-3"
                    onClick={() => handleNewsClick(news[currentIndex])}
                  >
                    <NewsCard newsItem={news[currentIndex]} />
                  </div>
                  
                  <button
                    onClick={() => setCurrentIndex((prev) => (prev + 1) % news.length)}
                    className="flex-shrink-0 p-2 rounded-full bg-blue-100 hover:bg-blue-200 transition-colors"
                  >
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                
                {/* Desktop Indicators for MD screens */}
                <div className="flex justify-center gap-2 mt-3">
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
            )}
          </div>
        </div>

        {/* Pause indicator for XL desktop only */}
        {isPaused && visibleNewsCount === 3 && (
          <div className="absolute top-1 right-1 text-[8px] text-blue-600 bg-white px-1 rounded z-10">
            Pausado
          </div>
        )}
      </div>
    </div>
  );
}