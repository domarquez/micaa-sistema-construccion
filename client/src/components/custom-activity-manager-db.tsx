import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Edit3, 
  Save, 
  X, 
  Trash2, 
  Package, 
  Users, 
  Wrench,
  Settings
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CustomActivity {
  id: number;
  name: string;
  unit: string;
  description?: string;
  phaseId?: number;
  phaseName?: string;
  createdAt: string;
  updatedAt: string;
}

interface CustomActivityComposition {
  id: number;
  customActivityId: number;
  type: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  materialId?: number;
  laborId?: number;
  toolId?: number;
}

interface CustomActivityManagerDBProps {
  onEditActivity?: (activity: CustomActivity) => void;
}

export default function CustomActivityManagerDB({ onEditActivity }: CustomActivityManagerDBProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<CustomActivity | null>(null);
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityUnit, setNewActivityUnit] = useState("");
  const [newActivityDescription, setNewActivityDescription] = useState("");
  const [newActivityPhaseId, setNewActivityPhaseId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load custom activities from database
  const { data: customActivities, isLoading } = useQuery<CustomActivity[]>({
    queryKey: ['/api/custom-activities'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/custom-activities');
      return response.json();
    }
  });

  // Load construction phases for selection
  const { data: phases } = useQuery({
    queryKey: ['/api/construction-phases'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/construction-phases');
      return response.json();
    }
  });

  const createCustomActivity = useMutation({
    mutationFn: async (activityData: { name: string; unit: string; description?: string; phaseId?: number }) => {
      const response = await apiRequest('POST', '/api/custom-activities', activityData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Actividad creada",
        description: "Tu actividad personalizada se ha creado exitosamente",
      });
      setIsCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['/api/custom-activities'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la actividad personalizada",
        variant: "destructive",
      });
    },
  });

  const deleteCustomActivity = useMutation({
    mutationFn: async (activityId: number) => {
      const response = await apiRequest('DELETE', `/api/custom-activities/${activityId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Actividad eliminada",
        description: "La actividad personalizada se ha eliminado exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/custom-activities'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la actividad personalizada",
        variant: "destructive",
      });
    },
  });

  const handleCreateActivity = () => {
    if (!newActivityName.trim() || !newActivityUnit.trim()) {
      toast({
        title: "Error",
        description: "El nombre y la unidad son requeridos",
        variant: "destructive",
      });
      return;
    }

    createCustomActivity.mutate({
      name: newActivityName.trim(),
      unit: newActivityUnit.trim(),
      description: newActivityDescription.trim() || undefined,
      phaseId: newActivityPhaseId ? parseInt(newActivityPhaseId) : undefined
    });
  };

  const resetForm = () => {
    setNewActivityName("");
    setNewActivityUnit("");
    setNewActivityDescription("");
    setNewActivityPhaseId("");
  };

  const handleDeleteActivity = (activityId: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta actividad personalizada?")) {
      deleteCustomActivity.mutate(activityId);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando actividades personalizadas...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Actividades Personalizadas
          </CardTitle>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nueva Actividad
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Actividad Personalizada</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nombre *</label>
                  <Input
                    value={newActivityName}
                    onChange={(e) => setNewActivityName(e.target.value)}
                    placeholder="Ej: Piso Deck de Madera"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Unidad *</label>
                  <Input
                    value={newActivityUnit}
                    onChange={(e) => setNewActivityUnit(e.target.value)}
                    placeholder="Ej: m2, ml, pza"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Descripción</label>
                  <Textarea
                    value={newActivityDescription}
                    onChange={(e) => setNewActivityDescription(e.target.value)}
                    placeholder="Descripción detallada de la actividad..."
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Fase de Construcción</label>
                  <Select value={newActivityPhaseId} onValueChange={setNewActivityPhaseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar fase..." />
                    </SelectTrigger>
                    <SelectContent>
                      {phases?.map((phase: any) => (
                        <SelectItem key={phase.id} value={phase.id.toString()}>
                          {phase.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleCreateActivity}
                    disabled={createCustomActivity.isPending}
                    className="flex-1"
                  >
                    {createCustomActivity.isPending ? "Creando..." : "Crear Actividad"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={createCustomActivity.isPending}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {!customActivities || customActivities.length === 0 ? (
          <div className="text-center py-8">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes actividades personalizadas
            </h3>
            <p className="text-gray-600 mb-4">
              Crea tu primera actividad personalizada para tus proyectos específicos
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Crear Primera Actividad
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {customActivities.map((activity) => (
              <div key={activity.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900">{activity.name}</h3>
                      <Badge variant="outline">{activity.unit}</Badge>
                      {activity.phaseName && (
                        <Badge variant="secondary">{activity.phaseName}</Badge>
                      )}
                    </div>
                    {activity.description && (
                      <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Creada: {new Date(activity.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-1"
                      onClick={() => onEditActivity?.(activity)}
                    >
                      <Edit3 className="w-3 h-3" />
                      Editar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => handleDeleteActivity(activity.id)}
                      disabled={deleteCustomActivity.isPending}
                      className="gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}