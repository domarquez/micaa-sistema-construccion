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
    <Card className="relative overflow-hidden bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
      <CardContent className="p-0">
        <div 
          className="relative"
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
        >
          {/* Main Ad Content */}
          <div className="flex flex-col md:flex-row">
            {/* Image */}
            <div className="w-full md:w-1/3 bg-gray-100 relative overflow-hidden">
              <img
                src={currentAd.imageUrl}
                alt={currentAd.title}
                className="w-full h-40 md:h-32 object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMjUgNzVIMTc1VjEyNUgxMjVWNzVaIiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPgo8Y2lyY2xlIGN4PSIxNDAiIGN5PSI5MCIgcj0iNSIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
                }}
              />
              <div className="absolute top-2 left-2">
                <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded">
                  {currentAd.category}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm md:text-base line-clamp-1">
                    {currentAd.title}
                  </h3>
                  <p className="text-orange-600 font-medium text-xs md:text-sm">
                    {currentAd.company}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-orange-600 hover:text-orange-700 p-1"
                  onClick={() => window.open(currentAd.link, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
              
              <p className="text-gray-600 text-xs md:text-sm line-clamp-2 mb-3">
                {currentAd.description}
              </p>

              {/* Navigation dots */}
              <div className="flex justify-between items-center">
                <div className="flex space-x-1">
                  {sampleAds.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToAd(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentIndex 
                          ? 'bg-orange-600 w-4' 
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