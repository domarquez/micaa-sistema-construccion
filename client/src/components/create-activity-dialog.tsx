import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Loader2, Copy, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ConstructionPhase } from "@shared/schema";

const createActivitySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  phaseId: z.number().min(1, "La fase es requerida"),
  unit: z.string().min(1, "La unidad es requerida"),
  description: z.string().optional(),
  unitPrice: z.string().optional().default("0"),
  originalActivityId: z.number().optional(),
});

type CreateActivityFormData = z.infer<typeof createActivitySchema>;

const commonUnits = [
  "M2", "M3", "ML", "PZA", "GLB", "KG", "HR", "JOR", "LT", "UND"
];

interface CreateActivityDialogProps {
  originalActivity?: {
    id: number;
    name: string;
    phaseId: number;
    unit: string;
    description?: string;
    unitPrice?: string;
  };
  triggerButton?: React.ReactNode;
}

export function CreateActivityDialog({ originalActivity, triggerButton }: CreateActivityDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateActivityFormData>({
    resolver: zodResolver(createActivitySchema),
    defaultValues: {
      name: originalActivity ? `${originalActivity.name} (Copia)` : "",
      phaseId: originalActivity?.phaseId || 0,
      unit: originalActivity?.unit || "",
      description: originalActivity?.description || "",
      unitPrice: originalActivity?.unitPrice || "0",
      originalActivityId: originalActivity?.id,
    },
  });

  const { data: phases } = useQuery<ConstructionPhase[]>({
    queryKey: ["/api/construction-phases"],
    queryFn: async () => {
      const response = await fetch("/api/construction-phases");
      if (!response.ok) throw new Error('Failed to fetch phases');
      return response.json();
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: CreateActivityFormData) => {
      return apiRequest("POST", "/api/activities", {
        ...data,
        unitPrice: data.unitPrice || "0",
      });
    },
    onSuccess: () => {
      toast({
        title: originalActivity ? "Actividad duplicada" : "Actividad creada",
        description: originalActivity 
          ? "La actividad ha sido duplicada exitosamente y está disponible para todos."
          : "La nueva actividad ha sido creada y está disponible para todos los usuarios.",
      });
      form.reset();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la actividad.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateActivityFormData) => {
    createActivityMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            <span className="text-truncate">Nueva Actividad</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] mx-3 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {originalActivity ? (
              <>
                <Copy className="h-5 w-5" />
                Duplicar Actividad
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Crear Nueva Actividad
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {originalActivity 
              ? "Crea una copia de esta actividad con modificaciones. La nueva actividad será visible para todos los usuarios."
              : "Crea una nueva actividad de construcción que estará disponible para todos los usuarios de la plataforma."
            }
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Actividad *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Excavación manual en terreno semi-duro"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phaseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fase de Construcción *</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value ? field.value.toString() : ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar fase" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {phases?.map((phase) => (
                        <SelectItem key={phase.id} value={phase.id.toString()}>
                          {phase.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidad de Medida *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar unidad" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {commonUnits.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unitPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio Unitario (Bs.)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descripción detallada de la actividad (opcional)"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createActivityMutation.isPending}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {createActivityMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : originalActivity ? (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicar Actividad
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Actividad
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateActivityDialog;