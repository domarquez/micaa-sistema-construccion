import { useState, useEffect, useMemo, useRef } from "react";
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
import { Plus, Trash2, Building, FileText, Calculator } from "lucide-react";
import BudgetItemApuDialog from "@/components/budgets/budget-item-apu-dialog";
import ActivitySearchPicker from "@/components/budgets/activity-search-picker";
import ProjectTransportCard, { transportSummaryText } from "@/components/budgets/project-transport-card";
import { buildEditorPhases, editorPhaseRank, removeEditorItem, shouldHydrateEditor } from "@/lib/budget-editor-phases";

import type { Project, ConstructionPhase, ActivityWithPhase, BudgetWithProject } from "@shared/schema";
import { AnonymousBudgetWarning } from "@/components/anonymous-budget-warning";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";
import { getCity } from "@/lib/city";
import { parseBudgetQuantity, BUDGET_QTY_MAX } from "@shared/quantity";

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
  /** budget_items.id cuando el ítem ya existe en el servidor */
  dbId?: number;
  activityId: number;
  activity?: ActivityWithPhase;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  /** true si el usuario escribió el precio unitario a mano (el servidor no lo recalcula) */
  priceManual?: boolean;
  /** budget_items.phase_id guardado: se respeta al actualizar (la agrupación visual usa la fase de la actividad) */
  storedPhaseId?: number | null;
}

interface PhaseData {
  phaseId: number;
  phase?: ConstructionPhase;
  items: BudgetItemData[];
  total: number;
}

// El precio unitario lo calcula el servidor (APU en vivo con factor de ciudad de
// city_price_factors y overrides del proyecto). Ya no hay factores hardcodeados aquí.

interface MultiphaseBudgetFormProps {
  budget?: BudgetWithProject | null;
  onClose: () => void;
  /** Al abrir desde /budgets/:id (Editar), priorizar cantidades/fases sobre metadatos del proyecto. */
  focusQuantities?: boolean;
}

export default function MultiphaseBudgetForm({ budget, onClose, focusQuantities = false }: MultiphaseBudgetFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAnonymous } = useAuth();
  const [currentProject, setCurrentProject] = useState<Project | null>(budget?.project || null);
  const [phases, setPhases] = useState<PhaseData[]>([]);
  /** Siempre el último `phases` — evita cierres stale en Guardar / updates rápidos. */
  const phasesRef = useRef<PhaseData[]>([]);
  useEffect(() => { phasesRef.current = phases; }, [phases]);
  const phasesSectionRef = useRef<HTMLDivElement | null>(null);
  const [projectMetaOpen, setProjectMetaOpen] = useState(!focusQuantities && !budget);
  const [selectedPhases, setSelectedPhases] = useState<number[]>([]);
  const [apuTarget, setApuTarget] = useState<{ phaseId: number; localId: string; dbId: number } | null>(null);
  const [openPhases, setOpenPhases] = useState<string[]>([]);
  /** Presupuesto borrador creado al abrir APU antes del «Guardar» final. */
  const [draftBudgetId, setDraftBudgetId] = useState<number | null>(budget?.id ?? null);
  const [apuOpening, setApuOpening] = useState(false);

  const isEditing = !!budget;
  const persistedBudgetId = budget?.id ?? draftBudgetId;

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

  // Factores reales de city_price_factors (antes: % hardcodeados que no coincidían)
  const { data: cityFactors } = useQuery<Array<{ city: string; materialsFactor: string; laborFactor: string }>>({
    queryKey: ["/api/city-factors"],
    staleTime: 3600_000,
  });
  const cityLabel = (city: string) => {
    const f = cityFactors?.find((c) => c.city === city);
    if (!f) return city;
    const pct = (v: string) => {
      const n = Math.round((Number(v) - 1) * 1000) / 10;
      return n === 0 ? "base" : `${n > 0 ? "+" : ""}${n.toLocaleString("es-BO")} %`;
    };
    const m = pct(f.materialsFactor);
    const l = pct(f.laborFactor);
    return m === "base" && l === "base" ? `${city} (base)` : `${city} (mat. ${m} · M.O. ${l})`;
  };

  // Catálogo COMPLETO (all=1), ordenado por fase y nombre. Antes llegaban solo 100 de ~520.
  const catalogCity = getCity();
  const { data: activitiesResponse } = useQuery<{activities: ActivityWithPhase[]}>({
    queryKey: ["/api/activities", { all: 1, city: catalogCity }],
  });
  
  // Memo: referencia estable (antes un arreglo nuevo en cada render re-disparaba la carga del presupuesto).
  const allActivities = useMemo(
    () => (activitiesResponse?.activities || []).filter((a: any) => a.isOriginal !== false),
    [activitiesResponse],
  );

  // Orden constructivo: /api/construction-phases ya viene ordenado por sort_order (solo fases activas).
  const phaseRank = (phaseId: number, phase?: any) => editorPhaseRank(constructionPhases, phaseId, phase);
  const byPhaseOrder = (a: PhaseData, b: PhaseData) => phaseRank(a.phaseId, a.phase) - phaseRank(b.phaseId, b.phase);
  const [showPhaseButtons, setShowPhaseButtons] = useState(false);

  // Cargar elementos del presupuesto si estamos editando  
  const { data: budgetData, isFetching: budgetFetching } = useQuery({
    queryKey: [`/api/budgets/${budget?.id}`],
    enabled: !!budget?.id,
    refetchOnMount: 'always', // se carga una sola vez: que sea la versión actual, no la de caché
  });

  // Cargar datos existentes al editar: UNA vez por presupuesto (si no, cada edición se pisaba con los datos del servidor)
  const hydratedBudgetId = useRef<number | null>(null);
  useEffect(() => {
    const ready = !budgetFetching && !!budgetData && !!constructionPhases && typeof budgetData === 'object' &&
      'project' in (budgetData as any) && 'items' in (budgetData as any);
    if (!shouldHydrateEditor(hydratedBudgetId.current, budget?.id, ready)) return;
    hydratedBudgetId.current = budget!.id;

    setCurrentProject((budgetData as any).project);
    // Agrupar por la fase de la ACTIVIDAD (igual que el PDF y el detalle); el phase_id guardado se conserva (storedPhaseId).
    const loadedPhases = buildEditorPhases((budgetData as any).items, allActivities, constructionPhases) as PhaseData[];
    setPhases(loadedPhases);
    phasesRef.current = loadedPhases;
    setSelectedPhases(loadedPhases.map(p => p.phaseId));
    // Abrir todas las fases para que cantidades/APU sean fáciles de encontrar (móvil / presupuestos grandes).
    setOpenPhases(loadedPhases.map(p => p.phaseId.toString()));
    if (focusQuantities || isEditing) {
      setProjectMetaOpen(false);
      // Scroll a cantidades tras pintar
      requestAnimationFrame(() => {
        phasesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    // Actualizar el formulario con los datos del proyecto
    const project = (budgetData as any).project;
    if (project) {
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
    }
  }, [budget, budgetData, budgetFetching, allActivities, constructionPhases, form]);

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
      track("budget_created", { projectId: project?.id, source: "multi-phase" });
      setCurrentProject(project);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      toast({
        title: "Proyecto creado exitosamente",
        description: project?.location ? `📍 ${transportSummaryText(project)}` : "Ahora podés agregar fases al presupuesto",
      });
      
      // Reiniciar el formulario
      form.reset();
    },
    onError: (error) => {
      console.error("Error al crear proyecto:", error);
      toast({
        title: "Error",
        description: "No se pudo crear el proyecto. Intentá nuevamente.",
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
        description: "No se pudo actualizar el proyecto. Intentá nuevamente.",
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
              subtotal: item.subtotal,
              // Copia fiel: no recalcular precios al duplicar
              manualUnitPrice: true
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
        description: "Se creó una copia completa del proyecto y presupuesto. Ahora podés editarla sin afectar el original.",
      });
      
      // Cerrar el modal para que el usuario vea la nueva lista
      onClose();
    },
    onError: (error) => {
      console.error("Error al duplicar proyecto:", error);
      toast({
        title: "Error",
        description: "No se pudo duplicar el proyecto. Intentá nuevamente.",
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

      // Volcar inputs de cantidad visibles (blur pendiente) al snapshot antes de guardar.
      if (typeof document !== "undefined") {
        document.querySelectorAll<HTMLInputElement>("input[data-testid=budget-item-quantity]").forEach((el) => {
          const phaseId = Number(el.getAttribute("data-phase-id"));
          const itemId = el.getAttribute("data-item-id");
          if (!itemId || !Number.isFinite(phaseId)) return;
          const parsed = parseBudgetQuantity(el.value);
          if (!parsed.ok) return;
          const next = phasesRef.current.map((p) => {
            if (p.phaseId !== phaseId) return p;
            const items = p.items.map((it) => {
              if (it.id !== itemId) return it;
              return { ...it, quantity: parsed.value, subtotal: parsed.value * it.unitPrice };
            });
            return { ...p, items, total: items.reduce((s, it) => s + it.subtotal, 0) };
          });
          phasesRef.current = next;
        });
        setPhases(phasesRef.current);
      }

      // Leer el snapshot más reciente (incluye fases colapsadas y edits rápidos).
      const phasesSnapshot = phasesRef.current;

      // Validar cantidades antes de pegarle al API
      for (const phase of phasesSnapshot) {
        for (const item of phase.items) {
          if (!(item.activityId > 0)) continue;
          const q = parseBudgetQuantity(item.quantity);
          if (!q.ok) {
            throw new Error(`${phase.phase?.name || "Fase"}: ${q.message}`);
          }
          item.quantity = q.value;
          item.subtotal = item.quantity * item.unitPrice;
        }
      }

      const validItems = phasesSnapshot.filter(phase => 
        phase.items.some(item => item.activityId > 0 && item.quantity > 0)
      );
      
      if (validItems.length === 0) {
        throw new Error("Debe agregar al menos una actividad válida al presupuesto");
      }

      const totalGeneral = phasesSnapshot.reduce((sum, phase) => sum + phase.items.reduce((s, it) => s + it.subtotal, 0), 0);
      
      // USUARIOS ANÓNIMOS: Guardar en sessionStorage
      if (isAnonymous) {
        console.log("Guardando presupuesto temporal para usuario anónimo");
        
        const anonymousBudget = {
          id: Date.now(),
          projectId: currentProject.id,
          project: currentProject,
          total: totalGeneral,
          status: "active",
          phases: phasesSnapshot.map(phaseData => ({
            phaseId: phaseData.phaseId,
            phase: phaseData.phase,
            items: phaseData.items.filter(item => item.activityId > 0 && item.quantity > 0),
            total: phaseData.items.reduce((s, it) => s + it.subtotal, 0)
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Guardar en sessionStorage
        const existingBudgets = JSON.parse(sessionStorage.getItem('anonymousBudgets') || '[]');
        existingBudgets.push(anonymousBudget);
        sessionStorage.setItem('anonymousBudgets', JSON.stringify(existingBudgets));
        
        console.log("Presupuesto temporal guardado:", anonymousBudget);
        return anonymousBudget;
      }
      
      // USUARIOS AUTENTICADOS: Guardar en servidor
      let budgetToUse;

      if (persistedBudgetId) {
        // MODO EDICIÓN / borrador APU: Actualizar presupuesto existente
        console.log("Actualizando presupuesto existente:", persistedBudgetId, "con total:", totalGeneral);
        
        const budgetResponse = await apiRequest("PUT", `/api/budgets/${persistedBudgetId}`, {
          total: totalGeneral,
          status: "active"
        });
        
        if (!budgetResponse.ok) {
          const errorText = await budgetResponse.text();
          throw new Error(`Error al actualizar presupuesto: ${errorText}`);
        }
        
        budgetToUse = await budgetResponse.json();
        console.log("Presupuesto actualizado:", budgetToUse);

        // Ya NO se borran todos los ítems y se recrean: se actualizan en su lugar
        // (PUT), se crean los nuevos (POST) y se eliminan los quitados (DELETE).
        // Así se conservan los ajustes de APU por ítem (project_price_overrides).
        const keptIds = new Set<number>();
        for (const phaseData of phasesSnapshot) {
          for (const item of phaseData.items) {
            if (item.dbId && item.activityId > 0 && item.quantity > 0) keptIds.add(item.dbId);
          }
        }
        let originalItems: any[] = (budgetData as any)?.items || [];
        if (persistedBudgetId && originalItems.length === 0) {
          try {
            const snap = await apiRequest("GET", `/api/budgets/${persistedBudgetId}`);
            if (snap.ok) {
              const data = await snap.json();
              originalItems = data.items || [];
            }
          } catch { /* seguir con lista vacía */ }
        }
        for (const orig of originalItems) {
          if (!keptIds.has(orig.id)) {
            await apiRequest("DELETE", `/api/budget-items/${orig.id}`);
          }
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
        if (budgetToUse?.id) setDraftBudgetId(budgetToUse.id);
      }

      // Crear / actualizar TODOS los ítems del snapshot (fases abiertas o colapsadas).
      let itemsCreated = 0;
      const putErrors: string[] = [];
      // Lotes de 8 para no saturar el browser en presupuestos grandes (casa ~68).
      const updates: Array<() => Promise<void>> = [];
      for (const phaseData of phasesSnapshot) {
        for (const item of phaseData.items) {
          if (persistedBudgetId && item.dbId && item.activityId > 0 && item.quantity > 0) {
            const dbId = item.dbId;
            const body = {
              activityId: item.activityId,
              phaseId: item.storedPhaseId ?? phaseData.phaseId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              manualUnitPrice: !!item.priceManual
            };
            updates.push(async () => {
              const res = await apiRequest("PUT", `/api/budget-items/${dbId}`, body);
              if (!res.ok) {
                let msg = await res.text();
                try { msg = JSON.parse(msg).message || msg; } catch { /* keep */ }
                putErrors.push(`Ítem #${dbId}: ${msg}`);
                return;
              }
              itemsCreated++;
            });
            continue;
          }
          if (item.activityId > 0 && item.quantity > 0) {
            updates.push(async () => {
              const itemResponse = await apiRequest("POST", "/api/budget-items", {
                budgetId: budgetToUse.id,
                activityId: item.activityId,
                phaseId: phaseData.phaseId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
                manualUnitPrice: !!item.priceManual
              });
              if (!itemResponse.ok) {
                const errorText = await itemResponse.text();
                throw new Error(`Error al crear elemento del presupuesto: ${errorText}`);
              }
              itemsCreated++;
            });
          }
        }
      }
      const CHUNK = 8;
      for (let i = 0; i < updates.length; i += CHUNK) {
        await Promise.all(updates.slice(i, i + CHUNK).map((fn) => fn()));
      }
      if (putErrors.length) {
        throw new Error(`No se guardaron ${putErrors.length} ítem(s). ${putErrors[0]}`);
      }
      
      console.log(`Se ${isEditing ? 'actualizaron' : 'crearon'} ${itemsCreated} elementos del presupuesto`);
      return budgetToUse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${persistedBudgetId || budget?.id}`] });
      toast({
        title: isEditing ? "Presupuesto actualizado" : "Presupuesto guardado",
        description: `Se ${isEditing ? 'actualizó' : 'creó'} el presupuesto con ${phases.filter(p => p.items.length > 0).length} fases correctamente.`,
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error al guardar",
        description: error instanceof Error ? error.message : "No se pudo guardar el presupuesto. Intentá nuevamente.",
        variant: "destructive",
      });
    }
  });

  /** Abre el APU: si el ítem aún no está en el servidor, guarda un borrador y luego abre el diálogo. Nunca es un enlace muerto. */
  const openApuForItem = async (phaseId: number, item: BudgetItemData) => {
    if (!item.activityId) {
      toast({ title: "Elegí una actividad", description: "Seleccioná la actividad antes de ver el APU.", variant: "destructive" });
      return;
    }
    if (isAnonymous) {
      toast({
        title: "Registrate para ajustar el APU",
        description: "En modo prueba el APU se calcula al guardar; con cuenta podés verlo y ajustar insumos.",
        variant: "destructive",
      });
      return;
    }
    if (!currentProject?.id) {
      toast({ title: "Creá el proyecto primero", description: "Completá nombre y ciudad y tocá Crear Proyecto.", variant: "destructive" });
      return;
    }
    if (item.dbId) {
      setApuTarget({ phaseId, localId: item.id, dbId: item.dbId });
      return;
    }
    setApuOpening(true);
    try {
      let budgetId = persistedBudgetId;
      if (!budgetId) {
        const totalGeneral = phases.reduce((sum, phase) => sum + phase.total, 0);
        const budgetResponse = await apiRequest("POST", "/api/budgets", {
          projectId: currentProject.id,
          phaseId: null,
          total: totalGeneral,
          status: "draft",
        });
        if (!budgetResponse.ok) {
          throw new Error(await budgetResponse.text());
        }
        const createdBudget = await budgetResponse.json();
        budgetId = createdBudget.id;
        setDraftBudgetId(budgetId);
      }
      const itemResponse = await apiRequest("POST", "/api/budget-items", {
        budgetId,
        activityId: item.activityId,
        phaseId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        manualUnitPrice: !!item.priceManual,
      });
      if (!itemResponse.ok) {
        throw new Error(await itemResponse.text());
      }
      const createdItem = await itemResponse.json();
      const newDbId = createdItem.id as number;
      const livePrice = createdItem.unitPrice != null ? Number(createdItem.unitPrice) : item.unitPrice;
      setPhases((prev) =>
        prev.map((p) => {
          if (p.phaseId !== phaseId) return p;
          const items = p.items.map((it) => {
            if (it.id !== item.id) return it;
            const up = Number.isFinite(livePrice) ? livePrice : it.unitPrice;
            return { ...it, dbId: newDbId, unitPrice: up, subtotal: it.quantity * up };
          });
          return { ...p, items, total: items.reduce((s, i) => s + i.subtotal, 0) };
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setApuTarget({ phaseId, localId: item.id, dbId: newDbId });
      toast({ title: "Borrador listo", description: "Podés ver y ajustar el APU de este ítem." });
    } catch (e: any) {
      console.error("openApuForItem", e);
      toast({
        title: "No se pudo abrir el APU",
        description: String(e?.message || e || "Intentá de nuevo"),
        variant: "destructive",
      });
    } finally {
      setApuOpening(false);
    }
  };

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

    setPhases((prev) => {
      const next = [...prev, newPhaseData].sort(byPhaseOrder);
      phasesRef.current = next;
      return next;
    });
    setSelectedPhases([...selectedPhases, phaseId]);
    setOpenPhases((prev) => (prev.includes(String(phaseId)) ? prev : [...prev, String(phaseId)]));
  };

  /** Agregá una actividad elegida en el buscador global: va a SU fase (se crea si falta). */
  const addActivityFromSearch = (activity: ActivityWithPhase) => {
    const phaseId = activity.phaseId;
    const phase = constructionPhases?.find(p => p.id === phaseId) || (activity as any).phase;
    const itemId = `${Date.now()}-${activity.id}`;
    const provisional = activity.unitPrice ? Number(activity.unitPrice) : 0;
    const newItem: BudgetItemData = {
      id: itemId,
      activityId: activity.id,
      activity,
      quantity: 1,
      unitPrice: provisional,
      subtotal: provisional,
      priceManual: false,
    };
    setPhases((prev) => {
      const exists = prev.some(p => p.phaseId === phaseId);
      const next = exists
        ? prev.map(p => {
            if (p.phaseId !== phaseId) return p;
            const items = [...p.items.filter(i => i.activityId > 0), newItem]; // quita filas vacías
            return { ...p, items, total: items.reduce((sum, i) => sum + i.subtotal, 0) };
          })
        : [...prev, { phaseId, phase, items: [newItem], total: newItem.subtotal }];
      return next.sort(byPhaseOrder);
    });
    setSelectedPhases((prev) => (prev.includes(phaseId) ? prev : [...prev, phaseId]));
    setOpenPhases((prev) => (prev.includes(String(phaseId)) ? prev : [...prev, String(phaseId)]));
    fetchLivePrice(phaseId, itemId, activity.id);
    toast({ title: "Actividad agregada", description: `${activity.name} → ${phase?.name ?? "su fase"}` });
  };

  const removePhase = (phaseId: number) => {
    setPhases((prev) => {
      const next = prev.filter(p => p.phaseId !== phaseId);
      phasesRef.current = next;
      return next;
    });
    setSelectedPhases(selectedPhases.filter(id => id !== phaseId));
  };

  const updatePhaseItems = (phaseId: number, items: BudgetItemData[]) => {
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    setPhases((prev) => {
      const next = prev.map(p => 
        p.phaseId === phaseId 
          ? { ...p, items, total }
          : p
      );
      phasesRef.current = next;
      return next;
    });
  };

  const addItemToPhase = (phaseId: number) => {
    setPhases((prev) => {
      const next = prev.map(p => {
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
      });
      phasesRef.current = next;
      return next;
    });
  };

  const removeItemFromPhase = (phaseId: number, itemId: string) => {
    const next = removeEditorItem(phasesRef.current, phaseId, itemId);
    phasesRef.current = next;
    setPhases(next);
    if (!next.some(p => p.phaseId === phaseId)) setSelectedPhases(selectedPhases.filter(id => id !== phaseId));
  };

  /** Actualiza el P.U. de un ítem (setState funcional: seguro tras un await). */
  const applyItemPrice = (phaseId: number, itemId: string, unitPrice: number, opts: { activityId?: number; manual?: boolean } = {}) => {
    setPhases((prev) => prev.map((p) => {
      if (p.phaseId !== phaseId) return p;
      const items = p.items.map((it) => {
        if (it.id !== itemId) return it;
        if (opts.activityId != null && it.activityId !== opts.activityId) return it; // cambió mientras cargaba
        if (opts.activityId != null && it.priceManual) return it; // el usuario ya escribió un precio
        const up = Math.round(unitPrice * 100) / 100;
        return { ...it, unitPrice: up, subtotal: it.quantity * up, priceManual: opts.manual ?? it.priceManual };
      });
      return { ...p, items, total: items.reduce((s, i) => s + i.subtotal, 0) };
    }));
  };

  /** Precio del servidor: APU en vivo (proyecto → overrides + factor de ciudad). */
  const fetchLivePrice = async (phaseId: number, itemId: string, activityId: number) => {
    try {
      const city = form.getValues('city') || currentProject?.city || 'Santa Cruz';
      const url = !isAnonymous && currentProject?.id
        ? `/api/projects/${currentProject.id}/activities/${activityId}/apu`
        : `/api/activities/${activityId}/apu-calculation?ciudad=${encodeURIComponent(city)}`;
      const res = await apiRequest('GET', url);
      const apu = await res.json();
      if (apu && Array.isArray(apu.rows) && apu.rows.length > 0 && apu.totalUnitPrice > 0) {
        applyItemPrice(phaseId, itemId, Number(apu.totalUnitPrice), { activityId });
      }
    } catch (e) {
      console.warn('No se pudo obtener el APU en vivo; se mantiene el precio de referencia', e);
    }
  };

  const updateItemInPhase = (phaseId: number, itemId: string, field: keyof BudgetItemData, value: any) => {
    setPhases((prev) => {
      const next = prev.map(p => {
        if (p.phaseId !== phaseId) return p;
        const newItems = p.items.map(item => {
          if (item.id !== itemId) return item;
          const updatedItem = { ...item, [field]: value };

          if (field === 'activityId') {
            const activity = allActivities?.find((a: any) => a.id === value);
            updatedItem.activity = activity;
            updatedItem.priceManual = false;
            updatedItem.unitPrice = activity?.unitPrice ? Number(activity.unitPrice) : 0;
            if (activity) fetchLivePrice(phaseId, itemId, activity.id);
          }
          if (field === 'unitPrice') {
            updatedItem.priceManual = true;
          }
          if (field === 'quantity') {
            const n = typeof value === 'number' ? value : Number(value);
            updatedItem.quantity = Number.isFinite(n) ? n : 0;
          }

          updatedItem.subtotal = updatedItem.quantity * updatedItem.unitPrice;
          return updatedItem;
        });
        const total = newItems.reduce((sum, item) => sum + item.subtotal, 0);
        return { ...p, items: newItems, total };
      });
      phasesRef.current = next;
      return next;
    });
  };

  const commitQuantity = (phaseId: number, itemId: string, raw: string) => {
    const parsed = parseBudgetQuantity(raw === "" ? "0" : raw);
    if (!parsed.ok) {
      toast({
        title: "Cantidad inválida",
        description: parsed.message,
        variant: "destructive",
      });
      return;
    }
    updateItemInPhase(phaseId, itemId, 'quantity', parsed.value);
  };



  const grandTotal = phases.reduce((sum, phase) => sum + phase.total, 0);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl md:max-w-5xl max-h-[95vh] overflow-y-auto p-2 sm:p-4 md:p-6 flex flex-col gap-0">
        <DialogHeader className="pb-2 sm:pb-4">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl font-semibold">
            <Building className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 flex-shrink-0 text-primary" />
            <span className="min-w-0 flex-1 break-words leading-tight text-sm sm:text-base md:text-lg">
              {isEditing ? "Editar Presupuesto" : "Crear Nuevo Presupuesto"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col space-y-4 sm:space-y-6 w-full">
          {/* Aviso de Modo de Prueba */}
          {isAnonymous && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 sm:p-3 w-full max-w-full overflow-hidden">
              <div className="flex items-center gap-1 sm:gap-2 text-orange-800">
                <span className="font-medium text-xs sm:text-sm">⚠️ Modo de Prueba - Presupuesto Temporal</span>
              </div>
              <p className="text-orange-700 mt-1 text-xs sm:text-xs leading-relaxed break-words">
                Podés crear, editar y descargar presupuestos. Este presupuesto NO se guardará - 
                regístrate gratis para guardar tus proyectos permanentemente.
              </p>
            </div>
          )}
          
          
          {/* Formulario del Proyecto — en edición queda colapsado para priorizar cantidades */}
          {(!currentProject || isEditing) && (
            <Card>
              <CardHeader className="pb-2 sm:pb-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-lg sm:text-xl font-semibold text-foreground">
                      {isEditing ? "Información del Proyecto" : "Información del Proyecto"}
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base text-muted-foreground mt-2">
                      {isEditing 
                        ? "Nombre, cliente y ciudad. Las cantidades están más abajo."
                        : "Complete los datos básicos del proyecto para comenzar con el presupuesto"
                      }
                    </CardDescription>
                  </div>
                  {isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setProjectMetaOpen((v) => !v)}
                      data-testid="toggle-project-meta"
                    >
                      {projectMetaOpen ? "Ocultar datos" : "Editar datos del proyecto"}
                    </Button>
                  )}
                </div>
                {isEditing && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => {
                        setOpenPhases(phasesRef.current.map((p) => p.phaseId.toString()));
                        phasesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      data-testid="jump-to-quantities"
                    >
                      Ir a cantidades y fases
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className={isEditing && !projectMetaOpen ? "hidden" : undefined}>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleProjectSubmit)} className="space-y-3 sm:space-y-4">
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
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className="text-sm font-medium">Dirección de la obra <span className="font-normal text-muted-foreground">(opcional)</span></FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Av. Banzer 7º anillo, barrio o localidad (Warnes, Cotoca…)" {...field} className="text-sm w-full" />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">Precios base puestos en obra (km cero urbano). Si la obra queda lejos, se suma «Transporte y movilización».</p>
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
                              {["La Paz", "Santa Cruz", "Cochabamba", "Potosí", "Oruro", "Sucre", "Tarija", "Trinidad", "Cobija"].map((c) => (
                                <option key={c} value={c}>{cityLabel(c)}</option>
                              ))}
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
                    Buscá una actividad (se ubica sola en su fase) o agregá fases manualmente.
                  </CardDescription>
                  {!isAnonymous && <ProjectTransportCard project={currentProject} onProjectChange={setCurrentProject} compact />}
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <ActivitySearchPicker phases={constructionPhases} onPick={addActivityFromSearch} />
                  </div>
                  <div className="mb-2 min-w-0">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPhaseButtons((v) => !v)}
                      aria-expanded={showPhaseButtons}
                      data-testid="toggle-empty-phases"
                    >
                      {showPhaseButtons ? "Ocultar fases vacías" : "Avanzado: agregar una fase vacía"}
                    </button>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                      Lo habitual es buscar o explorar actividades arriba; esto solo agrega una fase sin ítems.
                    </p>
                  </div>
                  {showPhaseButtons && (
                  <div className="grid grid-cols-1 min-[390px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mb-4">
                    {constructionPhases?.map((phase) => (
                      <Button
                        key={phase.id}
                        variant={selectedPhases.includes(phase.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => addPhase(phase.id)}
                        disabled={selectedPhases.includes(phase.id)}
                        className="h-auto min-w-0 whitespace-normal text-left justify-start py-2"
                      >
                        <Plus className="w-4 h-4 mr-1 shrink-0" />
                        <span className="min-w-0 break-words">{phase.name}</span>
                      </Button>
                    ))}
                  </div>
                  )}
                </CardContent>
              </Card>

              {/* Fases del Presupuesto */}
              {phases.length > 0 && (
                <div ref={phasesSectionRef} className="space-y-3" data-testid="budget-phases-section">
                <div className="flex flex-wrap items-center justify-between gap-2 sticky top-0 z-10 bg-background/95 backdrop-blur py-2 border-b">
                  <p className="text-sm font-semibold text-foreground">
                    Fases y cantidades ({phases.reduce((n, p) => n + p.items.length, 0)} ítems)
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setOpenPhases(phases.map(p => p.phaseId.toString()))}>
                      Expandir todas
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setOpenPhases([])}>
                      Colapsar
                    </Button>
                  </div>
                </div>
                <Accordion type="multiple" value={openPhases} onValueChange={setOpenPhases} className="space-y-4">
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
                          <div className="px-3 sm:px-6 pb-4 space-y-3 min-w-0">
                            {/* Elementos de la fase — móvil: nombre completo + campos etiquetados debajo */}
                            {phaseData.items.map((item) => {
                              const unit = item.activity?.unit || allActivities?.find((a) => a.id === item.activityId)?.unit || "—";
                              const activityName =
                                item.activity?.name ||
                                allActivities?.find((a) => a.id === item.activityId)?.name ||
                                "";
                              return (
                              <div
                                key={item.id}
                                className="min-w-0 space-y-2 rounded-lg border border-border/60 bg-gray-50 p-3"
                                data-testid={`budget-item-row-${item.id}`}
                              >
                                <div className="min-w-0 space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Actividad</label>
                                  <select
                                    value={item.activityId}
                                    onChange={(e) => updateItemInPhase(phaseData.phaseId, item.id, 'activityId', parseInt(e.target.value) || 0)}
                                    className="w-full min-w-0 p-2 border rounded text-sm"
                                    aria-label="Actividad"
                                  >
                                    <option value={0}>Seleccionar actividad...</option>
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
                                  {activityName ? (
                                    <p className="text-sm font-medium leading-snug break-words text-foreground">
                                      {activityName}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4 sm:grid-cols-12 sm:items-end min-w-0">
                                  <div className="min-w-0 sm:col-span-2">
                                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Cantidad</label>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      defaultValue={String(item.quantity)}
                                      key={`qty-${phaseData.phaseId}-${item.id}`}
                                      onBlur={(e) => commitQuantity(phaseData.phaseId, item.id, e.target.value)}
                                      onChange={(e) => {
                                        const parsed = parseBudgetQuantity(e.target.value);
                                        if (parsed.ok) updateItemInPhase(phaseData.phaseId, item.id, 'quantity', parsed.value);
                                      }}
                                      className="text-sm min-w-0"
                                      aria-label="Cantidad"
                                      data-testid="budget-item-quantity"
                                      data-phase-id={phaseData.phaseId}
                                      data-item-id={item.id}
                                      title={`Máximo ${BUDGET_QTY_MAX.toLocaleString("es-BO")}; coma decimal válida (ej. 12,5)`}
                                    />
                                  </div>
                                  <div className="min-w-0 sm:col-span-2">
                                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Unidad</label>
                                    <div className="flex h-9 items-center rounded-md border bg-white px-2 text-sm text-muted-foreground">
                                      {unit}
                                    </div>
                                  </div>
                                  <div className="min-w-0 sm:col-span-3">
                                    <label className="mb-1 block text-xs font-medium text-muted-foreground">P.U. Bs</label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      inputMode="decimal"
                                      value={item.unitPrice}
                                      onChange={(e) => updateItemInPhase(phaseData.phaseId, item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                      className="text-sm min-w-0"
                                      aria-label="Precio unitario en Bs"
                                    />
                                  </div>
                                  <div className="min-w-0 sm:col-span-3">
                                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Subtotal</label>
                                    <Input
                                      type="text"
                                      value={item.subtotal.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      disabled
                                      className="text-sm bg-gray-100 min-w-0"
                                      aria-label="Subtotal"
                                    />
                                  </div>
                                  <div className="col-span-2 sm:col-span-2 flex gap-1 items-end justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      type="button"
                                      onClick={() => addItemToPhase(phaseData.phaseId)}
                                      title="Agregar ítem"
                                      aria-label="Agregar ítem"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                    {(phaseData.items.length > 1 || item.activityId > 0) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        type="button"
                                        onClick={() => removeItemFromPhase(phaseData.phaseId, item.id)}
                                        className="text-red-500"
                                        title="Quitar ítem"
                                        aria-label="Quitar ítem"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {item.activityId > 0 && !isAnonymous && (
                                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs min-w-0">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="link"
                                      className="h-auto p-0 text-xs"
                                      disabled={apuOpening}
                                      title="Ver el análisis de precio unitario y elegir precios por insumo"
                                      onClick={() => openApuForItem(phaseData.phaseId, item)}
                                      data-testid={`btn-open-apu-${item.id}`}
                                    >
                                      <Calculator className="w-3.5 h-3.5 mr-1" />
                                      {apuOpening && !item.dbId ? "Abriendo APU…" : "Ver / ajustar APU"}
                                    </Button>
                                    {item.priceManual && <Badge variant="outline" className="text-xs">P.U. manual</Badge>}
                                  </div>
                                )}
                              </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </Card>
                    </AccordionItem>
                  ))}
                </Accordion>
                </div>
              )}
            </div>
          )}
        </div>

        {apuTarget && (
          <BudgetItemApuDialog
            open={!!apuTarget}
            budgetItemId={apuTarget.dbId}
            onClose={() => setApuTarget(null)}
            onSaved={(saved) => applyItemPrice(apuTarget.phaseId, apuTarget.localId, saved.unitPrice, { manual: false })}
          />
        )}

        {/* Footer */}
        <Separator />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center min-w-0">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto order-3 sm:order-1">
            Cancelar
          </Button>
          <div className="flex flex-col min-[390px]:flex-row items-stretch min-[390px]:items-center gap-2 sm:gap-4 order-1 sm:order-2 min-w-0">
            {phases.length > 0 && (
              <div className="text-base sm:text-lg font-semibold tabular-nums text-center min-[390px]:text-left">
                Total: Bs {grandTotal.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
              </div>
            )}
            <Button 
              onClick={() => saveBudgetMutation.mutate()}
              disabled={!currentProject || phases.length === 0 || saveBudgetMutation.isPending}
              className="bg-primary hover:bg-primary-variant w-full min-[390px]:w-auto"
            >
              {saveBudgetMutation.isPending ? "Guardando..." : isAnonymous ? "Crear Presupuesto (Temporal)" : "Guardar Presupuesto"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}