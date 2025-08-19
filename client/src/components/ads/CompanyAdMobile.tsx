import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

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

export default function CompanyAdMobile() {
  const { data: advertisements = [] } = useQuery<AdvertisementWithSupplier[]>({
    queryKey: ["/api/public/dual-advertisements"],
    staleTime: 10 * 60 * 1000,
  });

  // Show only first ad for mobile (compact)
  const ad = advertisements[0];

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
    <div className="block sm:hidden mb-2 mobile-padding">
      <div className="text-[8px] text-gray-400 mb-1 text-center">Publicidad</div>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow border border-blue-200 bg-gradient-to-r from-blue-50 to-orange-50 max-w-full overflow-hidden"
        onClick={handleAdClick}
      >
        <CardContent className="p-2">
          <div className="flex items-center gap-2 text-left">
            <div className="flex-1 min-w-0">
              <h3 className="text-[10px] sm:text-xs font-semibold text-blue-900 truncate">
                {ad.title}
              </h3>
              <p className="text-[8px] sm:text-[9px] text-blue-700 truncate">
                {ad.supplier.companyName}
              </p>
              {ad.description && (
                <p className="text-[8px] text-gray-600 line-clamp-1 mt-0.5">
                  {ad.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 text-blue-600 flex-shrink-0">
              <Eye className="w-2.5 h-2.5" />
              <ExternalLink className="w-2.5 h-2.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}