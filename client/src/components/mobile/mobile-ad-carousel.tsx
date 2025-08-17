import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ExternalLink, MapPin, Phone } from "lucide-react";

interface SupplierAd {
  id: number;
  name: string;
  description: string;
  city: string;
  phone?: string;
  website?: string;
  specialties: string[];
}

const mockSupplierAds: SupplierAd[] = [
  {
    id: 1,
    name: "Constructora Santa Cruz S.R.L.",
    description: "Líderes en materiales de construcción con más de 20 años de experiencia",
    city: "Santa Cruz",
    phone: "+591 3-123-4567",
    website: "www.constructorasc.com",
    specialties: ["Cemento", "Acero", "Ladrillos"]
  },
  {
    id: 2,
    name: "Ferretería La Paz Industrial",
    description: "Todo en herramientas y materiales para la construcción moderna",
    city: "La Paz",
    phone: "+591 2-987-6543",
    specialties: ["Herramientas", "Pinturas", "Sanitarios"]
  },
  {
    id: 3,
    name: "Materiales Cochabamba",
    description: "Distribuidores oficiales de las mejores marcas del mercado",
    city: "Cochabamba",
    phone: "+591 4-555-0123",
    website: "www.materialescbba.bo",
    specialties: ["Pisos", "Revestimientos", "Iluminación"]
  },
  {
    id: 4,
    name: "Aceros del Norte",
    description: "Especialistas en estructuras metálicas y acero de construcción",
    city: "Sucre",
    phone: "+591 4-777-8888",
    specialties: ["Acero estructural", "Perfiles", "Mallas"]
  }
];

export function MobileAdCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % mockSupplierAds.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const nextAd = () => {
    setCurrentIndex((prev) => (prev + 1) % mockSupplierAds.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const prevAd = () => {
    setCurrentIndex((prev) => (prev - 1 + mockSupplierAds.length) % mockSupplierAds.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const currentAd = mockSupplierAds[currentIndex];

  return (
    <div className="relative">
      <div className="text-xs text-gray-500 mb-2 text-center">
        Empresas Proveedoras Destacadas
      </div>
      
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-blue-900 mb-1">
                {currentAd.name}
              </h3>
              <p className="text-xs text-blue-700 mb-2">
                {currentAd.description}
              </p>
              
              <div className="flex items-center space-x-3 text-xs text-blue-600 mb-2">
                <div className="flex items-center">
                  <MapPin className="w-3 h-3 mr-1" />
                  {currentAd.city}
                </div>
                {currentAd.phone && (
                  <div className="flex items-center">
                    <Phone className="w-3 h-3 mr-1" />
                    {currentAd.phone}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                {currentAd.specialties.slice(0, 3).map((specialty, idx) => (
                  <span
                    key={idx}
                    className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col space-y-2 ml-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevAd}
                className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-100"
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={nextAd}
                className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-100"
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex space-x-1">
              {mockSupplierAds.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentIndex ? 'bg-blue-600' : 'bg-blue-300'
                  }`}
                />
              ))}
            </div>

            {currentAd.website && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2 border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Visitar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}