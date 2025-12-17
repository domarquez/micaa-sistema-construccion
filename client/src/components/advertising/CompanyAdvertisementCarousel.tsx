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

  const { data: advertisements = [] } = useQuery<AdvertisementWithSupplier[]>({
    queryKey: ["/api/public/dual-advertisements"],
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!isAutoPlaying || advertisements.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 2) % advertisements.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, advertisements.length]);

  const nextAd = () => {
    setCurrentIndex((prev) => (prev + 2) % advertisements.length);
  };

  const prevAd = () => {
    setCurrentIndex((prev) => (prev - 2 + advertisements.length) % advertisements.length);
  };

  const handleAdClick = async (ad: AdvertisementWithSupplier) => {
    try {
      await fetch(`/api/public/advertisements/${ad.id}/click`, { method: 'POST' });
      if (ad.linkUrl) {
        window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Error tracking ad click:', error);
    }
  };

  if (advertisements.length === 0) {
    return null;
  }

  const currentAd = advertisements[currentIndex];
  const secondAd = advertisements[(currentIndex + 1) % advertisements.length];

  const AdCard = ({ ad }: { ad: AdvertisementWithSupplier }) => (
    <Card 
      className="shadow-lg bg-gradient-to-br from-blue-50 to-orange-50 border border-blue-200 overflow-hidden cursor-pointer hover:shadow-xl transition-shadow flex-1"
      onClick={() => handleAdClick(ad)}
    >
      <CardContent className="p-0">
        <div className="relative w-full h-32 sm:h-36 md:h-40 bg-gradient-to-br from-blue-100 to-orange-100">
          {ad.imageUrl ? (
            <img 
              src={ad.imageUrl} 
              alt={ad.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Eye className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 mx-auto mb-1" />
                <span className="text-xs sm:text-sm text-blue-600 font-medium">
                  {ad.supplier.companyName}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-2 sm:p-3 text-left">
          <h3 className="text-xs sm:text-sm md:text-base font-bold text-blue-900 leading-tight line-clamp-2 mb-1">
            {ad.title}
          </h3>
          
          <p className="text-[10px] sm:text-xs md:text-sm font-semibold text-orange-700 mb-1">
            {ad.supplier.companyName}
          </p>

          {ad.description && (
            <p className="text-[10px] sm:text-xs text-gray-700 line-clamp-2 mb-1">
              {ad.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] text-gray-600">
            {ad.supplier.city && (
              <div className="flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                <span>{ad.supplier.city}</span>
              </div>
            )}
            {ad.supplier.phone && (
              <div className="flex items-center gap-0.5">
                <Phone className="w-2.5 h-2.5" />
                <span>{ad.supplier.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-0.5 text-blue-600">
              <ExternalLink className="w-2.5 h-2.5" />
              <span>Ver más</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="news-panel mobile-padding mb-4 sm:mb-6 max-w-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs sm:text-sm text-gray-600 font-medium">
          Empresas Proveedoras - Publicidad
        </span>
        <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-2 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-300">
          Patrocinado
        </Badge>
      </div>
      
      <div className="relative">
        {advertisements.length > 2 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-1/2 -left-2 sm:-left-3 transform -translate-y-1/2 z-10 bg-white/90 hover:bg-white w-6 h-6 sm:w-8 sm:h-8 p-0 rounded-full shadow-md"
              onClick={prevAd}
              onMouseEnter={() => setIsAutoPlaying(false)}
              onMouseLeave={() => setIsAutoPlaying(true)}
            >
              <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-1/2 -right-2 sm:-right-3 transform -translate-y-1/2 z-10 bg-white/90 hover:bg-white w-6 h-6 sm:w-8 sm:h-8 p-0 rounded-full shadow-md"
              onClick={nextAd}
              onMouseEnter={() => setIsAutoPlaying(false)}
              onMouseLeave={() => setIsAutoPlaying(true)}
            >
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </>
        )}

        {/* Mobile: 1 ad, Desktop: 2 ads side by side */}
        <div className="flex gap-3 sm:gap-4">
          {/* Always show first ad */}
          <div className="w-full md:w-1/2">
            <AdCard ad={currentAd} />
          </div>
          
          {/* Second ad only on desktop */}
          <div className="hidden md:block md:w-1/2">
            <AdCard ad={secondAd} />
          </div>
        </div>

        {/* Indicators */}
        {advertisements.length > 1 && (
          <div className="flex justify-center gap-1 mt-2">
            {Array.from({ length: Math.ceil(advertisements.length / 2) }).map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  Math.floor(currentIndex / 2) === index 
                    ? 'bg-blue-600' 
                    : 'bg-gray-300'
                }`}
                onClick={() => setCurrentIndex(index * 2)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
