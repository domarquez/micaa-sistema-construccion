import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Package, 
  Calculator, 
  TrendingUp, 
  Combine, 
  Plus,
  BarChart3,
  Building2,
  Users,
  Truck,
  Activity,
  ArrowUpRight,
  Target,
  Clock,
  DollarSign
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';

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

export function EnhancedDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<Statistics>({
    queryKey: ["/api/statistics"],
  });

  const { data: growthData, isLoading: growthLoading } = useQuery<GrowthData[]>({
    queryKey: ["/api/growth-data"],
  });

  // Performance metrics
  const performanceMetrics = [
    {
      label: "Eficiencia del Sistema",
      value: 87,
      change: "+5%",
      trend: "up",
      color: "bg-green-500"
    },
    {
      label: "Presupuestos Completados",
      value: 92,
      change: "+8%", 
      trend: "up",
      color: "bg-blue-500"
    },
    {
      label: "Satisfacción del Usuario",
      value: 94,
      change: "+2%",
      trend: "up", 
      color: "bg-purple-500"
    }
  ];

  // Quick actions
  const quickActions = [
    {
      title: "Nuevo Presupuesto",
      description: "Crear presupuesto de proyecto",
      icon: Calculator,
      href: "/budgets/new",
      color: "text-blue-600"
    },
    {
      title: "Gestionar Materiales",
      description: "Administrar catálogo",
      icon: Package,
      href: "/materials",
      color: "text-green-600"
    },
    {
      title: "Ver Proveedores",
      description: "Directorio de empresas",
      icon: Truck,
      href: "/suppliers",
      color: "text-orange-600"
    },
    {
      title: "Configuraciones",
      description: "Ajustar parámetros",
      icon: Target,
      href: "/price-settings",
      color: "text-purple-600"
    }
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">Panel Principal</h1>
          <p className="text-sm sm:text-base text-gray-600 truncate mt-1">
            Sistema Integral de Cómputos y Presupuestos MICAA
          </p>
        </div>
        <Link href="/budgets/new" className="shrink-0">
          <Button className="flex items-center gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Presupuesto</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </Link>
      </div>

      {/* Main Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col items-center text-center">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 mb-2" />
              {statsLoading ? (
                <Skeleton className="h-5 sm:h-6 w-10 sm:w-12 mb-1" />
              ) : (
                <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                  {formatNumber(stats?.totalUsers || 0)}
                </p>
              )}
              <p className="text-xs sm:text-sm text-gray-600 truncate">Usuarios</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center">
              <Calculator className="w-6 h-6 text-green-600 mb-2" />
              {statsLoading ? (
                <Skeleton className="h-6 w-12 mb-1" />
              ) : (
                <p className="text-xl font-bold text-on-surface">
                  {formatNumber(stats?.activeBudgets || 0)}
                </p>
              )}
              <p className="text-sm text-gray-600">Presupuestos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center">
              <Building2 className="w-6 h-6 text-orange-600 mb-2" />
              {statsLoading ? (
                <Skeleton className="h-6 w-12 mb-1" />
              ) : (
                <p className="text-xl font-bold text-on-surface">
                  {formatNumber(stats?.totalProjects || 0)}
                </p>
              )}
              <p className="text-sm text-gray-600">Proyectos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center">
              <Truck className="w-6 h-6 text-purple-600 mb-2" />
              {statsLoading ? (
                <Skeleton className="h-6 w-12 mb-1" />
              ) : (
                <p className="text-xl font-bold text-on-surface">
                  {formatNumber(stats?.totalSuppliers || 0)}
                </p>
              )}
              <p className="text-sm text-gray-600">Proveedores</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center">
              <Package className="w-6 h-6 text-blue-600 mb-2" />
              {statsLoading ? (
                <Skeleton className="h-6 w-12 mb-1" />
              ) : (
                <p className="text-xl font-bold text-on-surface">
                  {formatNumber(stats?.totalMaterials || 0)}
                </p>
              )}
              <p className="text-sm text-gray-600">Materiales</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center">
              <Combine className="w-6 h-6 text-teal-600 mb-2" />
              {statsLoading ? (
                <Skeleton className="h-6 w-12 mb-1" />
              ) : (
                <p className="text-xl font-bold text-on-surface">
                  {formatNumber(stats?.totalActivities || 0)}
                </p>
              )}
              <p className="text-sm text-gray-600">Actividades</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center">
              <DollarSign className="w-6 h-6 text-yellow-600 mb-2" />
              {statsLoading ? (
                <Skeleton className="h-6 w-16 mb-1" />
              ) : (
                <p className="text-lg font-bold text-on-surface">
                  {formatCurrency(stats?.totalProjectValue || 0).replace(' Bs', '')}
                </p>
              )}
              <p className="text-sm text-gray-600">Valor Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {performanceMetrics.map((metric, index) => (
          <Card key={index} className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-700">{metric.label}</h3>
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <ArrowUpRight className="w-4 h-4" />
                  {metric.change}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{metric.value}%</span>
                  <Badge variant="secondary" className="text-xs">
                    Excelente
                  </Badge>
                </div>
                <Progress value={metric.value} className="h-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Crecimiento del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            {growthLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="users" 
                      stackId="1"
                      stroke="#3B82F6" 
                      fill="#3B82F6"
                      fillOpacity={0.6}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="projects" 
                      stackId="1"
                      stroke="#F97316" 
                      fill="#F97316"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {quickActions.map((action, index) => (
                <Link key={index} href={action.href}>
                  <Button
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow"
                  >
                    <action.icon className={`w-6 h-6 ${action.color}`} />
                    <div className="text-center">
                      <p className="font-medium text-sm">{action.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{action.description}</p>
                    </div>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}