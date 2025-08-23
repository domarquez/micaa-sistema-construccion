import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Newspaper } from 'lucide-react';

interface NewsItem {
  id: number;
  title: string;
  summary: string;
  sourceName: string;
  category: string;
  publishedAt: string;
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

// Static news data to prevent API loops
const staticNews: NewsItem[] = [
  {
    id: 1,
    title: "Sector construcción en emergencia por crisis de insumos",
    summary: "CABOCO alerta sobre falta de materiales críticos y escasez de dólares",
    sourceName: "Contacto Construcción",
    category: "economia",
    publishedAt: "2025-08-18T11:09:18.070Z"
  },
  {
    id: 2,
    title: "Precio del fierro se duplica en 6 meses por crisis de divisas",
    summary: "Material pasó de 60 a 120 bolivianos, afectando costos de construcción",
    sourceName: "Los Tiempos",
    category: "economia",
    publishedAt: "2025-08-17T11:09:18.070Z"
  },
  {
    id: 3,
    title: "Decreto Supremo 5321 para ajustar precios en obras públicas",
    summary: "Permite modificar precios unitarios de materiales importados",
    sourceName: "MOPSV",
    category: "gobierno",
    publishedAt: "2025-08-16T11:09:18.070Z"
  },
  {
    id: 4,
    title: "30,000 construcciones irregulares reportadas en La Paz",
    summary: "Propietarios se amparan en autorizaciones de municipios aledaños",
    sourceName: "Opinión Bolivia",
    category: "normativa",
    publishedAt: "2025-08-15T11:09:18.070Z"
  },
  {
    id: 5,
    title: "Tecnología BIM reduce costos 15% en empresas bolivianas",
    summary: "Constructoras adoptan modelado 3D y herramientas digitales",
    sourceName: "Constructivo",
    category: "tecnologia",
    publishedAt: "2025-08-13T11:09:18.070Z"
  }
];

export function StaticNewsRotator() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const formatTimeAgo = (dateString: string) => {
    try {
      const now = new Date();
      const published = new Date(dateString);
      const diffInHours = Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Hace menos de 1 hora';
      if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
    } catch {
      return 'Hace poco';
    }
  };

  // Simple auto-rotation
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % staticNews.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const handleNewsClick = (newsItem: NewsItem) => {
    if (newsItem.sourceUrl) {
      window.open(newsItem.sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const NewsCard = ({ newsItem }: { newsItem: NewsItem }) => {
    const categoryKey = newsItem.category as keyof typeof categoryColors;
    const colorClass = categoryColors[categoryKey] || categoryColors.general;
    const labelText = categoryLabels[categoryKey] || 'General';

    return (
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Badge className={`text-[10px] px-1.5 py-0.5 ${colorClass}`}>
            {labelText}
          </Badge>
          <span className="text-[10px] text-gray-500 flex-shrink-0">
            {formatTimeAgo(newsItem.publishedAt)}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
          {newsItem.title}
        </h3>
        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
          {newsItem.summary}
        </p>
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>{newsItem.sourceName}</span>
          {newsItem.sourceUrl && (
            <ExternalLink className="w-3 h-3" />
          )}
        </div>
      </div>
    );
  };

  if (staticNews.length === 0) return null;

  return (
    <div className="w-full mb-2 sm:mb-3 md:mb-4 px-1 sm:px-2 md:px-4 mobile-padding">
      <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-lg border border-blue-200 overflow-hidden relative max-w-full">
        {/* Header */}
        <div className="bg-white border-b border-blue-200 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-2">
            <Newspaper className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <span className="text-xs sm:text-sm font-medium text-gray-900">Noticias del Sector</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {staticNews.length} noticias
          </Badge>
        </div>

        {/* Mobile: Single news */}
        <div className="md:hidden p-3">
          <div
            className="cursor-pointer hover:shadow-md transition-all duration-300 bg-white rounded-lg border border-gray-200 p-3"
            onClick={() => handleNewsClick(staticNews[currentIndex])}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <NewsCard newsItem={staticNews[currentIndex]} />
          </div>
          
          {/* Mobile indicators */}
          <div className="flex justify-center gap-1 mt-3">
            {staticNews.map((_, index) => (
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
                const newsIndex = (currentIndex + offset) % staticNews.length;
                const newsItem = staticNews[newsIndex];
                
                return (
                  <div
                    key={`desktop-${newsItem.id}-${currentIndex}-${offset}`}
                    className="cursor-pointer hover:shadow-md transition-all duration-300 bg-white rounded-lg border border-gray-200 p-3 h-32"
                    onClick={() => handleNewsClick(newsItem)}
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                  >
                    <NewsCard newsItem={newsItem} />
                  </div>
                );
              })}
            </div>
            
            {/* Desktop indicators */}
            <div className="flex justify-center gap-2 mt-4">
              {staticNews.map((_, index) => (
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
      </div>
    </div>
  );
}