import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp } from "lucide-react";

interface NewsItem {
  id: number;
  title: string;
  summary: string;
  category: string;
  date: string;
  trending?: boolean;
}

const constructionNews: NewsItem[] = [
  {
    id: 1,
    title: "Nuevo proyecto habitacional en Santa Cruz generará 500 empleos",
    summary: "El gobierno departamental anuncia inversión en vivienda social",
    category: "Vivienda",
    date: "2025-01-15",
    trending: true
  },
  {
    id: 2,
    title: "Precios del cemento se mantienen estables en enero 2025",
    summary: "Asociación de productores confirma estabilidad en materiales básicos",
    category: "Materiales",
    date: "2025-01-14"
  },
  {
    id: 3,
    title: "Bolivia implementará nuevos estándares de construcción antisísmica",
    summary: "Normativa entrará en vigor a partir del segundo semestre",
    category: "Normativa",
    date: "2025-01-13",
    trending: true
  },
  {
    id: 4,
    title: "Crecimiento del 15% en el sector construcción durante 2024",
    summary: "INE reporta datos positivos para la industria de la construcción",
    category: "Economía",
    date: "2025-01-12"
  },
  {
    id: 5,
    title: "Feria Internacional de Construcción Bolivia 2025 se realizará en mayo",
    summary: "Evento reunirá a más de 200 empresas del sector",
    category: "Eventos",
    date: "2025-01-11"
  }
];

export function MobileNewsTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % constructionNews.length);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const currentNews = constructionNews[currentIndex];

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Vivienda': 'bg-green-100 text-green-800',
      'Materiales': 'bg-orange-100 text-orange-800',
      'Normativa': 'bg-purple-100 text-purple-800',
      'Economía': 'bg-blue-100 text-blue-800',
      'Eventos': 'bg-pink-100 text-pink-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-BO', {
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className="px-4">
      <div className="text-xs text-gray-500 mb-2 flex items-center justify-center">
        <TrendingUp className="w-3 h-3 mr-1" />
        Noticias de Construcción en Bolivia
      </div>
      
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 overflow-hidden">
        <CardContent className="p-3">
          <div className="flex items-start space-x-3">
            {/* Date & Category */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="text-xs font-semibold text-emerald-700 mb-1">
                {formatDate(currentNews.date)}
              </div>
              <Badge 
                variant="secondary" 
                className={`text-xs px-2 py-0 ${getCategoryColor(currentNews.category)}`}
              >
                {currentNews.category}
              </Badge>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-semibold text-sm text-emerald-900 leading-tight">
                  {currentNews.title}
                  {currentNews.trending && (
                    <TrendingUp className="inline w-3 h-3 ml-1 text-red-500" />
                  )}
                </h3>
              </div>
              
              <p className="text-xs text-emerald-700 leading-relaxed">
                {currentNews.summary}
              </p>
            </div>

            {/* Progress indicator */}
            <div className="flex flex-col space-y-1 flex-shrink-0">
              {constructionNews.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1 h-1 rounded-full transition-all duration-300 ${
                    idx === currentIndex 
                      ? 'bg-emerald-600 scale-150' 
                      : 'bg-emerald-300'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* News counter */}
          <div className="flex items-center justify-center mt-2 pt-2 border-t border-emerald-200">
            <Clock className="w-3 h-3 mr-1 text-emerald-600" />
            <span className="text-xs text-emerald-600">
              {currentIndex + 1} de {constructionNews.length} noticias
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}