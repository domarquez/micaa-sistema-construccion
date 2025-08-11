import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertProjectSchema } from "@shared/schema";
import PhaseAccordion from "./phase-accordion-simple";
import type { 
  BudgetWithProject, 
  ConstructionPhase, 
  Project, 
  InsertProject 
} from "@shared/schema";
import { z } from "zod";

const projectFormSchema = insertProjectSchema.extend({
  startDate: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  equipmentPercentage: z.string().optional(),
  administrativePercentage: z.string().optional(),
  utilityPercentage: z.string().optional(),
  taxPercentage: z.string().optional(),
  socialChargesPercentage: z.string().optional(),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

interface BudgetFormProps {
  budget?: BudgetWithProject | null;
  onClose: () => void;
}

export default function BudgetForm({ budget, onClose }: BudgetFormProps) {
  const { toast } = useToast();
  const [currentProject, setCurrentProject] = useState<Project | null>(budget?.project || null);
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [budgetTotal, setBudgetTotal] = useState<number>(0);
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
      equipmentPercentage: budget?.project.equipmentPercentage || "5.00",
      administrativePercentage: budget?.project.administrativePercentage || "8.00",
      utilityPercentage: budget?.project.utilityPercentage || "15.00",
      taxPercentage: budget?.project.taxPercentage || "3.09",
      socialChargesPercentage: budget?.project.socialChargesPercentage || "71.18",
    },
  });

  const { data: phases } = useQuery<ConstructionPhase[]>({
    queryKey: ["/api/construction-phases"],
  });

  const { data: cityFactors = [] } = useQuery({
    queryKey: ["/api/city-price-factors"],
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const projectData: InsertProject = {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
      };

      if (isEditing && currentProject) {
        const response = await apiRequest("PUT", `/api/projects/${currentProject.id}`, projectData);
        return await response.json();
      } else {
        const response = await apiRequest("POST", "/api/projects", projectData);
        return await response.json();
      }
    },
    onSuccess: (project: Project) => {
      setCurrentProject(project);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: isEditing ? "Proyecto actualizado" : "Proyecto creado",
        description: "Ahora puede seleccionar una fase para el presupuesto.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: `No se pudo ${isEditing ? 'actualizar' : 'crear'} el proyecto.`,
        variant: "destructive",
      });
    },
  });

  const onSubmitProject = (data: ProjectFormData) => {
    createProjectMutation.mutate(data);
  };

  const handleSaveDraft = () => {
    toast({
      title: "Borrador guardado",
      description: "El presupuesto ha sido guardado como borrador.",
    });
  };

  const saveBudgetMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject || !selectedPhase) {
        throw new Error("Proyecto y fase requeridos");
      }

      // Crear el presupuesto
      const budgetResponse = await apiRequest("POST", "/api/budgets", {
        projectId: currentProject.id,
        phaseId: selectedPhase,
        total: budgetTotal,
        status: "active"
      });
      const newBudget = await budgetResponse.json();

      // Crear los elementos del presupuesto
      for (const item of budgetItems) {
        if (item.activityId > 0) {
          await apiRequest("POST", "/api/budget-items", {
            budgetId: newBudget.id,
            activityId: item.activityId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal
          });
        }
      }

      return newBudget;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Presupuesto guardado",
        description: "El presupuesto ha sido creado correctamente.",
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

  const handleBudgetChange = (items: any[], total: number) => {
    setBudgetItems(items);
    setBudgetTotal(total);
  };

  const handleSaveBudget = () => {
    if (!selectedPhase) {
      toast({
        title: "Seleccione una fase",
        description: "Debe seleccionar una fase para crear el presupuesto.",
        variant: "destructive",
      });
      return;
    }

    if (budgetItems.length === 0 || budgetItems.every(item => item.activityId === 0)) {
      toast({
        title: "Agregue elementos",
        description: "Debe agregar al menos un elemento con actividad seleccionada.",
        variant: "destructive",
      });
      return;
    }

    saveBudgetMutation.mutate();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {isEditing ? "Editar Presupuesto" : "Crear Nuevo Presupuesto"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Modifique los detalles del presupuesto existente."
              : "Complete la información del proyecto y seleccione las fases."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Project Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitProject)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Proyecto</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ej: Casa Residencial Los Pinos" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="client"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Nombre del cliente" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ubicación</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Dirección del proyecto" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ciudad</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione la ciudad" />
                              </SelectTrigger>
                              <SelectContent>
                                {cityFactors.map((factor: any) => (
                                  <SelectItem key={factor.id} value={factor.city}>
                                    {factor.city} - {factor.country}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de Inicio</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Configuración de Porcentajes de Costos */}
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-900 mb-3">Configuración de Costos</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="equipmentPercentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Herramientas (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  step="0.01"
                                  placeholder="5.00"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="administrativePercentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Gastos Generales (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  step="0.01"
                                  placeholder="8.00"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="utilityPercentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Utilidad (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  step="0.01"
                                  placeholder="15.00"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="taxPercentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Impuesto IT (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  step="0.01"
                                  placeholder="3.09"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="socialChargesPercentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cargas Sociales (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  step="0.01"
                                  placeholder="71.18"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      type="submit"
                      disabled={createProjectMutation.isPending}
                      className="bg-primary hover:bg-primary-variant"
                    >
                      {createProjectMutation.isPending ? (
                        "Guardando..."
                      ) : (
                        isEditing ? "Actualizar Proyecto" : "Guardar Proyecto"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Phase Selection */}
          {currentProject && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Seleccionar Fase</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Select 
                    value={selectedPhase?.toString() || ""} 
                    onValueChange={(value) => setSelectedPhase(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una fase de construcción" />
                    </SelectTrigger>
                    <SelectContent>
                      {phases?.map((phase) => (
                        <SelectItem key={phase.id} value={phase.id.toString()}>
                          {phase.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedPhase && (
                    <div className="mt-6">
                      <Separator className="mb-4" />
                      <PhaseAccordion 
                        phaseId={selectedPhase}
                        projectId={currentProject.id}
                        projectCity={form.watch('city')}
                        projectCountry={form.watch('country')}
                        onBudgetChange={handleBudgetChange}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <div className="flex space-x-3">
            <Button 
              variant="outline"
              onClick={handleSaveDraft}
              disabled={!currentProject}
            >
              Guardar Borrador
            </Button>
            <Button 
              onClick={handleSaveBudget}
              disabled={!currentProject || !selectedPhase}
              className="bg-primary hover:bg-primary-variant"
            >
              Guardar Presupuesto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
