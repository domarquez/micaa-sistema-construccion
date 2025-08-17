import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, Store, Search, Menu, X, User, UserPlus, TrendingUp, Building2 } from "lucide-react";

// Static data to avoid HTTP requests
const staticStatistics = {
  totalMaterials: 2080,
  totalActivities: 45,
  activeBudgets: 156,
  totalProjectValue: 2450000
};

const staticMaterials = [
  { id: 1, name: "Cemento Portland", category: "Cementos", price: 85.50, unit: "Bolsa 50kg" },
  { id: 2, name: "Hierro corrugado 12mm", category: "Aceros", price: 42.80, unit: "Barra 12m" },
  { id: 3, name: "Ladrillo 6H", category: "Mampostería", price: 1.20, unit: "Unidad" },
  { id: 4, name: "Arena fina", category: "Agregados", price: 180.00, unit: "m³" },
  { id: 5, name: "Grava 3/4", category: "Agregados", price: 220.00, unit: "m³" },
  { id: 6, name: "Pintura látex", category: "Pinturas", price: 165.00, unit: "Galón" },
  { id: 7, name: "Tubería PVC 4 pulg", category: "Plomería", price: 98.00, unit: "Tubo 6m" },
  { id: 8, name: "Cable eléctrico 12 AWG", category: "Electricidad", price: 8.50, unit: "Metro" }
];

const supplierAds = [
  {
    id: 1,
    name: "Constructora Santa Cruz S.R.L.",
    description: "Líderes en materiales de construcción con más de 20 años de experiencia",
    city: "Santa Cruz",
    phone: "+591 3-123-4567",
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
    specialties: ["Pisos", "Revestimientos", "Iluminación"]
  }
];

const constructionNews = [
  "Nuevo proyecto habitacional en Santa Cruz generará 500 empleos",
  "Precios del cemento se mantienen estables en enero 2025",
  "Bolivia implementará nuevos estándares de construcción antisísmica",
  "Crecimiento del 15% en el sector construcción durante 2024",
  "Feria Internacional de Construcción Bolivia 2025 se realizará en mayo"
];

export default function MobileStatic() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);

  // Auto rotate ads and news
  useEffect(() => {
    const adInterval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % supplierAds.length);
    }, 4000);

    const newsInterval = setInterval(() => {
      setCurrentNewsIndex((prev) => (prev + 1) % constructionNews.length);
    }, 6000);

    return () => {
      clearInterval(adInterval);
      clearInterval(newsInterval);
    };
  }, []);

  const filteredMaterials = staticMaterials.filter((material) =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentAd = supplierAds[currentAdIndex];
  const currentNews = constructionNews[currentNewsIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Mobile Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="flex h-12 items-center justify-between px-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setMenuOpen(!menuOpen)}
            className="h-8 w-8 p-0"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>

          <div className="font-bold text-orange-600 text-lg">MICAA</div>

          <div className="flex space-x-1">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => window.location.href = "/login"}
              className="h-7 px-2 text-xs"
            >
              <User className="w-3 h-3" />
            </Button>
            <Button 
              size="sm"
              onClick={() => window.location.href = "/register"}
              className="h-7 px-2 text-xs bg-orange-600 hover:bg-orange-700"
            >
              <UserPlus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Welcome Section */}
        <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
          <CardContent className="p-4 text-center">
            <h1 className="text-lg font-bold mb-2">
              Sistema Integral de Construcción
            </h1>
            <p className="text-sm opacity-90 mb-3">
              Gestión profesional de proyectos en Bolivia
            </p>
            <Button 
              className="bg-white text-orange-600 hover:bg-gray-100 text-xs h-8 px-4"
              onClick={() => window.location.href = "/register"}
            >
              Iniciar Proyecto
            </Button>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-orange-600">
                {staticStatistics.totalMaterials.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Materiales</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-blue-600">
                {staticStatistics.totalActivities}
              </div>
              <div className="text-xs text-gray-600">Actividades</div>
            </CardContent>
          </Card>
        </div>

        {/* Supplier Advertisement */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 mb-2 text-center">
              Empresas Proveedoras Destacadas
            </div>
            <h3 className="font-semibold text-sm text-blue-900 mb-1">
              {currentAd.name}
            </h3>
            <p className="text-xs text-blue-700 mb-2">
              {currentAd.description}
            </p>
            <div className="flex items-center justify-between">
              <div className="text-xs text-blue-600">
                📍 {currentAd.city} | 📞 {currentAd.phone}
              </div>
              <div className="flex space-x-1">
                {supplierAds.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === currentAdIndex ? 'bg-blue-600' : 'bg-blue-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Construction News */}
        <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
          <CardContent className="p-3">
            <div className="text-xs text-gray-500 mb-2 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              Noticias de Construcción
            </div>
            <p className="text-sm text-emerald-900 leading-tight text-center">
              {currentNews}
            </p>
            <div className="flex justify-center mt-2">
              <span className="text-xs text-emerald-600">
                {currentNewsIndex + 1} de {constructionNews.length}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar materiales..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Materials List */}
        <div className="space-y-2">
          {filteredMaterials.slice(0, 6).map((material) => (
            <Card key={material.id}>
              <CardContent className="p-3">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <h3 className="font-medium text-sm text-gray-900">
                      {material.name}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {material.category}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {material.unit}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm text-orange-600">
                      Bs. {material.price.toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-gray-100 to-gray-200">
          <CardContent className="p-4 text-center">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-600" />
            <h3 className="font-semibold text-sm mb-2">
              ¿Listo para tu proyecto?
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Regístrate para acceder a todas las funcionalidades
            </p>
            <Button 
              className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs h-8"
              onClick={() => window.location.href = "/register"}
            >
              Crear Cuenta Gratis
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}