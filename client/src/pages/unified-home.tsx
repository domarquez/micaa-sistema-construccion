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
import { CompanyAdvertisementCarousel } from "@/components/advertising/CompanyAdvertisementCarousel";
import AdInFeed from "@/components/ads/AdInFeed";
import AdFooter from "@/components/ads/AdFooter";
import AdMobile from "@/components/ads/AdMobile";
import CompanyAdMobile from "@/components/ads/CompanyAdMobile";
import CompanyAdInFeed from "@/components/ads/CompanyAdInFeed";
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

        {/* Hero Section - Mobile Optimized */}
        <div className="bg-gradient-to-r from-blue-600 to-orange-500 text-white py-2 sm:py-4 md:py-6 lg:py-8 mobile-padding overflow-hidden">
          <div className="max-w-7xl mx-auto text-left sm:text-center">
            <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold mb-1 sm:mb-2 md:mb-3 break-words leading-tight text-left sm:text-center">
              MICAA - Sistema de Construcción
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl mb-1.5 sm:mb-2 md:mb-3 opacity-90 break-words leading-tight text-left sm:text-center">
              Presupuestos inteligentes para la construcción boliviana
            </p>
            <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2 justify-start sm:justify-center items-stretch max-w-full">
              <Link href="/login" className="w-full sm:w-auto">
                <Button 
                  size="sm" 
                  className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-100 text-sm sm:text-base md:text-lg px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-3"
                >
                  Iniciar Sesión
                </Button>
              </Link>
              <Link href="/register" className="w-full sm:w-auto">
                <Button 
                  size="sm" 
                  className="w-full sm:w-auto bg-orange-600 text-white border-orange-600 hover:bg-orange-700 hover:border-orange-700 text-sm sm:text-base md:text-lg px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-3"
                >
                  Registrarse Gratis
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Anonymous Usage Warning - Mobile Optimized */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-1 sm:p-1.5 md:p-2 mobile-padding mb-1 sm:mb-2 md:mb-3 max-w-full overflow-hidden">
          <div className="flex items-start gap-1 sm:gap-1.5 md:gap-2">
            <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm sm:text-base md:text-lg min-w-0 flex-1">
              <p className="text-yellow-800 font-medium break-words leading-tight text-left">Modo de Vista Pública</p>
              <p className="text-yellow-700 mt-0.5 break-words leading-tight text-left">
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
              <div className="flex flex-col items-start text-left min-w-0 w-full">
                <Users className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-primary mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-foreground break-words leading-none">
                    {formatNumber(statistics?.totalUsers || 0)}
                  </p>
                )}
                <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground font-medium break-words leading-tight">Usuarios</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer min-w-0 max-w-full" onClick={() => window.location.href = "/login?redirect=budgets"}>
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-start text-left min-w-0 w-full">
                <Calculator className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-green-600 mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-foreground break-words leading-none">
                    {formatNumber(statistics?.activeBudgets || 0)}
                  </p>
                )}
                <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground font-medium break-words leading-tight">Presupuestos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow min-w-0 max-w-full">
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-start text-left min-w-0 w-full">
                <Package className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-blue-600 mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-foreground break-words leading-none">
                    {formatNumber(statistics?.totalMaterials || 0)}
                  </p>
                )}
                <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground font-medium break-words leading-tight">Materiales</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow min-w-0 max-w-full">
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-start text-left min-w-0 w-full">
                <Combine className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-purple-600 mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-foreground break-words leading-none">
                    {formatNumber(statistics?.totalActivities || 0)}
                  </p>
                )}
                <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground font-medium break-words leading-tight">Actividades</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow min-w-0 max-w-full">
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-start text-left min-w-0 w-full">
                <Building2 className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-orange-600 mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-foreground break-words leading-none">
                    {formatNumber(statistics?.totalProjects || 0)}
                  </p>
                )}
                <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground font-medium break-words leading-tight">Proyectos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow min-w-0 max-w-full">
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-start text-left min-w-0 w-full">
                <Truck className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-red-600 mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-foreground break-words leading-none">
                    {formatNumber(statistics?.totalSuppliers || 0)}
                  </p>
                )}
                <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground font-medium break-words leading-tight">Proveedores</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow min-w-0 max-w-full">
            <CardContent className="p-0.5 sm:p-1 md:p-2 lg:p-3 mobile-ultra-compact min-w-0">
              <div className="flex flex-col items-start text-left min-w-0 w-full">
                <TrendingUp className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-green-500 mb-0.5 flex-shrink-0" />
                {statsLoading ? (
                  <Skeleton className="h-2 sm:h-3 md:h-4 w-3 sm:w-4 md:w-6 mb-0.5" />
                ) : (
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-foreground break-words leading-none">
                    {formatCurrency(statistics?.totalProjectValue || 0)}
                  </p>
                )}
                <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground font-medium break-words leading-tight">Valor Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Company Advertisements Carousel */}
        <CompanyAdvertisementCarousel />

        {/* AdInFeed */}
        <div className="mobile-padding mb-6 sm:mb-8">
          <AdInFeed />
        </div>

        {/* Materials and Suppliers Tabs - Mobile Optimized */}
        <div className="mobile-padding mb-2 sm:mb-3 md:mb-4">
          <Card className="shadow-lg max-w-full overflow-hidden">
            <CardHeader className="p-1 sm:p-2 md:p-3">
              <div className="flex flex-col gap-1 sm:gap-2">
                <CardTitle className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-foreground break-words text-left">
                  Explorar Materiales y Proveedores
                </CardTitle>
                <div className="flex bg-muted p-0.5 sm:p-1 rounded-lg w-full gap-0.5">
                  <Button
                    variant={activeTab === "materials" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("materials")}
                    className="text-sm sm:text-base md:text-lg flex-1 min-w-0 px-2 sm:px-3 py-2 sm:py-3"
                  >
                    <Package className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-1 sm:mr-2 flex-shrink-0" />
                    <span className="truncate">Materiales</span>
                  </Button>
                  <Button
                    variant={activeTab === "suppliers" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("suppliers")}
                    className="text-sm sm:text-base md:text-lg flex-1 min-w-0 px-2 sm:px-3 py-2 sm:py-3"
                  >
                    <Store className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-1 sm:mr-2 flex-shrink-0" />
                    <span className="truncate">Proveedores</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-1 sm:p-2 md:p-3 overflow-hidden">
              {activeTab === "materials" && (
                <div className="space-y-2 sm:space-y-3">
                  {/* Search and filters - Mobile Optimized */}
                  <div className="flex flex-col gap-1 sm:gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 absolute left-1.5 sm:left-2 md:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar materiales..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 sm:pl-9 md:pl-10 text-sm sm:text-base md:text-lg"
                      />
                    </div>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 md:py-3 border border-border rounded-md bg-background text-sm sm:text-base md:text-lg"
                    >
                      <option value="all">Todas las categorías</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id.toString()}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Materials table - Mobile Optimized */}
                  <div className="overflow-x-auto max-w-full">
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[9px] sm:text-[10px] md:text-xs text-left p-1 sm:p-2">Material</TableHead>
                          <TableHead className="text-[9px] sm:text-[10px] md:text-xs text-left p-1 sm:p-2">Unidad</TableHead>
                          <TableHead className="text-[9px] sm:text-[10px] md:text-xs text-right p-1 sm:p-2">Precio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materialsLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell className="p-1 sm:p-2"><Skeleton className="h-3 sm:h-4 w-16 sm:w-24 md:w-32" /></TableCell>
                              <TableCell className="p-1 sm:p-2"><Skeleton className="h-3 sm:h-4 w-8 sm:w-12 md:w-16" /></TableCell>
                              <TableCell className="p-1 sm:p-2"><Skeleton className="h-3 sm:h-4 w-10 sm:w-16 md:w-20" /></TableCell>
                            </TableRow>
                          ))
                        ) : (
                          filteredMaterials.map((material) => (
                            <TableRow key={material.id} className="hover:bg-muted/50">
                              <TableCell className="text-[9px] sm:text-[10px] md:text-xs font-medium text-left p-1 sm:p-2 break-words">
                                {material.name}
                              </TableCell>
                              <TableCell className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground text-left p-1 sm:p-2">
                                {material.unit}
                              </TableCell>
                              <TableCell className="text-[9px] sm:text-[10px] md:text-xs text-right font-semibold p-1 sm:p-2">
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
                <div className="space-y-2 sm:space-y-3">
                  <div className="grid gap-1 sm:gap-2">
                    {suppliers.slice(0, 6).map((supplier) => (
                      <Card key={supplier.id} className="border hover:shadow-md transition-shadow max-w-full overflow-hidden">
                        <CardContent className="p-1.5 sm:p-2 md:p-3">
                          <div className="flex flex-col gap-1 sm:gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0 text-left">
                                <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold text-foreground truncate text-left">
                                  {supplier.companyName}
                                </h3>
                              </div>
                              <div className="flex flex-wrap items-center gap-0.5 sm:gap-1 flex-shrink-0">
                                {(supplier as any).isPremium && (
                                  <Badge variant="secondary" className="text-[8px] sm:text-[9px] px-1 py-0 h-4 sm:h-5">
                                    <Crown className="w-2 h-2 sm:w-2.5 sm:h-2.5 mr-0.5" />
                                    Premium
                                  </Badge>
                                )}
                                <Badge 
                                  variant={supplier.isActive ? "default" : "secondary"}
                                  className="text-[8px] sm:text-[9px] px-1 py-0 h-4 sm:h-5"
                                >
                                  {supplier.isActive ? "Activo" : "Inactivo"}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-start gap-1 sm:gap-1.5 text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground">
                              {supplier.city && (
                                <div className="flex items-center gap-0.5 text-left">
                                  <MapPin className="w-2 h-2 sm:w-2.5 sm:h-2.5 flex-shrink-0" />
                                  <span className="break-words">{supplier.city}</span>
                                </div>
                              )}
                              {supplier.phone && (
                                <div className="flex items-center gap-0.5 text-left">
                                  <Phone className="w-2 h-2 sm:w-2.5 sm:h-2.5 flex-shrink-0" />
                                  <span className="break-words">{supplier.phone}</span>
                                </div>
                              )}
                              {supplier.website && (
                                <div className="flex items-center gap-0.5 text-left">
                                  <Globe className="w-2 h-2 sm:w-2.5 sm:h-2.5 flex-shrink-0" />
                                  <span className="truncate max-w-20 sm:max-w-24">{supplier.website}</span>
                                </div>
                              )}
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
          <CardContent className="p-2 sm:p-4 md:p-6 pt-0 min-w-0 text-left">
            <div className="text-sm sm:text-lg md:text-2xl font-bold leading-none text-left">
              {budgetsLoading ? <Skeleton className="h-4 sm:h-6 md:h-8 w-8 sm:w-12 md:w-16" /> : budgets?.length || 0}
            </div>
            <p className="text-[8px] sm:text-[10px] md:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight text-left">
              Presupuestos activos
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0 max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-2 sm:p-4 md:p-6">
            <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium truncate text-left">Materiales</CardTitle>
            <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6 pt-0 min-w-0 text-left">
            <div className="text-sm sm:text-lg md:text-2xl font-bold leading-none text-left">
              {statsLoading ? <Skeleton className="h-4 sm:h-6 md:h-8 w-8 sm:w-12 md:w-16" /> : formatNumber(statistics?.totalMaterials || 0)}
            </div>
            <p className="text-[8px] sm:text-[10px] md:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight text-left">
              En catálogo
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0 max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-2 sm:p-4 md:p-6">
            <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium truncate text-left">Actividades</CardTitle>
            <Combine className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6 pt-0 min-w-0 text-left">
            <div className="text-sm sm:text-lg md:text-2xl font-bold leading-none text-left">
              {statsLoading ? <Skeleton className="h-4 sm:h-6 md:h-8 w-8 sm:w-12 md:w-16" /> : formatNumber(statistics?.totalActivities || 0)}
            </div>
            <p className="text-[8px] sm:text-[10px] md:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight text-left">
              Disponibles
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0 max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-2 sm:p-4 md:p-6">
            <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium truncate text-left">Proveedores</CardTitle>
            <Truck className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-2 sm:p-4 md:p-6 pt-0 min-w-0 text-left">
            <div className="text-sm sm:text-lg md:text-2xl font-bold leading-none text-left">
              {statsLoading ? <Skeleton className="h-4 sm:h-6 md:h-8 w-8 sm:w-12 md:w-16" /> : formatNumber(statistics?.totalSuppliers || 0)}
            </div>
            <p className="text-[8px] sm:text-[10px] md:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight text-left">
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
                  <div key={budget.id} className="flex items-start justify-between p-2 sm:p-3 border rounded hover:bg-muted/50 transition-colors gap-2">
                    <div className="flex-1 min-w-0 text-left">
                      <h3 className="font-medium truncate text-left text-xs sm:text-sm">{budget.project?.name || `Presupuesto ${budget.id}`}</h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground text-left">
                        {formatRelativeTime(budget.updatedAt || budget.createdAt || new Date())}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="font-semibold text-[10px] sm:text-xs text-right">{formatCurrency((budget as any).totalCost || 0)}</span>
                      <div className="flex gap-0.5 sm:gap-1">
                        <Link href={`/budgets/${budget.id}`}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-1">
                            <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </Button>
                        </Link>
                        <Link href={`/budgets/${budget.id}?edit=true`}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-1">
                            <Edit className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
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