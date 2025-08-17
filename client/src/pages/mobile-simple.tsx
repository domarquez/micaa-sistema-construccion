import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, Store, Search, Menu, X, User, UserPlus } from "lucide-react";
import { MobileAdCarousel } from "@/components/mobile/mobile-ad-carousel";
import { MobileNewsTicker } from "@/components/mobile/mobile-news-ticker";

export default function MobileSimple() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("materials");

  // Simple queries
  const { data: statistics } = useQuery({
    queryKey: ['/api/statistics'],
  });

  const { data: materials } = useQuery({
    queryKey: ['/api/public/materials'],
  });

  const { data: categories } = useQuery({
    queryKey: ['/api/public/material-categories'],
  });

  // Filter materials safely
  const filteredMaterials = Array.isArray(materials) 
    ? materials.filter((material: any) => 
        material.name.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10)
    : [];

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

          <div className="font-bold text-orange-600">MICAA</div>

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

      {/* Full Screen Menu */}
      {menuOpen && (
        <div className="fixed inset-0 bg-white z-40 pt-12">
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold">Menú Principal</h2>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setActiveTab("materials");
                  setMenuOpen(false);
                }}
                className="w-full flex items-center p-3 bg-gray-50 rounded-lg"
              >
                <Package className="w-5 h-5 mr-3 text-orange-600" />
                <span>Materiales</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("suppliers");
                  setMenuOpen(false);
                }}
                className="w-full flex items-center p-3 bg-gray-50 rounded-lg"
              >
                <Store className="w-5 h-5 mr-3 text-orange-600" />
                <span>Proveedores</span>
              </button>

              <button
                onClick={() => window.location.href = "/login"}
                className="w-full flex items-center p-3 bg-gray-50 rounded-lg"
              >
                <User className="w-5 h-5 mr-3 text-orange-600" />
                <span>Iniciar Sesión</span>
              </button>
            </div>

            <Button 
              variant="outline" 
              onClick={() => setMenuOpen(false)}
              className="w-full mt-6"
            >
              Cerrar Menú
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Hero */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 rounded-lg text-center">
          <h1 className="text-xl font-bold mb-2">MICAA</h1>
          <p className="text-sm mb-4">Sistema de construcción para Bolivia</p>
          <Button 
            onClick={() => window.location.href = "/register"}
            className="bg-white text-orange-600 hover:bg-gray-100"
          >
            Comenzar Proyecto
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-orange-600">
                {(statistics as any)?.totalMaterials?.toLocaleString() || '0'}
              </div>
              <div className="text-xs text-gray-600">Materiales</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-orange-600">
                {(statistics as any)?.totalActivities || '0'}
              </div>
              <div className="text-xs text-gray-600">Actividades</div>
            </CardContent>
          </Card>
        </div>

        {/* Advertisement Carousel */}
        <MobileAdCarousel />

        {/* Construction News Ticker */}
        <MobileNewsTicker />

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
        <div className="space-y-3">
          <h3 className="font-semibold">Materiales Destacados</h3>
          {filteredMaterials.length > 0 ? (
            filteredMaterials.map((material: any) => {
              const category = Array.isArray(categories) 
                ? categories.find((c: any) => c.id === material.categoryId)
                : null;
              
              return (
                <Card key={material.id}>
                  <CardContent className="p-3">
                    <div className="flex justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{material.name}</h4>
                        {category && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {category.name}
                          </Badge>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          Unidad: {material.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-orange-600">
                          Bs. {material.basePrice?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Cargando materiales...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}