import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Eye, MapPin, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

export default function CompanyAdInFeed() {
  const { data: advertisements = [] } = useQuery<AdvertisementWithSupplier[]>({
    queryKey: ["/api/public/dual-advertisements"],
    staleTime: 10 * 60 * 1000,
  });

  // Show second ad or fallback to first for in-feed placement
  const ad = advertisements[1] || advertisements[0];

  if (!ad) {
    return null;
  }

  const handleAdClick = async () => {
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

  return (
    <div className="mobile-padding mb-4">
      <div className="text-xs text-gray-500 mb-2 text-center">Publicidad</div>
      <Card 
        className="cursor-pointer hover:shadow-lg transition-all border border-orange-200 bg-gradient-to-br from-orange-50 to-blue-50 max-w-full overflow-hidden"
        onClick={handleAdClick}
      >
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 text-left">
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm sm:text-base font-bold text-orange-900 leading-tight">
                  {ad.title}
                </h3>
                <Badge variant="secondary" className="text-[8px] sm:text-[9px] px-1 py-0 flex-shrink-0">
                  Patrocinado
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs sm:text-sm font-medium text-orange-700">
                  {ad.supplier.companyName}
                </p>
              </div>

              {ad.description && (
                <p className="text-xs sm:text-sm text-gray-700 line-clamp-2 mb-2">
                  {ad.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs text-gray-600">
                {ad.supplier.city && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{ad.supplier.city}</span>
                  </div>
                )}
                {ad.supplier.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span>{ad.supplier.phone}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex sm:flex-col items-center justify-center gap-2 text-orange-600 flex-shrink-0">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
              <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}