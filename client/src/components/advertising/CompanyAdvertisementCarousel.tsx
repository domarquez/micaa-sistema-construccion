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
    <div className="news-panel mobile-padding mb-4 sm:mb-6 max-w-full overflow-hidden">
      <Card className="shadow-lg bg-gradient-to-br from-blue-50 to-orange-50 border border-blue-200 max-w-full overflow-hidden">
        <CardContent className="p-0 relative">
          {/* Advertisement Content */}
          <div 
            className="cursor-pointer"
            onClick={() => handleAdClick(currentAd)}
          >
            {/* Image Section - Full width at top */}
            <div className="relative w-full h-32 sm:h-40 md:h-48 bg-gradient-to-br from-blue-100 to-orange-100">
              {/* Navigation Buttons */}
              {advertisements.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-1/2 left-1 sm:left-2 transform -translate-y-1/2 z-10 bg-white/80 hover:bg-white/90 w-6 h-6 sm:w-8 sm:h-8 p-0 rounded-full shadow-md"
                    onClick={(e) => { e.stopPropagation(); prevAd(); }}
                    onMouseEnter={() => setIsAutoPlaying(false)}
                    onMouseLeave={() => setIsAutoPlaying(true)}
                  >
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-1/2 right-1 sm:right-2 transform -translate-y-1/2 z-10 bg-white/80 hover:bg-white/90 w-6 h-6 sm:w-8 sm:h-8 p-0 rounded-full shadow-md"
                    onClick={(e) => { e.stopPropagation(); nextAd(); }}
                    onMouseEnter={() => setIsAutoPlaying(false)}
                    onMouseLeave={() => setIsAutoPlaying(true)}
                  >
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </>
              )}

              {currentAd.imageUrl ? (
                <img 
                  src={currentAd.imageUrl} 
                  alt={currentAd.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Eye className="w-8 h-8 sm:w-12 sm:h-12 text-blue-600 mx-auto mb-2" />
                    <span className="text-sm sm:text-base text-blue-600 font-medium">
                      {currentAd.supplier.companyName}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Text Section - Below image */}
            <div className="p-3 sm:p-4 text-left">
              {/* Header with title and labels */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] sm:text-xs text-gray-500">
                  Empresas Proveedoras - Publicidad
                </span>
                <Badge variant="secondary" className="text-[8px] sm:text-[9px] px-1.5 py-0.5 bg-yellow-100 text-yellow-800 border-yellow-300">
                  Patrocinado
                </Badge>
              </div>

              <h3 className="text-sm sm:text-base md:text-lg font-bold text-blue-900 leading-tight line-clamp-2 mb-1">
                {currentAd.title}
              </h3>
              
              <p className="text-xs sm:text-sm md:text-base font-semibold text-orange-700 mb-1">
                {currentAd.supplier.companyName}
              </p>

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