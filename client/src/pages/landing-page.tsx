import { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Building2, Calculator, Users, Package, Truck, TrendingUp, 
  Star, MapPin, Phone, Mail, Globe, Search, Filter,
  ArrowRight, CheckCircle, BarChart3, Eye, X, Plus,
  Combine, Home, FolderRoot, ShoppingBag, Sparkles
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import MicaaLogo from "@/components/micaa-logo";
import { ContactForm } from "@/components/contact-form";
import { BannerAd, SquareAd, SidebarAd, MobileAd } from "@/components/ad-space";
// Alias para mantener compatibilidad
const AdHeader = BannerAd;
const AdMobile = MobileAd;

// Tipos
interface Material {
  id: number;
  name: string;
  unit: string;
  price: number;
  categoryId: number;
  category?: { name: string };
}

interface MaterialCategory {
  id: number;
  name: string;
  description?: string;
}

interface SupplierCompany {
  id: number;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  speciality: string;
  description: string;
  rating: number;
}

interface AdvertisementWithSupplier {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  adType: "featured" | "standard";
  viewCount: number;
  supplier: {
    id: number;
    companyName: string;
    city: string;
    speciality: string;
  };
}

interface Statistics {
  totalUsers: number;
  totalMaterials: number;
  totalActivities: number;
  totalSuppliers: number;
  activeBudgets: number;
  totalProjects: number;
  totalProjectValue: number;
}

interface GrowthData {
  month: string;
  users: number;
  projects: number;
  budgets: number;
  suppliers: number;
}

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"materials" | "suppliers" | "features">("features");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAd, setShowAd] = useState(true);

  // Consultas públicas sin autenticación
  const { data: materials, isLoading: materialsLoading } = useQuery<Material[]>({
    queryKey: ["/api/public/materials"],
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery<MaterialCategory[]>({
    queryKey: ["/api/public/material-categories"],
  });

  const { data: suppliers, isLoading: suppliersLoading } = useQuery<SupplierCompany[]>({
    queryKey: ["/api/public/suppliers"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<Statistics>({
    queryKey: ["/api/statistics"],
  });

  const { data: growthData, isLoading: growthLoading } = useQuery<GrowthData[]>({
    queryKey: ["/api/growth-data"],
  });

  // Publicidad dual lado a lado
  const { data: advertisements, refetch: refetchAds } = useQuery<AdvertisementWithSupplier[]>({
    queryKey: ["/api/public/dual-advertisements"],
    refetchInterval: 30000, // Cambiar cada 30 segundos
  });

  const handleAdClick = async (ad: AdvertisementWithSupplier) => {
    // Registrar clic
    await fetch(`/api/advertisements/${ad.id}/click`, {
      method: 'POST'
    });
    
    // Abrir enlace si existe
    if (ad.linkUrl) {
      window.open(ad.linkUrl, '_blank');
    }
  };

  const handleCloseAds = () => {
    setShowAd(false);
    setTimeout(() => {
      setShowAd(true);
      refetchAds();
    }, 10000);
  };

  const filteredMaterials = materials?.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || material.categoryId.toString() === selectedCategory;
    return matchesSearch && matchesCategory;
  }).slice(0, 20) || [];

  const filteredSuppliers = suppliers?.filter(supplier =>
    supplier.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.speciality?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Sidebar Ad for Desktop */}
      <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-40 hidden xl:block">
        <SidebarAd />
      </div>

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 text-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 md:py-12">
          {/* Navigation */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 md:mb-12">
            <div className="flex items-center space-x-3">
              <MicaaLogo size="lg" showText={true} />
              <div className="hidden md:block">
                <p className="text-orange-100 text-sm">
                  Sistema Integral de Construcción y Arquitectura
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <ContactForm 
                triggerText="Contacto"
                triggerVariant="outline"
                className="flex items-center space-x-2 text-white border-white hover:bg-white hover:text-orange-600"
              />
              <Button 
                variant="outline" 
                onClick={() => window.location.href = "/login"} 
                className="w-full sm:w-auto text-white border-white hover:bg-white hover:text-orange-600"
              >
                Iniciar Sesión
              </Button>
              <Button 
                onClick={() => window.location.href = "/register"} 
                className="w-full sm:w-auto bg-white text-orange-600 hover:bg-orange-50"
              >
                Registrarse Gratis
              </Button>
            </div>
          </div>

          {/* Hero Content */}
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-4">
                <Badge className="bg-orange-500/20 text-orange-100 border-orange-400">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Plataforma Líder en Bolivia
                </Badge>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
                  Tu Centro de Construcción
                  <span className="block text-orange-200">Digital en Bolivia</span>
                </h1>
                <p className="text-lg text-orange-100 leading-relaxed">
                  Conectamos arquitectos, constructores y proveedores. Crea presupuestos precisos, 
                  encuentra materiales y explora el marketplace más completo del sector construcción.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg"
                  onClick={() => window.location.href = "/register"}
                  className="bg-white text-orange-600 hover:bg-orange-50 font-semibold px-8"
                >
                  Comenzar Gratis
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    setActiveTab("features");
                    document.getElementById("features-section")?.scrollIntoView({ 
                      behavior: 'smooth', 
                      block: 'start' 
                    });
                  }}
                  className="border-2 border-white bg-white/10 text-white hover:bg-white hover:text-orange-600 px-8 font-semibold backdrop-blur-sm"
                >
                  Ver Características
                </Button>
              </div>

              {/* Features Preview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-orange-200" />
                  <span className="text-sm text-orange-100">Presupuestos APU</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-orange-200" />
                  <span className="text-sm text-orange-100">2,000+ Materiales</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-orange-200" />
                  <span className="text-sm text-orange-100">Red de Proveedores</span>
                </div>
              </div>
            </div>

            {/* Stats Preview */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-white/10 border-white/20 text-white">
                <CardContent className="p-4 text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-orange-200" />
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 mx-auto mb-2 bg-white/20" />
                  ) : (
                    <p className="text-2xl font-bold">{formatNumber(stats?.totalUsers || 0)}</p>
                  )}
                  <p className="text-sm text-orange-100">Usuarios Activos</p>
                </CardContent>
              </Card>
              
              <Card className="bg-white/10 border-white/20 text-white">
                <CardContent className="p-4 text-center">
                  <Calculator className="w-8 h-8 mx-auto mb-2 text-orange-200" />
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 mx-auto mb-2 bg-white/20" />
                  ) : (
                    <p className="text-2xl font-bold">{formatNumber(stats?.activeBudgets || 0)}</p>
                  )}
                  <p className="text-sm text-orange-100">Presupuestos</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20 text-white">
                <CardContent className="p-4 text-center">
                  <Package className="w-8 h-8 mx-auto mb-2 text-orange-200" />
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 mx-auto mb-2 bg-white/20" />
                  ) : (
                    <p className="text-2xl font-bold">{formatNumber(stats?.totalMaterials || 0)}</p>
                  )}
                  <p className="text-sm text-orange-100">Materiales</p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20 text-white">
                <CardContent className="p-4 text-center">
                  <Truck className="w-8 h-8 mx-auto mb-2 text-orange-200" />
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 mx-auto mb-2 bg-white/20" />
                  ) : (
                    <p className="text-2xl font-bold">{formatNumber(stats?.totalSuppliers || 0)}</p>
                  )}
                  <p className="text-sm text-orange-100">Proveedores</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Header Ad - Desktop y Mobile */}
      <div className="hidden md:block bg-white py-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AdHeader />
        </div>
      </div>
      
      {/* Mobile Ad - Solo móvil */}
      <div className="md:hidden bg-white py-2">
        <AdMobile />
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 md:py-12 space-y-8 md:space-y-12">
        
        {/* Empresas Destacadas - Publicidades */}
        {advertisements && advertisements.length > 0 && showAd && (
          <div className="relative">
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Empresas Destacadas
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Descubre las mejores empresas del sector construcción en Bolivia
              </p>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-0 right-0 z-10 h-8 w-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600"
              onClick={handleCloseAds}
            >
              <X className="w-4 h-4" />
            </Button>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {advertisements.slice(0, 2).map((ad, index) => (
                <Card 
                  key={ad.id} 
                  className="relative overflow-hidden border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                  onClick={() => handleAdClick(ad)}
                >
                  <CardContent className="p-0">
                    <div className="relative h-48 w-full overflow-hidden">
                      <img 
                        src={ad.imageUrl} 
                        alt={ad.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      
                      {/* Badge de tipo */}
                      <div className="absolute top-3 left-3">
                        <Badge className={ad.adType === "featured" ? "bg-yellow-500 text-white" : "bg-blue-500 text-white"}>
                          {ad.adType === "featured" ? (
                            <>
                              <Star className="w-3 h-3 mr-1" />
                              Destacado
                            </>
                          ) : (
                            "Patrocinado"
                          )}
                        </Badge>
                      </div>
                      
                      {/* Información superpuesta */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="font-bold text-xl mb-1 drop-shadow-lg line-clamp-1">
                          {ad.title}
                        </h3>
                        <p className="text-blue-200 text-sm font-medium drop-shadow">
                          {ad.supplier.companyName}
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white dark:bg-gray-800">
                      {ad.description && (
                        <p className="text-gray-700 dark:text-gray-300 text-sm mb-3 line-clamp-2">
                          {ad.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 text-sm">
                          <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
                            <Eye className="w-4 h-4" />
                            <span>{ad.viewCount}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
                            <MapPin className="w-4 h-4" />
                            <span>{ad.supplier.city}</span>
                          </div>
                        </div>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                          Ver Más
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Banner Ad */}
        <div className="flex justify-center">
          <BannerAd />
        </div>

        {/* Tabs de Contenido */}
        <div id="features-section">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Explora Nuestro Ecosistema
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Descubre materiales, proveedores y herramientas para tu próximo proyecto
                </p>
              </div>
              <TabsList className="grid w-full lg:w-auto grid-cols-3 lg:grid-cols-3 gap-1">
                <TabsTrigger value="features" className="text-sm">Características</TabsTrigger>
                <TabsTrigger value="materials" className="text-sm">Materiales</TabsTrigger>
                <TabsTrigger value="suppliers" className="text-sm">Proveedores</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="features" className="space-y-8">
            {/* Características Principales */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="text-center">
                  <Calculator className="w-12 h-12 mx-auto text-orange-600 mb-4" />
                  <CardTitle className="text-lg">Presupuestos APU</CardTitle>
                  <CardDescription>
                    Crea presupuestos detallados con análisis de precios unitarios profesionales
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      <span>Cálculo automático de composiciones</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      <span>Factores regionales de precios</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      <span>Exportación a PDF profesional</span>
                    </div>
                  </div>
                  <Button className="w-full mt-4" onClick={() => window.location.href = "/register"}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Presupuesto
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="text-center">
                  <Package className="w-12 h-12 mx-auto text-green-600 mb-4" />
                  <CardTitle className="text-lg">Catálogo de Materiales</CardTitle>
                  <CardDescription>
                    Accede a más de 2,000 materiales con precios actualizados del mercado boliviano
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      <span>Precios actualizados semanalmente</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      <span>Categorización por especialidad</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      <span>Búsqueda avanzada</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full mt-4" onClick={() => setActiveTab("materials")}>
                    Ver Materiales
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="text-center">
                  <Truck className="w-12 h-12 mx-auto text-purple-600 mb-4" />
                  <CardTitle className="text-lg">Red de Proveedores</CardTitle>
                  <CardDescription>
                    Conecta con proveedores verificados en toda Bolivia
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      <span>Proveedores verificados</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      <span>Sistema de calificaciones</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      <span>Contacto directo</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full mt-4" onClick={() => setActiveTab("suppliers")}>
                    Ver Proveedores
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de Crecimiento */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BarChart3 className="w-6 h-6" />
                  Crecimiento de la Plataforma
                </CardTitle>
                <CardDescription>
                  Evolución de usuarios y proyectos en los últimos meses
                </CardDescription>
              </CardHeader>
              <CardContent>
                {growthLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={growthData || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="users" 
                          stroke="#3B82F6" 
                          strokeWidth={2}
                          name="Usuarios"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="projects" 
                          stroke="#10B981" 
                          strokeWidth={2}
                          name="Proyectos"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="budgets" 
                          stroke="#F59E0B" 
                          strokeWidth={2}
                          name="Presupuestos"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materials" className="space-y-6">
            {/* Búsqueda de Materiales */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar materiales..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todas las categorías</option>
                  {categories?.slice(0, 10).map((category) => (
                    <option key={category.id} value={category.id.toString()}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid de Materiales */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {materialsLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-3 w-16 mb-2" />
                        <Skeleton className="h-6 w-20" />
                      </CardContent>
                    </Card>
                  ))
                : filteredMaterials.map((material) => (
                    <Card key={material.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-sm mb-1 line-clamp-2">{material.name}</h3>
                        <p className="text-xs text-gray-500 mb-2">{material.unit}</p>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-orange-600">{formatCurrency(material.price)}</span>
                          <Badge variant="secondary" className="text-xs">Público</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              }
            </div>

            {filteredMaterials.length === 0 && !materialsLoading && (
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No se encontraron materiales</p>
              </div>
            )}

            {/* Registro para ver más */}
            <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
              <CardContent className="p-6 text-center">
                <h3 className="text-xl font-bold mb-2">¿Quieres ver más materiales?</h3>
                <p className="text-gray-600 mb-4">
                  Regístrate gratis para acceder al catálogo completo de más de 2,000 materiales
                </p>
                <Button onClick={() => window.location.href = "/register"} className="bg-orange-600 hover:bg-orange-700">
                  Registrarse Gratis
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-6">
            {/* Búsqueda de Proveedores */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar proveedores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Grid de Proveedores */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {suppliersLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <div className="flex items-center space-x-3 mb-4">
                          <Skeleton className="w-12 h-12 rounded-full" />
                          <div>
                            <Skeleton className="h-4 w-32 mb-2" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                        <Skeleton className="h-16 w-full mb-4" />
                        <div className="flex justify-between">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-8 w-20" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                : filteredSuppliers.slice(0, 9).map((supplier) => (
                    <Card key={supplier.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                              {supplier.companyName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm line-clamp-1">{supplier.companyName}</h3>
                              <p className="text-xs text-gray-500">{supplier.contactPerson}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-400 mr-1" />
                            <span className="text-sm font-medium">{supplier.rating || 4.5}</span>
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          <p className="text-sm text-gray-600 line-clamp-2">{supplier.description}</p>
                          <Badge variant="secondary" className="text-xs">
                            {supplier.speciality}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-gray-500">
                            <MapPin className="w-4 h-4 mr-1" />
                            {supplier.city}
                          </div>
                          <Button size="sm" variant="outline">
                            <Phone className="w-3 h-3 mr-1" />
                            Contactar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              }
            </div>

            {filteredSuppliers.length === 0 && !suppliersLoading && (
              <div className="text-center py-8">
                <Truck className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No se encontraron proveedores</p>
              </div>
            )}
          </TabsContent>
          </Tabs>
        </div>

        {/* Square Ad */}
        <div className="flex justify-center">
          <SquareAd />
        </div>

        {/* Call to Action Final */}
        <Card className="bg-gradient-to-r from-orange-600 to-red-600 text-white">
          <CardContent className="p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              ¿Listo para Digitalizar tu Construcción?
            </h2>
            <p className="text-orange-100 text-lg mb-6 max-w-2xl mx-auto">
              Únete a miles de profesionales que ya confían en MICAA para sus proyectos. 
              Registrarte es completamente gratis y toma menos de 2 minutos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => window.location.href = "/register"}
                className="bg-white text-orange-600 hover:bg-orange-50 font-semibold px-8"
              >
                Registrarse Gratis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => window.location.href = "/login"}
                className="border-white text-white hover:bg-white hover:text-orange-600 px-8"
              >
                Ya tengo cuenta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <MicaaLogo size="md" showText={true} />
              <p className="text-gray-400 mt-4">
                La plataforma líder para profesionales de la construcción en Bolivia.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Enlaces Rápidos</h4>
              <div className="space-y-2 text-sm">
                <a href="/register" className="block text-gray-400 hover:text-white">Registrarse</a>
                <a href="/login" className="block text-gray-400 hover:text-white">Iniciar Sesión</a>
                <ContactForm 
                  triggerText="Contacto"
                  triggerVariant="ghost"
                  className="text-gray-400 hover:text-white p-0 h-auto justify-start"
                />
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contacto</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  info@micaa.store
                </div>
                <div className="flex items-center">
                  <Globe className="w-4 h-4 mr-2" />
                  www.micaa.store
                </div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  Bolivia
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-6 text-center text-sm text-gray-400">
            <p>&copy; 2025 MICAA. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}