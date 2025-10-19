import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ExternalLink, Eye, MapPin, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AdvertisementWithSupplier {
  id: number;
  title: string;
  description: string;
  imageUrl?: string;
  linkUrl?: string;
  isActive: boolean;
  supplier: {
    id: number;
    companyName: string;
    city?: string;
    phone?: string;
  };
}

export function CompanyAdvertisementCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Fetch real advertisements from the admin system
  const { data: advertisements = [] } = useQuery<AdvertisementWithSupplier[]>({
    queryKey: ["/api/public/dual-advertisements"],
    staleTime: 10 * 60 * 1000,
  });

  // Auto-advance carousel
  useEffect(() => {
    if (!isAutoPlaying || advertisements.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % advertisements.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, advertisements.length]);

  const nextAd = () => {
    setCurrentIndex((prev) => (prev + 1) % advertisements.length);
  };

  const prevAd = () => {
    setCurrentIndex((prev) => (prev - 1 + advertisements.length) % advertisements.length);
  };

  const handleAdClick = async (ad: AdvertisementWithSupplier) => {
    try {
      // Track click
      await fetch(`/api/public/advertisements/${ad.id}/click`, { method: 'POST' });
      
      // Open link if available
      if (ad.linkUrl) {
        window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Error tracking ad click:', error);
    }
  };

  // Don't render if no advertisements
  if (advertisements.length === 0) {
    return null;
  }

  const currentAd = advertisements[currentIndex];

  return (
    <div className="news-panel mobile-padding mb-4 sm:mb-6">
      <div className="text-xs sm:text-sm text-gray-500 mb-2 text-left">
        Empresas Proveedoras - Publicidades
      </div>
      
      <Card className="shadow-lg bg-gradient-to-br from-blue-50 to-orange-50 border border-blue-200">
        <CardContent className="p-0 relative">
          {/* Navigation Buttons */}
          {advertisements.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-1/2 left-1 sm:left-2 transform -translate-y-1/2 z-10 bg-white/80 hover:bg-white/90 w-6 h-6 sm:w-8 sm:h-8 p-0 rounded-full shadow-md"
                onClick={prevAd}
                onMouseEnter={() => setIsAutoPlaying(false)}
                onMouseLeave={() => setIsAutoPlaying(true)}
              >
                <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-1/2 right-1 sm:right-2 transform -translate-y-1/2 z-10 bg-white/80 hover:bg-white/90 w-6 h-6 sm:w-8 sm:h-8 p-0 rounded-full shadow-md"
                onClick={nextAd}
                onMouseEnter={() => setIsAutoPlaying(false)}
                onMouseLeave={() => setIsAutoPlaying(true)}
              >
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </>
          )}

          {/* Advertisement Content */}
          <div 
            className="cursor-pointer"
            onClick={() => handleAdClick(currentAd)}
          >
            <div className="p-3 sm:p-4 md:p-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                {/* Image placeholder or actual image */}
                <div className="flex-shrink-0">
                  <div className="w-full sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 bg-gradient-to-br from-blue-100 to-orange-100 rounded-lg flex items-center justify-center border border-blue-200">
                    {currentAd.imageUrl ? (
                      <img 
                        src={currentAd.imageUrl} 
                        alt={currentAd.title}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="text-center">
                        <Eye className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 mx-auto mb-1" />
                        <span className="text-[8px] sm:text-[10px] text-blue-600 font-medium">
                          {currentAd.supplier.companyName.split(' ')[0]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Advertisement Details */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm sm:text-base md:text-lg font-bold text-blue-900 leading-tight line-clamp-2">
                      {currentAd.title}
                    </h3>
                    <Badge variant="secondary" className="text-[8px] sm:text-[9px] px-1 py-0 flex-shrink-0">
                      Patrocinado
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs sm:text-sm md:text-base font-semibold text-orange-700">
                      {currentAd.supplier.companyName}
                    </p>
                  </div>

                  {currentAd.description && (
                    <p className="text-xs sm:text-sm text-gray-700 line-clamp-2 mb-2">
                      {currentAd.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs text-gray-600">
                    {currentAd.supplier.city && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{currentAd.supplier.city}</span>
                      </div>
                    )}
                    {currentAd.supplier.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{currentAd.supplier.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-blue-600">
                      <ExternalLink className="w-3 h-3" />
                      <span>Ver más</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Indicators */}
          {advertisements.length > 1 && (
            <div className="flex justify-center gap-1 pb-2">
              {advertisements.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex 
                      ? 'bg-blue-600' 
                      : 'bg-gray-300'
                  }`}
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}