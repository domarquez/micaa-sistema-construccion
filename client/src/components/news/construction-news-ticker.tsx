import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ExternalLink } from 'lucide-react';

interface NewsItem {
  id: number;
  title: string;
  summary: string;
  sourceUrl?: string;
  sourceName: string;
  publishedAt: string;
  category: 'economia' | 'gobierno' | 'obras' | 'tecnologia' | 'normativa' | 'construccion';
}

// Noticias de fallback (coinciden con BD externa)
const sampleNews: NewsItem[] = [
  {
    id: 27,
    title: "LA SEGURIDAD EN LA CONSTRUCCIÓN EN BOLIVIA, UN ALTO COSTO QUE PUEDE COSTAR VIDAS",
    summary: "LA SEGURIDAD EN LA CONSTRUCCIÓN EN BOLIVIA, UN ALTO COSTO QUE PUEDE COSTAR VIDAS",
    sourceUrl: "https://contactoconstruccion.com/category/construccion/",
    sourceName: "Contacto Construcción",
    publishedAt: "2025-10-18T04:54:40.512Z",
    category: "construccion"
  },
  {
    id: 28,
    title: "Samsung promueve la innovación en proyectos inmobiliarios: hogares interconectados con el ecosistema SmartThings",
    summary: "Samsung promueve la innovación en proyectos inmobiliarios: hogares interconectados con el ecosistema SmartThings",
    sourceUrl: "https://contactoconstruccion.com/category/empresas/",
    sourceName: "Contacto Construcción",
    publishedAt: "2025-10-18T04:54:40.511Z",
    category: "construccion"
  },
  {
    id: 29,
    title: "Síntesis reafirma su liderazgo con la recertificación ISO 9001 e ISO 27001:2022",
    summary: "Síntesis reafirma su liderazgo con la recertificación ISO 9001 e ISO 27001:2022, consolidándose como referente tecnológico y de seguridad en Bolivia",
    sourceUrl: "https://contactoconstruccion.com/category/ecomomia/",
    sourceName: "Contacto Construcción",
    publishedAt: "2025-10-18T04:54:40.510Z",
    category: "construccion"
  },
  {
    id: 30,
    title: "Santa Cruz",
    summary: "Santa Cruz",
    sourceUrl: "https://www.eldia.com.bo/santa-cruz",
    sourceName: "El Día",
    publishedAt: "2025-10-18T04:54:39.520Z",
    category: "construccion"
  }
];

const categoryColors = {
  economia: 'bg-blue-100 text-blue-700 border-blue-300',
  gobierno: 'bg-green-100 text-green-700 border-green-300', 
  obras: 'bg-orange-100 text-orange-700 border-orange-300',
  tecnologia: 'bg-purple-100 text-purple-700 border-purple-300',
  normativa: 'bg-red-100 text-red-700 border-red-300',
  construccion: 'bg-yellow-100 text-yellow-700 border-yellow-300'
};

const categoryLabels = {
  economia: 'Economía',
  gobierno: 'Gobierno',
  obras: 'Obras Públicas', 
  tecnologia: 'Tecnología',
  normativa: 'Normativa',
  construccion: 'Construcción'
};

export function ConstructionNewsTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Obtener noticias del API
  const { data: fetchedNews } = useQuery<NewsItem[]>({
    queryKey: ["/api/public/construction-news"],
    staleTime: 5 * 60 * 1000,
    retry: 2
  });

  // Usar noticias del API o fallback
  const newsData = fetchedNews && fetchedNews.length > 0 ? fetchedNews : sampleNews;

  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % newsData.length);
    }, 5000); // Cambiar cada 5 segundos

    return () => clearInterval(interval);
  }, [isPaused, newsData.length]);

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const published = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Hace menos de 1 hora';
    if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
  };

  if (!newsData.length) return null;

  const currentNews = newsData[currentIndex];

  return (
    <Card className="bg-gradient-to-r from-gray-50 to-blue-50 border-blue-200 overflow-hidden max-w-[180px] sm:max-w-[200px] md:max-w-[220px] lg:max-w-[240px] xl:max-w-[260px] 2xl:max-w-xs mx-auto">
      <div 
        className="aspect-square flex flex-col p-0.5 sm:p-1 md:p-1.5 lg:p-2 xl:p-3"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Header - Compact */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-semibold text-gray-700">
              Noticias del Sector
            </span>
          </div>
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
          </div>
        </div>

        {/* News Content - Square layout */}
        <div className="flex-1 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-center mb-2">
              <Badge 
                variant="outline" 
                className={`text-xs ${categoryColors[currentNews.category]}`}
              >
                {categoryLabels[currentNews.category]}
              </Badge>
            </div>
            
            <h4 className="font-medium text-gray-900 text-xs sm:text-sm leading-tight text-center line-clamp-3">
              {currentNews.title}
            </h4>
            
            <p className="text-xs text-gray-600 line-clamp-2 sm:line-clamp-3 text-center">
              {currentNews.summary}
            </p>
          </div>

          <div className="mt-3 space-y-2">
            <div className="text-center">
              <span className="text-xs text-gray-500">{currentNews.sourceName}</span>
            </div>

            {currentNews.sourceUrl && (
              <div className="flex justify-center">
                <button
                  onClick={() => window.open(currentNews.sourceUrl, '_blank')}
                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-full transition-colors"
                  title="Leer noticia completa"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Progress indicators */}
            <div className="flex justify-center space-x-0.5 sm:space-x-1">
              {newsData.map((_, index) => (
                <div
                  key={index}
                  className={`h-0.5 sm:h-1 transition-all duration-300 ${
                    index === currentIndex 
                      ? 'bg-blue-600 w-4 sm:w-6' 
                      : 'bg-gray-300 w-1.5 sm:w-2'
                  } rounded-full`}
                />
              ))}
            </div>
            
            <div className="text-xs text-gray-500 text-center">
              {currentIndex + 1} de {newsData.length}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}