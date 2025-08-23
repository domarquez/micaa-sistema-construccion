import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Building, FileText } from "lucide-react";

import type { Project, ConstructionPhase, ActivityWithPhase, BudgetWithProject } from "@shared/schema";
import { AnonymousBudgetWarning } from "@/components/anonymous-budget-warning";
import { useAuth } from "@/hooks/useAuth";

const projectFormSchema = z.object({
  name: z.string().min(1, "El nombre del proyecto es requerido"),
  client: z.string().optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default("Bolivia"),
  startDate: z.string().optional(),
  equipmentPercentage: z.string().default("5.00"),
  administrativePercentage: z.string().default("8.00"),
  utilityPercentage: z.string().default("15.00"),
  taxPercentage: z.string().default("3.09"),
  socialChargesPercentage: z.string().default("71.18"),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

interface BudgetItemData {
  id: string;
  activityId: number;
  activity?: ActivityWithPhase;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface PhaseData {
  phaseId: number;
  phase?: ConstructionPhase;
  items: BudgetItemData[];
  total: number;
}

const cityFactors: Record<string, number> = {
  "La Paz": 1.175,
  "Santa Cruz": 1.0,
  "Cochabamba": 0.955,
  "Potosí": 1.2425,
  "Oruro": 1.1,
  "Sucre": 1.05,
  "Tarija": 0.98,
  "Trinidad": 1.08,
  "Cobija": 1.15,
};

const applyGeographicFactor = (basePrice: number, city: string | null | undefined): number => {
  const factor = cityFactors[city || 'Santa Cruz'] || 1.0;
  return basePrice * factor;
};

interface MultiphaseBudgetFormProps {
  budget?: BudgetWithProject | null;
  onClose: () => void;
}

export default function MultiphaseBudgetForm({ budget, onClose }: MultiphaseBudgetFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAnonymous } = useAuth();
  const [currentProject, setCurrentProject] = useState<Project | null>(budget?.project || null);
  const [phases, setPhases] = useState<PhaseData[]>([]);
  const [selectedPhases, setSelectedPhases] = useState<number[]>([]);

  const isEditing = !!budget;

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: budget?.project.name || "",
      client: budget?.project.client || "",
      location: budget?.project.location || "",
      city: budget?.project.city || "",
      country: budget?.project.country || "Bolivia",
      startDate: budget?.project.startDate 
        ? new Date(budget.project.startDate).toISOString().split('T')[0]
        : "",
      equipmentPercentage: budget?.project.equipmentPercentage?.toString() || "5.00",
      administrativePercentage: budget?.project.administrativePercentage?.toString() || "8.00",
      utilityPercentage: budget?.project.utilityPercentage?.toString() || "15.00",
      taxPercentage: budget?.project.taxPercentage?.toString() || "3.09",
      socialChargesPercentage: budget?.project.socialChargesPercentage?.toString() || "71.18",
    },
  });

  const { data: constructionPhases } = useQuery<ConstructionPhase[]>({
    queryKey: ["/api/construction-phases"],
  });

  const { data: activitiesResponse } = useQuery<{activities: ActivityWithPhase[]}>({
    queryKey: ["/api/activities"],
  });
  
  const allActivities = activitiesResponse?.activities || [];

  // Cargar elementos del presupuesto si estamos editando  
  const { data: budgetData } = useQuery({
    queryKey: [`/api/budgets/${budget?.id}`],
    enabled: !!budget?.id,
  });

  // Cargar datos existentes al editar
  useEffect(() => {
    console.log('🔍 Cargando datos para edición:', { 
      budget: !!budget, 
      budgetData: !!budgetData,
      allActivities: allActivities?.length,
      constructionPhases: constructionPhases?.length
    });

    if (budget && budgetData && allActivities && constructionPhases && 
        typeof budgetData === 'object' && 'project' in budgetData && 'items' in budgetData) {
      
      console.log('📊 Datos del presupuesto:', budgetData);
      setCurrentProject(budgetData.project as any);
      
      // Organizar elementos por fases
      const phaseGroups: Record<number, BudgetItemData[]> = {};
      
      (budgetData.items as any[]).forEach((item: any) => {
        if (!item.phaseId) return;
        
        if (!phaseGroups[item.phaseId]) {
          phaseGroups[item.phaseId] = [];
        }
        
        // For custom activities, use the activity data from the backend response
        // For system activities, find them in allActivities
        let activity = allActivities.find(a => a.id === item.activityId);
        
        // If not found in allActivities (like bridge activities), use the activity data from the item
        if (!activity && item.activity) {
          activity = {
            id: item.activity.id,
            name: item.activity.name,
            unit: item.activity.unit,
            phaseId: item.phaseId
          } as any;
        }
        
        phaseGroups[item.phaseId].push({
          id: item.id.toString(),
          activityId: item.activityId,
          activity,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          subtotal: parseFloat(item.subtotal),
        });
      });
      
      // Crear estructura de fases
      const loadedPhases: PhaseData[] = Object.entries(phaseGroups).map(([phaseId, items]) => {
        const phase = constructionPhases.find(p => p.id === parseInt(phaseId));
        const total = items.reduce((sum, item) => sum + item.subtotal, 0);
        
        return {
          phaseId: parseInt(phaseId),
          phase,
          items,
          total,
        };
      });
      
      console.log('📋 Fases cargadas:', loadedPhases);
      setPhases(loadedPhases);
      setSelectedPhases(loadedPhases.map(p => p.phaseId));
      
      // Actualizar el formulario con los datos del proyecto
      if (budgetData.project) {
        const project = budgetData.project as any;
        form.reset({
          name: project.name || "",
          client: project.client || "",
          location: project.location || "",
          city: project.city || "",
          country: project.country || "Bolivia",
          startDate: project.startDate 
            ? new Date(project.startDate).toISOString().split('T')[0]
            : "",
          equipmentPercentage: project.equipmentPercentage?.toString() || "5.00",
          administrativePercentage: project.administrativePercentage?.toString() || "8.00",
          utilityPercentage: project.utilityPercentage?.toString() || "15.00",
          taxPercentage: project.taxPercentage?.toString() || "3.09",
          socialChargesPercentage: project.socialChargesPercentage?.toString() || "71.18",
        });
        console.log('📝 Formulario actualizado con datos del proyecto');
      }
    }
  }, [budget, budgetData, allActivities, constructionPhases, form]);

  // Crear proyecto nuevo
  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const projectData = {
        name: data.name,
        client: data.client || null,
        location: data.location || null,
        city: data.city || null,
        country: data.country || "Bolivia",
        startDate: data.startDate || null,
        equipmentPercentage: data.equipmentPercentage || "5.00",
        administrativePercentage: data.administrativePercentage || "8.00",
        utilityPercentage: data.utilityPercentage || "15.00",
        taxPercentage: data.taxPercentage || "3.09",
        socialChargesPercentage: data.socialChargesPercentage || "71.18",
      };
      
      console.log("Creando nuevo proyecto:", projectData);
      
      if (isAnonymous) {
        // Para usuarios anónimos, crear proyecto temporal en sessionStorage
        const anonymousProject = {
          id: Date.now(), // Use timestamp as ID
          projectId: Date.now(),
          projectName: projectData.name,
          description: '',
          clientName: projectData.client || '',
          total: 0,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...projectData
        };
        
        // Save to sessionStorage
        const existingProjects = JSON.parse(sessionStorage.getItem('anonymousProjects') || '[]');
        existingProjects.push(anonymousProject);
        sessionStorage.setItem('anonymousProjects', JSON.stringify(existingProjects));
        
        return anonymousProject;
      } else {
        const response = await apiRequest("POST", "/api/projects", projectData);
        if (!response.ok) {
          throw new Error('Error al crear el proyecto');
        }
        return response.json();
      }
    },
    onSuccess: (project) => {
      console.log("Proyecto creado exitosamente:", project);
      setCurrentProject(project);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      toast({
        title: "Proyecto creado exitosamente",
        description: "Ahora puedes agregar fases al presupuesto",
      });
      
      // Reiniciar el formulario
      form.reset();
    },
    onError: (error) => {
      console.error("Error al crear proyecto:", error);
      toast({
        title: "Error",
        description: "No se pudo crear el proyecto. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  // Actualizar proyecto existente
  const updateProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      if (!currentProject) {
        throw new Error('No hay proyecto para actualizar');
      }

      const projectData = {
        name: data.name,
        client: data.client || null,
        location: data.location || null,
        city: data.city || null,
        country: data.country || "Bolivia",
        startDate: data.startDate || null,
        equipmentPercentage: data.equipmentPercentage || "5.00",
        administrativePercentage: data.administrativePercentage || "8.00",
        utilityPercentage: data.utilityPercentage || "15.00",
        taxPercentage: data.taxPercentage || "3.09",
        socialChargesPercentage: data.socialChargesPercentage || "71.18",
      };
      
      console.log("Actualizando proyecto existente:", currentProject.id, projectData);
      
      const response = await apiRequest("PUT", `/api/projects/${currentProject.id}`, projectData);
      if (!response.ok) {
        throw new Error('Error al actualizar el proyecto');
      }
      return response.json();
    },
    onSuccess: (project) => {
      console.log("Proyecto actualizado exitosamente:", project);
      setCurrentProject(project);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      
      toast({
        title: "Proyecto actualizado exitosamente",
        description: "Los cambios han sido guardados",
      });
    },
    onError: (error) => {
      console.error("Error al actualizar proyecto:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el proyecto. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  // Handler para el formulario del proyecto
  const handleProjectSubmit = (data: ProjectFormData) => {
    if (isEditing && currentProject) {
      // Si estamos editando, actualizar el proyecto existente
      updateProjectMutation.mutate(data);
    } else {
      // Si no estamos editando, crear un nuevo proyecto
      createProjectMutation.mutate(data);
    }
  };

  // Función para duplicar proyecto (crear una copia con presupuesto)
  const duplicateProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      if (!currentProject || !budget) {
        throw new Error('Proyecto y presupuesto requeridos para duplicar');
      }

      // Crear proyecto duplicado
      const projectData = {
        name: `${data.name} (Copia)`,
        client: data.client || null,
        location: data.location || null,
        city: data.city || null,
        country: data.country || "Bolivia",
        startDate: data.startDate || null,
        equipmentPercentage: data.equipmentPercentage || "5.00",
        administrativePercentage: data.administrativePercentage || "8.00",
        utilityPercentage: data.utilityPercentage || "15.00",
        taxPercentage: data.taxPercentage || "3.09",
        socialChargesPercentage: data.socialChargesPercentage || "71.18",
      };
      
      console.log("Duplicando proyecto completo:", projectData);
      
      const projectResponse = await apiRequest("POST", "/api/projects", projectData);
      if (!projectResponse.ok) {
        throw new Error('Error al duplicar el proyecto');
      }
      
      const newProject = await projectResponse.json();
      console.log("Proyecto duplicado:", newProject);

      // Crear presupuesto duplicado para el nuevo proyecto
      const totalGeneral = phases.reduce((sum, phase) => sum + phase.total, 0);
      
      const budgetResponse = await apiRequest("POST", "/api/budgets", {
        projectId: newProject.id,
        phaseId: null,
        total: totalGeneral,
        status: "active"
      });
      
      if (!budgetResponse.ok) {
        throw new Error('Error al crear presupuesto duplicado');
      }
      
      const newBudget = await budgetResponse.json();
      console.log("Presupuesto duplicado:", newBudget);

      // Copiar elementos del presupuesto
      for (const phaseData of phases) {
        for (const item of phaseData.items) {
          if (item.activityId > 0 && item.quantity > 0) {
            await apiRequest("POST", "/api/budget-items", {
              budgetId: newBudget.id,
              activityId: item.activityId,
              phaseId: phaseData.phaseId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal
            });
          }
        }
      }

      return { project: newProject, budget: newBudget };
    },
    onSuccess: (data) => {
      console.log("Duplicación completa exitosa:", data);
      setCurrentProject(data.project);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      
      toast({
        title: "Proyecto duplicado exitosamente",
        description: "Se creó una copia completa del proyecto y presupuesto. Ahora puedes editarla sin afectar el original.",
      });
      
      // Cerrar el modal para que el usuario vea la nueva lista
      onClose();
    },
    onError: (error) => {
      console.error("Error al duplicar proyecto:", error);
      toast({
        title: "Error",
        description: "No se pudo duplicar el proyecto. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  // Función para duplicar proyecto
  const handleDuplicateProject = () => {
    if (currentProject && !duplicateProjectMutation.isPending) {
      const formData = form.getValues();
      duplicateProjectMutation.mutate(formData);
    }
  };

  // Guardar presupuesto completo
  const saveBudgetMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject) {
        throw new Error("Proyecto requerido para guardar presupuesto");
      }

      // Validar que hay al menos una fase con actividades válidas
      const validItems = phases.filter(phase => 
        phase.items.some(item => item.activityId > 0 && item.quantity > 0)
      );
      
      if (validItems.length === 0) {
        throw new Error("Debe agregar al menos una actividad válida al presupuesto");
      }

      const totalGeneral = phases.reduce((sum, phase) => sum + phase.total, 0);
      
      let budgetToUse;

      if (isEditing && budget) {
        // MODO EDICIÓN: Actualizar presupuesto existente
        console.log("Actualizando presupuesto existente:", budget.id, "con total:", totalGeneral);
        
        const budgetResponse = await apiRequest("PUT", `/api/budgets/${budget.id}`, {
          total: totalGeneral,
          status: "active"
        });
        
        if (!budgetResponse.ok) {
          const errorText = await budgetResponse.text();
          throw new Error(`Error al actualizar presupuesto: ${errorText}`);
        }
        
        budgetToUse = await budgetResponse.json();
        console.log("Presupuesto actualizado:", budgetToUse);

        // Eliminar elementos existentes del presupuesto
        console.log("Eliminando elementos existentes del presupuesto");
        const deleteResponse = await apiRequest("DELETE", `/api/budgets/${budget.id}/items`);
        if (!deleteResponse.ok) {
          console.warn("Error eliminando items existentes, continuando...");
        } else {
          const deleteResult = await deleteResponse.json();
          console.log("Elementos eliminados:", deleteResult.deletedCount);
        }
        
      } else {
        // MODO CREACIÓN: Crear nuevo presupuesto
        console.log("Creando nuevo presupuesto con total:", totalGeneral);
        
        const budgetResponse = await apiRequest("POST", "/api/budgets", {
          projectId: currentProject.id,
          phaseId: null,
          total: totalGeneral,
          status: "active"
        });
        
        if (!budgetResponse.ok) {
          const errorText = await budgetResponse.text();
          throw new Error(`Error al crear presupuesto: ${errorText}`);
        }
        
        budgetToUse = await budgetResponse.json();
        console.log("Presupuesto creado:", budgetToUse);
      }

      // Crear los nuevos elementos del presupuesto
      let itemsCreated = 0;
      for (const phaseData of phases) {
        for (const item of phaseData.items) {
          if (item.activityId > 0 && item.quantity > 0) {
            console.log("Creando item:", {
              budgetId: budgetToUse.id,
              activityId: item.activityId,
              phaseId: phaseData.phaseId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal
            });
            
            const itemResponse = await apiRequest("POST", "/api/budget-items", {
              budgetId: budgetToUse.id,
              activityId: item.activityId,
              phaseId: phaseData.phaseId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal
            });
            
            if (!itemResponse.ok) {
              const errorText = await itemResponse.text();
              console.error("Error creando item:", errorText);
              throw new Error(`Error al crear elemento del presupuesto: ${errorText}`);
            }
            
            itemsCreated++;
          }
        }
      }
      
      console.log(`Se ${isEditing ? 'actualizaron' : 'crearon'} ${itemsCreated} elementos del presupuesto`);
      return budgetToUse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budget?.id}`] });
      toast({
        title: isEditing ? "Presupuesto actualizado" : "Presupuesto guardado",
        description: `Se ${isEditing ? 'actualizó' : 'creó'} el presupuesto con ${phases.filter(p => p.items.length > 0).length} fases correctamente.`,
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar el presupuesto. Intente nuevamente.",
        variant: "destructive",
      });
    }
  });

  const addPhase = (phaseId: number) => {
    if (selectedPhases.includes(phaseId)) {
      toast({
        title: "Fase ya agregada",
        description: "Esta fase ya está incluida en el presupuesto",
        variant: "destructive",
      });
      return;
    }

    const phase = constructionPhases?.find(p => p.id === phaseId);
    if (!phase) return;

    const newPhaseData: PhaseData = {
      phaseId,
      phase,
      items: [{
        id: Date.now().toString(),
        activityId: 0,
        quantity: 1,
        unitPrice: 0,
        subtotal: 0,
      }],
      total: 0
    };

    setPhases([...phases, newPhaseData]);
    setSelectedPhases([...selectedPhases, phaseId]);
  };

  const removePhase = (phaseId: number) => {
    setPhases(phases.filter(p => p.phaseId !== phaseId));
    setSelectedPhases(selectedPhases.filter(id => id !== phaseId));
  };

  const updatePhaseItems = (phaseId: number, items: BudgetItemData[]) => {
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    setPhases(phases.map(p => 
      p.phaseId === phaseId 
        ? { ...p, items, total }
        : p
    ));
  };

  const addItemToPhase = (phaseId: number) => {
    setPhases(phases.map(p => {
      if (p.phaseId === phaseId) {
        const newItem: BudgetItemData = {
          id: Date.now().toString(),
          activityId: 0,
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
        };
        return { ...p, items: [...p.items, newItem] };
      }
      return p;
    }));
  };

  const removeItemFromPhase = (phaseId: number, itemId: string) => {
    setPhases(phases.map(p => {
      if (p.phaseId === phaseId) {
        const newItems = p.items.filter(item => item.id !== itemId);
        const total = newItems.reduce((sum, item) => sum + item.subtotal, 0);
        return { ...p, items: newItems, total };
      }
      return p;
    }));
  };

  const updateItemInPhase = (phaseId: number, itemId: string, field: keyof BudgetItemData, value: any) => {
    setPhases(phases.map(p => {
      if (p.phaseId === phaseId) {
        const newItems = p.items.map(item => {
          if (item.id === itemId) {
            const updatedItem = { ...item, [field]: value };
            
            if (field === 'activityId') {
              const activity = allActivities?.find((a: any) => a.id === value);
              updatedItem.activity = activity;
              if (activity && activity.unitPrice) {
                const cityValue = form.watch('city');
                const adjustedPrice = applyGeographicFactor(
                  Number(activity.unitPrice), 
                  cityValue
                );
                updatedItem.unitPrice = adjustedPrice;
                console.log('Precio aplicado automáticamente:', adjustedPrice, 'para actividad:', activity.name);
              }
            }
            
            // Siempre recalcular subtotal
            updatedItem.subtotal = updatedItem.quantity * updatedItem.unitPrice;
            
            return updatedItem;
          }
          return item;
        });
        
        const total = newItems.reduce((sum, item) => sum + item.subtotal, 0);
        return { ...p, items: newItems, total };
      }
      return p;
    }));
  };



  const grandTotal = phases.reduce((sum, phase) => sum + phase.total, 0);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-3 sm:p-4 md:p-6">
        <DialogHeader className="pb-4 sm:pb-6 space-y-2">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl font-semibold">
            <Building className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 text-primary" />
            <span className="min-w-0 flex-1 break-words leading-tight">
              {isEditing ? "Editar Presupuesto" : "Crear Nuevo Presupuesto"}
            </span>
          </DialogTitle>
          {isAnonymous && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-orange-800">
                <span className="font-medium">⚠️ Modo de Prueba - Presupuesto Temporal</span>
              </div>
              <p className="text-orange-700 mt-1 text-xs leading-relaxed">
                Puedes crear, editar, calcular, descargar e imprimir presupuestos. 
                Este presupuesto NO se guardará automáticamente en la base de datos - 
                regístrate gratis para guardar tus proyectos permanentemente.
              </p>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          
          {/* Formulario del Proyecto */}
          {(!currentProject || isEditing) && (
            <Card>
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="text-lg sm:text-xl font-semibold text-foreground">
                  {isEditing ? "Editar Información del Proyecto" : "Información del Proyecto"}
                </CardTitle>
                <CardDescription className="text-sm sm:text-base text-muted-foreground mt-2">
                  {isEditing 
                    ? "Modifica los datos del proyecto. Los cambios se aplicarán al proyecto actual."
                    : "Complete los datos básicos del proyecto para comenzar con el presupuesto"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleProjectSubmit)} className="space-y-4 sm:space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="w-full">
                            <FormLabel className="text-sm font-medium">Nombre del Proyecto</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: Casa de 2 pisos" {...field} className="text-sm w-full" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="client"
                        render={({ field }) => (
                          <FormItem className="w-full">
                            <FormLabel className="text-sm font-medium">Cliente</FormLabel>
                            <FormControl>
                              <Input placeholder="Nombre del cliente" {...field} className="text-sm w-full" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem className="w-full">
                            <FormLabel className="text-sm font-medium">Ubicación</FormLabel>
                            <FormControl>
                              <Input placeholder="Dirección o zona" {...field} className="text-sm w-full" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem className="w-full">
                            <FormLabel className="text-sm font-medium">Ciudad</FormLabel>
                            <FormControl>
                              <select
                                {...field}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                              >
                                <option value="">Seleccionar ciudad...</option>
                                <option value="La Paz">La Paz (+17.5%)</option>
                                <option value="Santa Cruz">Santa Cruz (Base)</option>
                                <option value="Cochabamba">Cochabamba (-4.5%)</option>
                                <option value="Potosí">Potosí (+24.25%)</option>
                                <option value="Oruro">Oruro (+10%)</option>
                                <option value="Sucre">Sucre (+5%)</option>
                                <option value="Tarija">Tarija (-2%)</option>
                                <option value="Trinidad">Trinidad (+8%)</option>
                                <option value="Cobija">Cobija (+15%)</option>
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem className="w-full">
                            <FormLabel className="text-sm font-medium">Fecha de Inicio</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} className="text-sm w-full" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full">
                      <Button 
                        type="submit" 
                        disabled={createProjectMutation.isPending || updateProjectMutation.isPending}
                        className="w-full sm:w-auto"
                      >
                        {createProjectMutation.isPending || updateProjectMutation.isPending 
                          ? (isEditing ? "Actualizando..." : "Creando...") 
                          : (isEditing ? "Actualizar Proyecto" : "Crear Proyecto")
                        }
                      </Button>
                      
                      {isEditing && currentProject && (
                        <Button 
                          type="button"
                          variant="outline"
                          onClick={handleDuplicateProject}
                          disabled={duplicateProjectMutation.isPending}
                        >
                          {duplicateProjectMutation.isPending ? "Duplicando..." : "Duplicar Proyecto"}
                        </Button>
                      )}
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}



          {/* Selección de Fases */}
          {currentProject && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                      <span className="text-sm sm:text-base font-semibold truncate">
                        Proyecto: {currentProject.name}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs sm:text-sm whitespace-nowrap self-start sm:self-center">
                      Total: Bs {grandTotal.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Selecciona las fases que incluirá este presupuesto.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mb-4">
                    {constructionPhases?.map((phase) => (
                      <Button
                        key={phase.id}
                        variant={selectedPhases.includes(phase.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => addPhase(phase.id)}
                        disabled={selectedPhases.includes(phase.id)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {phase.name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Fases del Presupuesto */}
              {phases.length > 0 && (
                <Accordion type="multiple" className="space-y-4">
                  {phases.map((phaseData) => (
                    <AccordionItem key={phaseData.phaseId} value={phaseData.phaseId.toString()}>
                      <Card>
                        <AccordionTrigger className="px-3 sm:px-6 py-3 sm:py-4 hover:no-underline">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                              <FileText className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="font-medium text-sm sm:text-base truncate">{phaseData.phase?.name}</span>
                              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                                {phaseData.items.length} elementos
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 self-start sm:self-center">
                              <Badge variant="outline" className="text-xs sm:text-sm whitespace-nowrap">
                                Bs {phaseData.total.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removePhase(phaseData.phaseId);
                                }}
                                className="text-red-500 hover:text-red-700 h-6 w-6 sm:h-8 sm:w-8"
                              >
                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                              </Button>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="px-6 pb-4 space-y-4">
                            {/* Elementos de la fase */}
                            {phaseData.items.map((item, index) => (
                              <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-3 rounded-lg">
                                <div className="col-span-4">
                                  <select
                                    value={item.activityId}
                                    onChange={(e) => updateItemInPhase(phaseData.phaseId, item.id, 'activityId', parseInt(e.target.value) || 0)}
                                    className="w-full p-2 border rounded text-sm"
                                  >
                                    <option value={0}>Seleccionar actividad...</option>
                                    {/* Show current activity if it's a custom activity */}
                                    {item.activity && !allActivities.find(a => a.id === item.activityId) && (
                                      <option key={item.activity.id} value={item.activity.id} style={{backgroundColor: '#dcfce7'}}>
                                        {item.activity.name}
                                      </option>
                                    )}
                                    {allActivities
                                      ?.filter(activity => activity.phaseId === phaseData.phaseId)
                                      ?.map((activity) => (
                                        <option key={activity.id} value={activity.id}>
                                          {activity.name}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.quantity}
                                    onChange={(e) => updateItemInPhase(phaseData.phaseId, item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                    placeholder="Cantidad"
                                    className="text-sm"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.unitPrice}
                                    onChange={(e) => updateItemInPhase(phaseData.phaseId, item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    placeholder="Precio Unit."
                                    className="text-sm"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    type="number"
                                    value={item.subtotal.toFixed(2)}
                                    disabled
                                    className="text-sm bg-gray-100"
                                  />
                                </div>
                                <div className="col-span-2 flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addItemToPhase(phaseData.phaseId)}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                  {phaseData.items.length > 1 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => removeItemFromPhase(phaseData.phaseId, item.id)}
                                      className="text-red-500"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </Card>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <Separator />
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <div className="flex items-center gap-4">
            {phases.length > 0 && (
              <div className="text-lg font-semibold">
                Total: Bs {grandTotal.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
              </div>
            )}
            <Button 
              onClick={() => saveBudgetMutation.mutate()}
              disabled={!currentProject || phases.length === 0 || saveBudgetMutation.isPending}
              className="bg-primary hover:bg-primary-variant"
            >
              {saveBudgetMutation.isPending ? "Guardando..." : isAnonymous ? "Crear Presupuesto (Temporal)" : "Guardar Presupuesto"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}