import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Advertisement {
  id: number;
  title: string;
  company: string;
  description: string;
  imageUrl: string;
  link: string;
  category: string;
}

// Datos de ejemplo de publicidades de empresas proveedoras
const sampleAds: Advertisement[] = [
  {
    id: 1,
    title: "Cemento Premium Portland",
    company: "Cementos Bolivianos S.A.",
    description: "Cemento de alta calidad para construcciones resistentes. Entrega inmediata en Santa Cruz.",
    imageUrl: "/api/placeholder/300/200",
    link: "#",
    category: "Materiales"
  },
  {
    id: 2, 
    title: "Hierro Construcción 12mm-25mm",
    company: "Siderúrgica del Oriente",
    description: "Varillas de hierro certificadas. Los mejores precios del mercado con stock permanente.",
    imageUrl: "/api/placeholder/300/200", 
    link: "#",
    category: "Estructural"
  },
  {
    id: 3,
    title: "Ladrillos Cerámicos 6H y 18H",
    company: "Ladrillera San Miguel",
    description: "Ladrillos de primera calidad. Producción local con entrega en obra.",
    imageUrl: "/api/placeholder/300/200",
    link: "#", 
    category: "Mampostería"
  },
  {
    id: 4,
    title: "Arena, Grava y Piedra",
    company: "Áridos del Valle",
    description: "Agregados de construcción lavados y seleccionados. Transporte incluido.",
    imageUrl: "/api/placeholder/300/200",
    link: "#",
    category: "Agregados" 
  },
  {
    id: 5,
    title: "Equipos de Construcción",
    company: "Maquinarias Oriente",
    description: "Alquiler de equipos: mezcladoras, vibradores, andamios y más.",
    imageUrl: "/api/placeholder/300/200", 
    link: "#",
    category: "Equipos"
  }
];

export function AdCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance carousel
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sampleAds.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const nextAd = () => {
    setCurrentIndex((prev) => (prev + 1) % sampleAds.length);
  };

  const prevAd = () => {
    setCurrentIndex((prev) => (prev - 1 + sampleAds.length) % sampleAds.length);
  };

  const goToAd = (index: number) => {
    setCurrentIndex(index);
  };

  if (!sampleAds.length) return null;

  const currentAd = sampleAds[currentIndex];

  return (
    <Card className="relative overflow-hidden bg-gradient-to-r from-orange-50 to-red-50 border-orange-200 max-w-full">
      <CardContent className="p-0">
        <div 
          className="relative"
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
        >
          {/* Square Card Design */}
          <div className="max-w-[200px] sm:max-w-[220px] md:max-w-[240px] lg:max-w-[260px] xl:max-w-[280px] 2xl:max-w-xs mx-auto">
            {/* Image - Square aspect ratio */}
            <div className="w-full aspect-square bg-gray-100 relative overflow-hidden rounded-t-lg">
              <img
                src={currentAd.imageUrl}
                alt={currentAd.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMjUgMTI1SDE3NVYxNzVIMTI1VjEyNVoiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+CjxjaXJjbGUgY3g9IjE0MCIgY3k9IjE0MCIgcj0iNSIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
                }}
              />
              <div className="absolute top-2 left-2">
                <span className="bg-orange-600 text-white px-2 py-1 rounded text-xs font-bold">
                  PUBLICIDAD
                </span>
              </div>
              <div className="absolute top-2 right-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:text-orange-200 p-1 bg-black/20 hover:bg-black/40"
                  onClick={() => window.open(currentAd.link, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content - Compact below image */}
            <div className="p-1 sm:p-1.5 md:p-2 lg:p-3 bg-white rounded-b-lg">
              <div className="text-center">
                <h3 className="font-semibold text-gray-900 text-xs sm:text-sm line-clamp-2 break-words leading-tight mb-0.5 sm:mb-1">
                  {currentAd.title}
                </h3>
                <p className="text-orange-600 font-medium text-xs break-words leading-tight mb-1 sm:mb-2">
                  {currentAd.company}
                </p>
                <p className="text-gray-600 text-xs line-clamp-2 mb-2 sm:mb-3">
                  {currentAd.description}
                </p>

                {/* Navigation dots */}
                <div className="flex justify-center items-center space-x-0.5 sm:space-x-1 mb-1 sm:mb-2">
                  {sampleAds.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToAd(index)}
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all ${
                        index === currentIndex 
                          ? 'bg-orange-600 w-4 sm:w-6' 
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
                
                <div className="text-xs text-gray-500">
                  {currentIndex + 1} de {sampleAds.length}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          <Button
            variant="ghost"
            size="icon"
            onClick={prevAd}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white shadow-sm h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={nextAd}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white shadow-sm h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}