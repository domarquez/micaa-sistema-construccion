import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ExternalLink } from 'lucide-react';

interface NewsItem {
  id: number;
  title: string;
  summary: string;
  link: string;
  source: string;
  publishedAt: string;
  category: 'economia' | 'gobierno' | 'obras' | 'tecnologia' | 'normativa';
}

// Noticias de ejemplo del sector construcción en Bolivia
const sampleNews: NewsItem[] = [
  {
    id: 1,
    title: "Gobierno anuncia nueva ley de vivienda social con créditos preferenciales",
    summary: "El programa beneficiará a familias de ingresos medios con tasas del 3% anual",
    link: "#",
    source: "Página Siete",
    publishedAt: "2025-01-17T10:30:00Z",
    category: "gobierno"
  },
  {
    id: 2, 
    title: "Precio del cemento se estabiliza tras acuerdo con productores nacionales",
    summary: "Las empresas cementeras garantizan stock suficiente para obras públicas y privadas",
    link: "#",
    source: "El Deber",
    publishedAt: "2025-01-17T08:15:00Z", 
    category: "economia"
  },
  {
    id: 3,
    title: "Inicia construcción del nuevo aeropuerto de Cochabamba con inversión de $500M",
    summary: "La obra generará 3.000 empleos directos durante sus 4 años de construcción",
    link: "#",
    source: "Los Tiempos",
    publishedAt: "2025-01-16T16:45:00Z",
    category: "obras"
  },
  {
    id: 4,
    title: "BIM y tecnología 4.0: Constructoras bolivianas adoptan nuevos sistemas",
    summary: "Empresas locales implementan modelado 3D para reducir costos en un 15%",
    link: "#",
    source: "Constructivo",
    publishedAt: "2025-01-16T14:20:00Z",
    category: "tecnologia"
  },
  {
    id: 5,
    title: "Nuevas normas de construcción sismo-resistente entran en vigor",
    summary: "Arquitectos e ingenieros deben aplicar estándares actualizados en todas las obras",
    link: "#",
    source: "ANF",
    publishedAt: "2025-01-15T11:00:00Z",
    category: "normativa"
  }
];

const categoryColors = {
  economia: 'bg-blue-100 text-blue-700 border-blue-300',
  gobierno: 'bg-green-100 text-green-700 border-green-300', 
  obras: 'bg-orange-100 text-orange-700 border-orange-300',
  tecnologia: 'bg-purple-100 text-purple-700 border-purple-300',
  normativa: 'bg-red-100 text-red-700 border-red-300'
};

const categoryLabels = {
  economia: 'Economía',
  gobierno: 'Gobierno',
  obras: 'Obras Públicas', 
  tecnologia: 'Tecnología',
  normativa: 'Normativa'
};

export function ConstructionNewsTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sampleNews.length);
    }, 5000); // Cambiar cada 5 segundos

    return () => clearInterval(interval);
  }, [isPaused]);

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const published = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Hace menos de 1 hora';
    if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
  };

  if (!sampleNews.length) return null;

  const currentNews = sampleNews[currentIndex];

  return (
    <Card className="bg-gradient-to-r from-gray-50 to-blue-50 border-blue-200 overflow-hidden">
      <div 
        className="p-4"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-gray-700">
              Noticias de Construcción
            </span>
          </div>
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>{formatTimeAgo(currentNews.publishedAt)}</span>
          </div>
        </div>

        {/* News Content */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${categoryColors[currentNews.category]}`}
                >
                  {categoryLabels[currentNews.category]}
                </Badge>
                <span className="text-xs text-gray-500">
                  {currentNews.source}
                </span>
              </div>
              
              <h4 className="font-medium text-gray-900 text-sm leading-tight mb-1 line-clamp-2">
                {currentNews.title}
              </h4>
              
              <p className="text-xs text-gray-600 line-clamp-2">
                {currentNews.summary}
              </p>
            </div>

            <button
              onClick={() => window.open(currentNews.link, '_blank')}
              className="flex-shrink-0 p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
              title="Leer noticia completa"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* Progress indicators */}
          <div className="flex justify-between items-center">
            <div className="flex space-x-1">
              {sampleNews.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 transition-all duration-300 ${
                    index === currentIndex 
                      ? 'bg-blue-600 w-6' 
                      : 'bg-gray-300 w-2'
                  } rounded-full`}
                />
              ))}
            </div>
            
            <div className="text-xs text-gray-500">
              {currentIndex + 1}/{sampleNews.length}
            </div>
          </div>
        </div>

        {/* Moving text animation for mobile */}
        <div className="mt-3 md:hidden overflow-hidden">
          <div 
            className="whitespace-nowrap text-xs text-blue-600 font-medium animate-marquee"
            style={{
              animation: isPaused ? 'none' : 'marquee 15s linear infinite'
            }}
          >
            🏗️ {currentNews.title} • {currentNews.summary}
          </div>
        </div>
      </div>
    </Card>
  );
}