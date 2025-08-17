import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Package, Store, Search } from "lucide-react";
import MobileHeader from "@/components/layout/mobile-header";
import { AdCarousel } from "@/components/advertising/ad-carousel";
import { ConstructionNewsTicker } from "@/components/news/construction-news-ticker";

export default function MobilePublicView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Queries
  const { data: statistics } = useQuery({
    queryKey: ['/api/statistics'],
  });

  const { data: materials } = useQuery({
    queryKey: ['/api/public/materials'],
  });

  const { data: categories } = useQuery({
    queryKey: ['/api/public/material-categories'],
  });

  const { data: suppliers } = useQuery({
    queryKey: ['/api/public/suppliers'],
  });

  // Filter materials
  const filteredMaterials = (materials as any[])?.filter((material: any) => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || material.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  }).slice(0, 10) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader />
      
      {/* Mobile Content */}
      <div className="pb-6">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-orange-600 to-red-600 text-white p-6">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">MICAA</h1>
            <p className="text-sm opacity-90">
              Sistema integral para la construcción en Bolivia
            </p>
            <Button 
              onClick={() => window.location.href = "/register"}
              className="bg-white text-orange-600 hover:bg-gray-100 font-medium px-6"
            >
              Comenzar Proyecto
            </Button>
          </div>
        </div>

        {/* Statistics Cards - Mobile Optimized */}
        <div className="px-4 -mt-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-white shadow-sm">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-orange-600">
                  {(statistics as any)?.totalMaterials?.toLocaleString() || '0'}
                </div>
                <div className="text-xs text-gray-600">Materiales</div>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-sm">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-orange-600">
                  {(statistics as any)?.totalActivities || '0'}
                </div>
                <div className="text-xs text-gray-600">Actividades</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Advertisement Carousel */}
        <div className="px-4 mb-4">
          <div className="bg-gray-100 rounded-lg p-4 text-center text-sm text-gray-600">
            Espacio publicitario disponible
          </div>
        </div>

        {/* Construction News */}
        <div className="mb-4 px-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              📢 Últimas noticias del sector construcción en Bolivia
            </p>
          </div>
        </div>

        {/* Main Content Tabs */}
        <div className="px-4">
          <Tabs defaultValue="materials" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="materials" data-tab="materials" className="text-xs">
                <Package className="w-3 h-3 mr-1" />
                Materiales
              </TabsTrigger>
              <TabsTrigger value="suppliers" data-tab="suppliers" className="text-xs">
                <Store className="w-3 h-3 mr-1" />
                Proveedores
              </TabsTrigger>
            </TabsList>

            <TabsContent value="materials" className="space-y-4">
              {/* Search and Filter */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar materiales..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 text-sm"
                  />
                </div>

                {/* Category Filter */}
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  <Button
                    variant={selectedCategory === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    className="whitespace-nowrap text-xs"
                  >
                    Todos
                  </Button>
                  {(categories as any[])?.slice(0, 5).map((category: any) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category.id)}
                      className="whitespace-nowrap text-xs"
                    >
                      {category.name.split(' ').slice(0, 2).join(' ')}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Materials List */}
              <div className="space-y-3">
                {filteredMaterials.map((material: any) => {
                  const category = (categories as any[])?.find((c: any) => c.id === material.categoryId);
                  return (
                    <Card key={material.id} className="shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm leading-tight mb-1">
                              {material.name}
                            </h3>
                            {category && (
                              <Badge variant="secondary" className="text-xs mb-2">
                                {category.name}
                              </Badge>
                            )}
                            <div className="text-xs text-gray-600">
                              Unidad: {material.unit}
                            </div>
                          </div>
                          <div className="text-right ml-2">
                            <div className="font-bold text-orange-600 text-sm">
                              Bs. {material.basePrice?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {filteredMaterials.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No se encontraron materiales</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="suppliers" className="space-y-4">
              <div className="space-y-3">
                {(suppliers as any[])?.length > 0 ? (
                  (suppliers as any[]).map((supplier: any) => (
                    <Card key={supplier.id} className="shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                            <Store className="w-4 h-4 text-orange-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm">{supplier.name}</h3>
                            <p className="text-xs text-gray-600 truncate">
                              {supplier.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Store className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay proveedores disponibles</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}