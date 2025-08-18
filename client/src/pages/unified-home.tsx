import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { AdCarousel } from "@/components/advertising/ad-carousel";
import { ConstructionNewsTicker } from "@/components/news/construction-news-ticker";
import AdInFeed from "@/components/ads/AdInFeed";
import AdFooter from "@/components/ads/AdFooter";
import AdMobile from "@/components/ads/AdMobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search, 
  Package,
  Store,
  MapPin,
  Phone,
  Globe,
  Users,
  Building2,
  Calculator,
  Truck,
  TrendingUp,
  Combine,
  BarChart3,
  Plus,
  Edit,
  Eye,
  Crown,
  AlertCircle
} from "lucide-react";
import { formatCurrency, formatNumber, formatRelativeTime } from "@/lib/utils";
import type { Material, MaterialCategory, SupplierCompany, AdvertisementWithSupplier, BudgetWithProject } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Statistics {
  totalMaterials: number;
  totalActivities: number;
  activeBudgets: number;
  totalProjectValue: number;
  totalUsers: number;
  totalSuppliers: number;
  totalProjects: number;
}

interface GrowthData {
  month: string;
  users: number;
  projects: number;
  budgets: number;
  suppliers: number;
}

export default function UnifiedHome() {
  const { user, isAnonymous } = useAuth();
  const [activeTab, setActiveTab] = useState<"materials" | "suppliers">("materials");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Statistics - always load real data
  const { data: statistics, isLoading: statsLoading } = useQuery<Statistics>({
    queryKey: ["/api/statistics"],
    staleTime: 5 * 60 * 1000,
  });

  // Growth data for charts
  const { data: growthData, isLoading: growthLoading } = useQuery<GrowthData[]>({
    queryKey: ["/api/growth-data"],
    staleTime: 5 * 60 * 1000,
  });

  // User budgets (only for authenticated users)
  const { data: budgets, isLoading: budgetsLoading } = useQuery<BudgetWithProject[]>({
    queryKey: ["/api/budgets"],
    enabled: !isAnonymous,
    staleTime: 30 * 1000,
  });

  // Public materials and suppliers
  const { data: materials = [], isLoading: materialsLoading } = useQuery<Material[]>({
    queryKey: ["/api/public/materials", { search: searchQuery, category: selectedCategory }],
    staleTime: 2 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery<MaterialCategory[]>({
    queryKey: ["/api/public/material-categories"],
    staleTime: 10 * 60 * 1000,
  });

  const { data: suppliers = [] } = useQuery<SupplierCompany[]>({
    queryKey: ["/api/public/suppliers"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: advertisements = [] } = useQuery<AdvertisementWithSupplier[]>({
    queryKey: ["/api/public/dual-advertisements"],
    staleTime: 10 * 60 * 1000,
  });

  // Filter materials
  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || material.categoryId.toString() === selectedCategory;
    return matchesSearch && matchesCategory;
  }).slice(0, 20);

  if (isAnonymous) {
    // PUBLIC VIEW - Optimized for anonymous users
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Mobile Ad Banner */}
        <div className="block sm:hidden mb-4">
          <AdMobile />
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-600 to-orange-500 text-white py-4 sm:py-6 md:py-8 lg:py-12 xl:py-16 mobile-padding">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold mb-2 sm:mb-3 md:mb-4 break-words leading-tight mobile-text-sm">
              MICAA - Sistema de Construcción
            </h1>
            <p className="text-xs sm:text-sm md:text-base lg:text-lg mb-2 sm:mb-3 md:mb-4 opacity-90 break-words leading-tight mobile-text-xs">
              Presupuestos inteligentes para la construcción boliviana
            </p>
            <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2 md:gap-3 justify-center items-stretch sm:items-center max-w-xs sm:max-w-md md:max-w-none mx-auto">
              <Link href="/login" className="flex-1 sm:flex-none">
                <Button 
                  size="sm" 
                  className="w-full bg-white text-blue-600 hover:bg-gray-100 text-xs sm:text-sm md:text-base px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-3 mobile-ultra-compact"
                >
                  Iniciar Sesión
                </Button>
              </Link>
              <Link href="/register" className="flex-1 sm:flex-none">
                <Button 
                  size="sm" 
                  className="w-full bg-orange-600 text-white border-orange-600 hover:bg-orange-700 hover:border-orange-700 text-xs sm:text-sm md:text-base px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-3 mobile-ultra-compact"
                >
                  Registrarse Gratis
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Anonymous Usage Warning */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-1.5 sm:p-2 md:p-3 mobile-padding mb-2 sm:mb-3 md:mb-4">
          <div className="flex items-start">
            <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-yellow-600 mr-1.5 sm:mr-2 md:mr-3 flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm min-w-0 flex-1">
              <p className="text-yellow-800 font-medium break-words mobile-text-xs">Modo de Vista Pública</p>
              <p className="text-yellow-700 mt-0.5 sm:mt-1 break-words leading-tight mobile-text-xs">
                Puedes explorar materiales y precios. Para crear presupuestos, 
                <Link href="/login" className="underline font-medium ml-1">inicia sesión</Link> o 
                <Link href="/register" className="underline font-medium ml-1">regístrate gratis</Link>.
              </p>
            </div>
          </div>
        </div>

        {/* Advertisement Carousel */}
        <div className="mobile-padding mb-2 sm:mb-3 md:mb-4">
          <AdCarousel />
        </div>

        {/* Construction News Ticker */}
        <div className="mobile-padding mb-2 sm:mb-3 md:mb-4">
          <ConstructionNewsTicker />
        </div>

        {/* Statistics Grid - Ultra Mobile Optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-0.5 sm:gap-1 md:gap-1.5 lg:gap-2 xl:gap-3 mobile-padding mb-2 sm:mb-3 md:mb-4 lg:mb-6 overflow-hidden">
          <Card className="shadow-sm hover:shadow-md transition-shadow min-w-0 max-w-full">
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-center text-center min-w-0">
                <Users className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-primary mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-bold text-foreground break-words mobile-text-xs leading-none">
                    {formatNumber(statistics?.totalUsers || 0)}
                  </p>
                )}
                <p className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs text-muted-foreground font-medium break-words mobile-text-xs leading-tight">Usuarios</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer min-w-0 max-w-full" onClick={() => window.location.href = "/login?redirect=budgets"}>
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-center text-center min-w-0">
                <Calculator className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-green-600 mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-bold text-foreground break-words mobile-text-xs leading-none">
                    {formatNumber(statistics?.activeBudgets || 0)}
                  </p>
                )}
                <p className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs text-muted-foreground font-medium break-words mobile-text-xs leading-tight">Presupuestos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow min-w-0 max-w-full">
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-center text-center min-w-0">
                <Package className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-blue-600 mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-bold text-foreground break-words mobile-text-xs leading-none">
                    {formatNumber(statistics?.totalMaterials || 0)}
                  </p>
                )}
                <p className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs text-muted-foreground font-medium break-words mobile-text-xs leading-tight">Materiales</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow min-w-0 max-w-full">
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-center text-center min-w-0">
                <Combine className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-purple-600 mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-bold text-foreground break-words mobile-text-xs leading-none">
                    {formatNumber(statistics?.totalActivities || 0)}
                  </p>
                )}
                <p className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs text-muted-foreground font-medium break-words mobile-text-xs leading-tight">Actividades</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow min-w-0 max-w-full">
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-center text-center min-w-0">
                <Building2 className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-orange-600 mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-bold text-foreground break-words mobile-text-xs leading-none">
                    {formatNumber(statistics?.totalProjects || 0)}
                  </p>
                )}
                <p className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs text-muted-foreground font-medium break-words mobile-text-xs leading-tight">Proyectos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow min-w-0 max-w-full">
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-center text-center min-w-0">
                <Truck className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-red-600 mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-bold text-foreground break-words mobile-text-xs leading-none">
                    {formatNumber(statistics?.totalSuppliers || 0)}
                  </p>
                )}
                <p className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs text-muted-foreground font-medium break-words mobile-text-xs leading-tight">Proveedores</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow min-w-0 max-w-full">
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-center text-center min-w-0">
                <TrendingUp className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-green-500 mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-bold text-foreground break-words mobile-text-xs leading-none">
                    {formatCurrency(statistics?.totalProjectValue || 0)}
                  </p>
                )}
                <p className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs text-muted-foreground font-medium break-words mobile-text-xs leading-tight">Valor Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AdInFeed */}
        <div className="mobile-padding mb-6 sm:mb-8">
          <AdInFeed />
        </div>

        {/* Materials and Suppliers Tabs */}
        <div className="mobile-padding mb-4 sm:mb-6 md:mb-8">
          <Card className="shadow-lg max-w-full overflow-hidden">
            <CardHeader className="pb-2 sm:pb-3">
              <div className="flex flex-col gap-2 sm:gap-3">
                <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-foreground break-words">
                  Explorar Materiales y Proveedores
                </CardTitle>
                <div className="flex bg-muted p-1 rounded-lg w-full">
                  <Button
                    variant={activeTab === "materials" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("materials")}
                    className="text-xs sm:text-sm flex-1 min-w-0"
                  >
                    <Package className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                    <span className="truncate">Materiales</span>
                  </Button>
                  <Button
                    variant={activeTab === "suppliers" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("suppliers")}
                    className="text-xs sm:text-sm flex-1 min-w-0"
                  >
                    <Store className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                    <span className="truncate">Proveedores</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === "materials" && (
                <div className="space-y-4">
                  {/* Search and filters */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar materiales..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 text-sm"
                      />
                    </div>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 border border-border rounded-md bg-background text-sm"
                    >
                      <option value="all">Todas las categorías</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id.toString()}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Materials table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm">Material</TableHead>
                          <TableHead className="text-xs sm:text-sm">Unidad</TableHead>
                          <TableHead className="text-xs sm:text-sm text-right">Precio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materialsLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            </TableRow>
                          ))
                        ) : (
                          filteredMaterials.map((material) => (
                            <TableRow key={material.id} className="hover:bg-muted/50">
                              <TableCell className="text-xs sm:text-sm font-medium">
                                {material.name}
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm text-muted-foreground">
                                {material.unit}
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm text-right font-semibold">
                                {formatCurrency(parseFloat(material.price))}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {activeTab === "suppliers" && (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    {suppliers.slice(0, 6).map((supplier) => (
                      <Card key={supplier.id} className="border hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm sm:text-base font-semibold text-foreground truncate">
                                {supplier.companyName}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs sm:text-sm text-muted-foreground">
                                {supplier.city && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    <span>{supplier.city}</span>
                                  </div>
                                )}
                                {supplier.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    <span>{supplier.phone}</span>
                                  </div>
                                )}
                                {supplier.website && (
                                  <div className="flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    <span className="truncate max-w-32">{supplier.website}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {(supplier as any).isPremium && (
                                <Badge variant="secondary" className="text-xs">
                                  <Crown className="w-3 h-3 mr-1" />
                                  Premium
                                </Badge>
                              )}
                              <Badge 
                                variant={supplier.isActive ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {supplier.isActive ? "Activo" : "Inactivo"}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AdFooter */}
        <div className="mobile-padding">
          <AdFooter />
        </div>
      </div>
    );
  }

  // AUTHENTICATED USER VIEW - Dashboard with real data
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            ¡Bienvenido, {user?.username || user?.email}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Panel de control del sistema MICAA
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/budgets/new">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Presupuesto
            </Button>
          </Link>
        </div>
      </div>

      {/* Statistics Cards - Mobile Optimized */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 sm:gap-2 md:gap-3 lg:gap-4 mobile-padding overflow-hidden">
        <Card className="min-w-0 max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-2 sm:p-4 md:p-6">
            <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium truncate">Mis Presupuestos</CardTitle>
            <Calculator className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6 pt-0 min-w-0">
            <div className="text-sm sm:text-lg md:text-2xl font-bold leading-none">
              {budgetsLoading ? <Skeleton className="h-4 sm:h-6 md:h-8 w-8 sm:w-12 md:w-16" /> : budgets?.length || 0}
            </div>
            <p className="text-[8px] sm:text-[10px] md:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight">
              Presupuestos activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Materiales</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : formatNumber(statistics?.totalMaterials || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              En catálogo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actividades</CardTitle>
            <Combine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : formatNumber(statistics?.totalActivities || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Disponibles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : formatNumber(statistics?.totalSuppliers || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Registrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Chart - Mobile Optimized */}
      {!growthLoading && growthData && growthData.length > 0 && (
        <Card className="mobile-padding max-w-full overflow-hidden">
          <CardHeader className="p-2 sm:p-4 md:p-6">
            <CardTitle className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base md:text-lg">
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              <span className="truncate">Crecimiento de la Plataforma</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6 overflow-hidden">
            <div className="h-48 sm:h-64 md:h-80 w-full max-w-full overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={growthData}
                  margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    width={30}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      fontSize: '12px',
                      padding: '8px',
                      maxWidth: '200px'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '10px' }}
                    iconSize={8}
                  />
                  <Line type="monotone" dataKey="users" stroke="#8884d8" strokeWidth={1.5} name="Usuarios" />
                  <Line type="monotone" dataKey="projects" stroke="#82ca9d" strokeWidth={1.5} name="Proyectos" />
                  <Line type="monotone" dataKey="budgets" stroke="#ffc658" strokeWidth={1.5} name="Presupuestos" />
                  <Line type="monotone" dataKey="suppliers" stroke="#ff7300" strokeWidth={1.5} name="Proveedores" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Budgets - Mobile Optimized */}
      {!isAnonymous && (
        <Card className="mobile-padding max-w-full overflow-hidden">
          <CardHeader className="p-2 sm:p-4 md:p-6">
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 sm:gap-2 min-w-0">
                <Calculator className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 flex-shrink-0" />
                <span className="text-sm sm:text-base md:text-lg truncate">Presupuestos Recientes</span>
              </span>
              <Link href="/budgets">
                <Button variant="outline" size="sm" className="text-[10px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 h-6 sm:h-7 md:h-8">
                  <span className="hidden sm:inline">Ver Todos</span>
                  <span className="sm:hidden">Ver</span>
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6 overflow-hidden">
            {budgetsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : budgets && budgets.length > 0 ? (
              <div className="space-y-3">
                {budgets.slice(0, 5).map((budget) => (
                  <div key={budget.id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{budget.project?.name || `Presupuesto ${budget.id}`}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatRelativeTime(budget.updatedAt || budget.createdAt || new Date())}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatCurrency((budget as any).totalCost || 0)}</span>
                      <div className="flex gap-1">
                        <Link href={`/budgets/${budget.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/budgets/${budget.id}?edit=true`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calculator className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No tienes presupuestos aún</h3>
                <p className="text-muted-foreground mb-4">
                  Crea tu primer presupuesto para comenzar a gestionar tus proyectos.
                </p>
                <Link href="/budgets/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Presupuesto
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AdInFeed for authenticated users */}
      <AdInFeed />

      {/* AdFooter */}
      <AdFooter />
    </div>
  );
}