import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectTimeline } from "@/components/project-timeline";
import { BudgetAnalyzer } from "@/components/budget-analyzer";
import { AdvancedMaterialsTable } from "@/components/advanced-materials-table";
import {
  Building2,
  Calendar,
  Calculator,
  Package,
  FileText,
  Users,
  Settings,
  BarChart3
} from "lucide-react";

export default function ProjectDashboard() {
  const [activeProject, setActiveProject] = useState("1");

  const { data: projects } = useQuery({
    queryKey: ["/api/projects"],
  });

  const currentProject = {
    id: "1",
    name: "Edificio Residencial Santa Cruz",
    client: "Inmobiliaria del Este S.A.",
    location: "Santa Cruz de la Sierra",
    status: "in-progress",
    startDate: "2025-01-01",
    endDate: "2025-06-15",
    progress: 32,
    budget: 700000,
    spent: 225200
  };

  return (
    <div className="p-6 space-y-6">
      {/* Project Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-on-surface flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            {currentProject.name}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <span>Cliente: {currentProject.client}</span>
            <span>•</span>
            <span>Ubicación: {currentProject.location}</span>
            <span>•</span>
            <span>Progreso: {currentProject.progress}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            Generar Reporte
          </Button>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Configuración
          </Button>
        </div>
      </div>

      {/* Project Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Presupuesto Total</p>
                <p className="text-2xl font-bold">Bs 700.000</p>
                <p className="text-blue-100 text-xs mt-1">100% del proyecto</p>
              </div>
              <Calculator className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Ejecutado</p>
                <p className="text-2xl font-bold">Bs 225.200</p>
                <p className="text-green-100 text-xs mt-1">32% completado</p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Días Restantes</p>
                <p className="text-2xl font-bold">127</p>
                <p className="text-orange-100 text-xs mt-1">de 165 días total</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Equipo</p>
                <p className="text-2xl font-bold">24</p>
                <p className="text-purple-100 text-xs mt-1">personas activas</p>
              </div>
              <Users className="w-8 h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="timeline" className="w-full">
            <div className="border-b">
              <TabsList className="grid w-full grid-cols-4 h-12 bg-transparent">
                <TabsTrigger 
                  value="timeline" 
                  className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <Calendar className="w-4 h-4" />
                  Cronograma
                </TabsTrigger>
                <TabsTrigger 
                  value="budget" 
                  className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <Calculator className="w-4 h-4" />
                  Análisis Presupuestario
                </TabsTrigger>
                <TabsTrigger 
                  value="materials" 
                  className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <Package className="w-4 h-4" />
                  Materiales
                </TabsTrigger>
                <TabsTrigger 
                  value="reports" 
                  className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <FileText className="w-4 h-4" />
                  Reportes
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6">
              <TabsContent value="timeline" className="mt-0">
                <ProjectTimeline />
              </TabsContent>

              <TabsContent value="budget" className="mt-0">
                <BudgetAnalyzer />
              </TabsContent>

              <TabsContent value="materials" className="mt-0">
                <AdvancedMaterialsTable />
              </TabsContent>

              <TabsContent value="reports" className="mt-0">
                <div className="space-y-6">
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Módulo de Reportes
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      Genere reportes detallados de progreso, costos y análisis del proyecto.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                      <Button variant="outline" className="h-auto p-4 flex flex-col gap-2">
                        <BarChart3 className="w-6 h-6" />
                        <span className="font-medium">Reporte de Progreso</span>
                        <span className="text-xs text-gray-500">Estado actual del proyecto</span>
                      </Button>
                      <Button variant="outline" className="h-auto p-4 flex flex-col gap-2">
                        <Calculator className="w-6 h-6" />
                        <span className="font-medium">Análisis Financiero</span>
                        <span className="text-xs text-gray-500">Costos y presupuestos</span>
                      </Button>
                      <Button variant="outline" className="h-auto p-4 flex flex-col gap-2">
                        <Calendar className="w-6 h-6" />
                        <span className="font-medium">Cronograma</span>
                        <span className="text-xs text-gray-500">Planificación temporal</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}