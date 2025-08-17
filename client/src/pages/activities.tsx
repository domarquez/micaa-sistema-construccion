import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Building2, Eye, ChevronLeft, ChevronRight, Copy, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ActivityDetailDialog from "@/components/activity-detail-dialog";
import { formatCurrency } from "@/lib/utils";
import { queryClient, getQueryFn, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { ActivityWithPhase, ActivityWithCustomData } from "@shared/schema";

interface ActivitiesResponse {
  activities: ActivityWithCustomData[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}

export default function Activities() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const [customizingActivity, setCustomizingActivity] = useState<ActivityWithCustomData | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: activitiesResponse, isLoading, refetch: refetchActivities } = useQuery<ActivitiesResponse>({
    queryKey: ["/api/activities", { 
      search: searchTerm, 
      phase: selectedPhase, 
      page: currentPage,
      limit: limit,
      withCompositions: true 
    }],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!user, // Solo hacer la query si hay usuario autenticado
  });

  const { data: phases } = useQuery({
    queryKey: ["/api/construction-phases"],
    queryFn: async () => {
      const response = await fetch("/api/construction-phases");
      if (!response.ok) throw new Error('Failed to fetch phases');
      return response.json();
    },
  });

  // Mutation para duplicar actividad
  const duplicateActivityMutation = useMutation({
    mutationFn: async (activityId: number) => {
      const response = await apiRequest('POST', `/api/activities/${activityId}/duplicate`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al duplicar actividad');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({
        title: "Actividad duplicada",
        description: "La actividad ha sido duplicada exitosamente. Ahora puedes personalizarla.",
      });
      refetchActivities();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message === "Activity already duplicated" 
          ? "Esta actividad ya fue duplicada anteriormente. Ve a 'Actividades Personalizadas' para editarla."
          : "No se pudo duplicar la actividad.",
        variant: "destructive",
      });
    },
  });

  const activities = activitiesResponse?.activities || [];
  const totalCount = activitiesResponse?.totalCount || 0;
  const totalPages = activitiesResponse?.totalPages || 0;

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handlePhaseChange = (value: string) => {
    setSelectedPhase(value === "all" ? "" : value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const groupedActivities = activities?.reduce((acc, activity) => {
    const phaseName = activity.phase.name;
    if (!acc[phaseName]) {
      acc[phaseName] = [];
    }
    acc[phaseName].push(activity);
    return acc;
  }, {} as Record<string, ActivityWithCustomData[]>);

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Actividades de Construcción con APU</h1>
          <p className="text-gray-600 mt-2">
            Actividades con análisis de precios unitarios para proyectos de construcción
            <br />
            <span className="text-sm">Solo puedes duplicar cada actividad una vez. Las actividades ya duplicadas muestran "✓ Ya Duplicada"</span>
          </p>
        </div>
        {user && (
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => window.location.href = '/custom-activities'}
          >
            <Settings className="h-4 w-4" />
            Mis Actividades Personalizadas
          </Button>
        )}
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar actividades, fases o descripciones..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedPhase} onValueChange={handlePhaseChange}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Filtrar por fase" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fases</SelectItem>
              {phases?.map((phase: any) => (
                <SelectItem key={phase.id} value={phase.id.toString()}>
                  {phase.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex justify-between items-center text-sm text-gray-600">
          <div>
            Mostrando {activities.length} de {totalCount} actividades
            {selectedPhase && (
              <span className="ml-2">
                - Filtrado por: {phases?.find((p: any) => p.id.toString() === selectedPhase)?.name}
              </span>
            )}
          </div>
          <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 por página</SelectItem>
              <SelectItem value="50">50 por página</SelectItem>
              <SelectItem value="100">100 por página</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-64" />
                        <Skeleton className="h-3 w-96" />
                      </div>
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedActivities && Object.entries(groupedActivities).map(([phaseName, phaseActivities]) => (
            <Card key={phaseName}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  {phaseName}
                  <Badge variant="secondary" className="ml-auto">
                    {phaseActivities.length} actividades
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {phaseActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className={`flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors ${
                        activity.hasCustomActivity && !activity.isOriginal ? 'bg-green-50 border-green-300 shadow-sm' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {activity.name
                            .replace(/^ANÁLISIS DE PRECIOS UNITARIOS \(APU\) DE:\s*/i, '')
                            .replace(/^APU DE:\s*/i, '')
                          }
                          {activity.hasCustomActivity && !activity.isOriginal && (
                            <span className="text-green-700 font-semibold text-sm ml-2 bg-green-100 px-2 py-1 rounded">(Personalizada)</span>
                          )}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <Badge variant="outline">
                            Unidad: {activity.unit}
                          </Badge>
                          {activity.unitPrice && parseFloat(activity.unitPrice) > 0 && (
                            <Badge variant="secondary">
                              {formatCurrency(parseFloat(activity.unitPrice))}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {/* Botón Duplicar - solo mostrar para actividades originales y si el usuario está autenticado */}
                        {user && activity.isOriginal !== false && !activity.hasCustomActivity && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateActivityMutation.mutate(activity.id)}
                            disabled={duplicateActivityMutation.isPending}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </Button>
                        )}
                        
                        {/* Mostrar "Ya Duplicada" si ya tiene actividad personalizada */}
                        {user && activity.hasCustomActivity && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled
                            className="opacity-60"
                          >
                            ✓ Ya Duplicada
                          </Button>
                        )}
                        
                        {/* Botón Ver APU */}
                        <ActivityDetailDialog
                          activityId={activity.id}
                          activityName={activity.name
                            .replace(/^ANÁLISIS DE PRECIOS UNITARIOS \(APU\) DE:\s*/i, '')
                            .replace(/^APU DE:\s*/i, '')
                          }
                          unitPrice={activity.unitPrice || "0"}
                        >
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            Ver APU
                          </Button>
                        </ActivityDetailDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {activities?.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No se encontraron actividades</h3>
                <p className="text-gray-600">
                  {searchTerm ? "Intenta con otros términos de búsqueda" : "No hay actividades registradas"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Página {currentPage} de {totalPages} ({totalCount} actividades total)
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            
            {/* Page numbers */}
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className="w-10"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {activities && (
        <div className="mt-4 text-center text-sm text-gray-500">
          {Object.keys(groupedActivities || {}).length} fases mostradas
        </div>
      )}
    </div>
  );
}