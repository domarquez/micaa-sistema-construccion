import { useState } from "react";
import { useParams } from "wouter";
import { getQueryFn } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Calendar, MapPin, User, FileText, Calculator, Download, Printer, ChevronDown, Pencil } from "lucide-react";
import { formatCurrency, formatDate, itemEffectiveSubtotal } from "@/lib/utils";
import { groupBudgetItemsByPhase, type PhaseLike } from "@/lib/budget-phase-groups";
import type { BudgetWithProject, BudgetItemWithActivity } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { BASE_PRICE_NOTE, TRANSPORT_LINE_LABEL, budgetTransport, transportDetail, transportOrigin, writePdfTotals } from "@/lib/transport-summary";
import { track } from "@/lib/analytics";
import { ExpandableText } from "@/components/ui/expandable-text";
import { SuggestedSuppliersCard } from "@/components/suggested-suppliers-card";
import MultiphaseBudgetForm from "@/components/budgets/multi-phase-budget-form";

// Helper para normalizar presupuestos temporales al formato BudgetWithProject
function normalizeAnonymousBudget(foundBudget: any): BudgetWithProject {
  // Seleccionar la primera fase como fase principal, o null si no hay fases
  const primaryPhase = foundBudget.phases && foundBudget.phases.length > 0 
    ? foundBudget.phases[0].phase 
    : null;
  
  return {
    id: foundBudget.id,
    projectId: foundBudget.projectId,
    phaseId: primaryPhase?.id || null,
    total: foundBudget.total || 0,
    status: foundBudget.status || 'active',
    transportCost: null,
    transportSnapshot: null,
    createdAt: foundBudget.createdAt || new Date().toISOString(),
    updatedAt: foundBudget.updatedAt || new Date().toISOString(),
    project: foundBudget.project || {
      id: foundBudget.projectId,
      name: 'Proyecto Sin Título',
      description: '',
      location: '',
      client: '',
      city: '',
      country: 'Bolivia',
      startDate: null,
      equipmentPercentage: '5.00',
      administrativePercentage: '8.00',
      utilityPercentage: '15.00',
      taxPercentage: '3.09',
      socialChargesPercentage: '71.18',
      createdAt: foundBudget.createdAt || new Date().toISOString(),
      updatedAt: foundBudget.updatedAt || new Date().toISOString(),
      userId: 0,
      status: 'active'
    },
    phase: primaryPhase || {
      id: 0,
      name: 'Sin Fase',
      description: ''
    }
  };
}

export default function BudgetDetails() {
  const { id } = useParams();
  const budgetId = Number(id);
  const { isAnonymous } = useAuth();
  const queryClient = useQueryClient();
  const [financeOpen, setFinanceOpen] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const handleGeneratePDF = async () => {
    if (!budget || !budgetItems) {
      alert('No hay datos disponibles para generar el PDF');
      return;
    }

    try {
      track("pdf_exported", { budgetId });
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = 20;

      // Encabezado empresarial
      doc.setFontSize(18);
      doc.text('MICAA', margin, yPosition);
      doc.setFontSize(10);
      doc.text('Sistema Integral de Construccion y Arquitectura', margin, yPosition + 8);
      doc.text('Bolivia | micaa.site', margin, yPosition + 16);
      yPosition += 30;

      // Título del documento
      doc.setFontSize(16);
      doc.text('PRESUPUESTO DETALLADO DE CONSTRUCCION', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;

      // Información del proyecto
      doc.setFontSize(11);
      doc.text(`PROYECTO: ${budget.project?.name || 'Sin nombre'}`, margin, yPosition);
      yPosition += 8;
      doc.text(`CLIENTE: ${budget.project?.client || 'No especificado'}`, margin, yPosition);
      yPosition += 8;
      doc.text(`UBICACION: ${budget.project?.location || 'No especificada'}`, margin, yPosition);
      yPosition += 8;
      doc.text(`FECHA DE EMISION: ${new Date().toLocaleDateString('es-BO')}`, margin, yPosition);
      yPosition += 8;
      doc.text(`PRESUPUESTO #${budget.id}`, margin, yPosition);
      yPosition += 15;

      // Encabezado de tabla principal
      doc.setFontSize(9);
      doc.text('ITEM', margin, yPosition);
      doc.text('DESCRIPCION DE LA ACTIVIDAD', margin + 15, yPosition);
      doc.text('UND', margin + 110, yPosition);
      doc.text('CANT.', margin + 125, yPosition);
      doc.text('P.UNIT. (Bs)', margin + 145, yPosition);
      doc.text('TOTAL (Bs)', margin + 170, yPosition);
      yPosition += 5;

      // Línea separadora principal
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // Items del presupuesto con detalles
      let totalGeneral = 0;
      
      for (let index = 0; index < orderedItems.length; index++) {
        const item = orderedItems[index];
        
        if (yPosition > 230) {
          doc.addPage();
          yPosition = 30;
          // Repetir encabezado en nueva página
          doc.setFontSize(9);
          doc.text('ITEM', margin, yPosition);
          doc.text('DESCRIPCION DE LA ACTIVIDAD', margin + 15, yPosition);
          doc.text('UND', margin + 110, yPosition);
          doc.text('CANT.', margin + 125, yPosition);
          doc.text('P.UNIT. (Bs)', margin + 145, yPosition);
          doc.text('TOTAL (Bs)', margin + 170, yPosition);
          yPosition += 5;
          doc.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 8;
        }

        const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) : Number(item.quantity);
        const unitPrice = typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : Number(item.unitPrice);
        const subtotal = itemEffectiveSubtotal(item);
        totalGeneral += subtotal;

        // Actividad principal
        doc.setFontSize(8);
        doc.text(`${(index + 1).toString().padStart(2, '0')}`, margin, yPosition);
        
        // Limpiar nombre de la actividad
        let activityName = item.activity?.name || 'Sin descripcion';
        activityName = activityName.replace(/^ANÁLISIS DE PRECIOS UNITARIOS \(APU\) DE:\s*/i, '');
        activityName = activityName.replace(/^APU DE:\s*/i, '');
        
        if (activityName.length > 40) {
          activityName = activityName.substring(0, 40) + '...';
        }
        
        doc.text(activityName, margin + 15, yPosition);
        doc.text(item.activity?.unit || 'und', margin + 110, yPosition);
        doc.text(quantity.toFixed(2), margin + 125, yPosition);
        doc.text(unitPrice.toFixed(2), margin + 145, yPosition);
        doc.text(subtotal.toFixed(2), margin + 170, yPosition);
        yPosition += 12;

        // Composición real del precio unitario (APU en vivo del ítem). Antes se pedía
        // /api/activities/:id/composition (no existe) y se imprimía un "ANALISIS ESTIMADO 60/25/15" ficticio.
        try {
          const token = localStorage.getItem('auth_token');
          const response = item.id && token
            ? await fetch(`/api/budget-items/${item.id}/apu`, { headers: { Authorization: `Bearer ${token}` } })
            : null;
          const apu = response && response.ok ? (await response.json())?.apu : null;
          if (apu && Number(apu.totalUnitPrice) > 0) {
            const f2 = (n: any) => (Number(n) || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const lines: Array<[string, any]> = [
              ['Materiales', apu.materialsTotal],
              ['Mano de obra (con cargas sociales e IVA M.O.)', apu.laborFinal],
              ['Equipo y herramientas menores', apu.equipmentWithTools],
              ['Gastos generales, utilidad e IT', (Number(apu.administrativeCost) || 0) + (Number(apu.utilityCost) || 0) + (Number(apu.taxCost) || 0)],
            ];
            doc.setFontSize(7);
            doc.text('    COMPOSICION DEL PRECIO UNITARIO (Bs/' + (item.activity?.unit || 'und') + '):', margin + 20, yPosition);
            yPosition += 4;
            for (const [label, val] of lines) {
              if (yPosition > 270) { doc.addPage(); yPosition = 30; }
              doc.text(`    • ${label}`, margin + 25, yPosition);
              doc.text(`Bs ${f2(val)}`, margin + 145, yPosition);
              yPosition += 4;
            }
          }
        } catch (error) {
          console.error('Error obteniendo APU del ítem:', error);
        }
        yPosition += 4;
        // Línea separadora entre items
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
      }

      // Resumen financiero (sin IVA 13% aparte: los P.U. ya incluyen IVA de M.O. e IT)
      yPosition += 10;
      if (yPosition > 240) { doc.addPage(); yPosition = 30; }
      doc.setFontSize(11);
      doc.text('RESUMEN FINANCIERO', margin, yPosition);
      yPosition += 10;
      yPosition = writePdfTotals(doc, {
        itemsTotal: totalGeneral,
        budget,
        y: yPosition,
        margin,
        pageWidth,
        checkNewPage: (space = 30) => {
          if (yPosition + space > 280) { doc.addPage(); return true; }
          return false;
        },
      });
      yPosition += 4;

      // Información adicional
      doc.setFontSize(8);
      doc.text('* Validez de la oferta: 30 dias calendario', margin, yPosition);
      yPosition += 5;
      doc.text('* Moneda: Bolivianos (Bs)', margin, yPosition);
      yPosition += 10;

      // Pie de página profesional
      doc.setFontSize(7);
      doc.text('Este presupuesto ha sido elaborado con MICAA - Sistema Integral de Construccion', pageWidth / 2, yPosition, { align: 'center' });
      doc.text('micaa.site | Bolivia', pageWidth / 2, yPosition + 5, { align: 'center' });

      // Descargar
      const projectName = budget.project?.name?.replace(/[^a-zA-Z0-9\s]/g, '') || 'proyecto';
      doc.save(`Presupuesto_${projectName}_${budget.id}.pdf`);
      
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar el PDF. Intentá de nuevo.');
    }
  };

  const { data: budget, isLoading: budgetLoading } = useQuery<BudgetWithProject>({
    queryKey: isAnonymous ? [`/api/anonymous/budgets/${budgetId}`] : [`/api/budgets/${budgetId}`],
    // OJO: pasar `queryFn: undefined` anula el queryFn por defecto del QueryClient (React Query v5 hace spread)
    // y la consulta falla con "Missing queryFn" → "Presupuesto no encontrado". Con sesión se usa getQueryFn.
    queryFn: isAnonymous ? () => {
      // Para usuarios anónimos, cargar desde sessionStorage
      const anonymousBudgets = JSON.parse(sessionStorage.getItem('anonymousBudgets') || '[]');
      const foundBudget = anonymousBudgets.find((b: any) => b.id === budgetId);
      
      if (!foundBudget) {
        throw new Error('Presupuesto temporal no encontrado');
      }
      
      console.log('📋 Presupuesto temporal encontrado:', foundBudget);
      
      // Normalizar al formato BudgetWithProject
      return normalizeAnonymousBudget(foundBudget);
    } : getQueryFn({ on401: "returnNull" }),
    enabled: !!budgetId,
  });

  // Usuarios con sesión: los ítems (con actividad y su fase actual) vienen en GET /api/budgets/:id.
  // No existe GET /api/budgets/:id/items (devolvía el index.html del SPA y la vista quedaba vacía).
  const { data: anonymousItems, isLoading: anonymousItemsLoading } = useQuery<BudgetItemWithActivity[]>({
    queryKey: [`/api/anonymous/budgets/${budgetId}/items`],
    queryFn: () => {
      // Para usuarios anónimos, cargar items desde sessionStorage
      const anonymousBudgets = JSON.parse(sessionStorage.getItem('anonymousBudgets') || '[]');
      const foundBudget = anonymousBudgets.find((b: any) => b.id === budgetId);
      
      if (!foundBudget || !foundBudget.phases) {
        console.log('❌ No se encontraron items para el presupuesto temporal');
        return [];
      }
      
      console.log('📊 Items del presupuesto temporal:', foundBudget.phases);
      
      // Extraer todos los items de todas las fases, incluyendo phaseId
      const allItems: BudgetItemWithActivity[] = [];
      foundBudget.phases.forEach((phase: any) => {
        if (phase.items && Array.isArray(phase.items)) {
          phase.items.forEach((item: any) => {
            allItems.push({
              id: Number(item.id) || 0,
              budgetId: foundBudget.id,
              phaseId: phase.phaseId || phase.phase?.id || null,
              activityId: item.activityId,
              quantity: String(item.quantity || 0),
              unitPrice: String(item.unitPrice || 0),
              subtotal: String(item.subtotal || 0),
              activity: item.activity
            });
          });
        }
      });
      
      return allItems;
    },
    enabled: !!budgetId && isAnonymous,
  });

  // Todas las fases (incluidas las inactivas 3/4/7/9) para nombrar/ordenar ítems guardados en fases antiguas.
  const { data: allPhases } = useQuery<PhaseLike[]>({
    queryKey: ["/api/construction-phases", { includeInactive: 1 }],
    staleTime: 5 * 60 * 1000,
  });

  const budgetItems: BudgetItemWithActivity[] | undefined = isAnonymous
    ? anonymousItems
    : ((budget as any)?.items as BudgetItemWithActivity[] | undefined);
  const itemsLoading = isAnonymous ? anonymousItemsLoading : budgetLoading;
  const phaseGroups = groupBudgetItemsByPhase(budgetItems ?? [], Array.isArray(allPhases) ? allPhases : []);
  const orderedItems = phaseGroups.flatMap((g) => g.items);

  if (budgetLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-32 lg:col-span-2" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Presupuesto no encontrado
        </h2>
        <p className="text-muted-foreground mb-6">
          El presupuesto que buscás no existe o no tenés permisos para verlo.
        </p>
        <Button onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  const totalItems = budgetItems?.reduce((sum, item) => sum + itemEffectiveSubtotal(item), 0) || 0;
  const { cost: transportCost, snapshot: transportSnap } = budgetTransport(budget);

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 max-w-full overflow-x-hidden pb-24 md:pb-0">
      {/* Header: título en su fila; acciones compactas en móvil */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex items-start gap-2 min-w-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.history.back()}
            className="shrink-0"
            aria-label="Volver"
            title="Volver"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-title-fluid text-[var(--micaa-fg)]">
              <ExpandableText lines={2} moreLabel="Ver nombre completo" lessLabel="Ver menos">
                {budget.project.name}
              </ExpandableText>
            </h1>
            <p className="mt-0.5 text-sm text-[var(--micaa-muted)] break-words">
              {budget.phase ? budget.phase.name : "Multifase"} · Presupuesto #{budget.id}
            </p>
          </div>
          <Badge
            variant={budget.status === 'active' ? 'default' :
                    budget.status === 'completed' ? 'secondary' : 'outline'}
            className="text-xs shrink-0 mt-1"
          >
            {budget.status === 'active' ? 'Activo' :
             budget.status === 'completed' ? 'Completado' : 'Borrador'}
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isAnonymous && (
            <Button
              onClick={() => setShowEditForm(true)}
              size="sm"
              className="btn-micaa-primary flex items-center gap-2 h-9"
              data-testid="button-edit-budget"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </Button>
          )}
          <Button
            onClick={handleGeneratePDF}
            size="sm"
            variant={isAnonymous ? "default" : "outline"}
            className={`${isAnonymous ? "btn-micaa-primary" : ""} flex items-center gap-2 h-9`}
          >
            <Download className="w-4 h-4" />
            <span className="sm:hidden">PDF</span>
            <span className="hidden sm:inline">Descargar PDF</span>
          </Button>
          <Button
            onClick={() => window.print()}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            aria-label="Imprimir"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </Button>
        </div>
      </div>

      {/* Project Info + Financial: siempre 1 columna en móvil */}
      {/* flex-col en móvil (1 col forzada); grid 3 cols solo desde lg */}
      <div className="flex flex-col gap-4 sm:gap-6 min-w-0 lg:grid lg:grid-cols-3">
        <Card className="tech-card lg:col-span-2 shadow-none min-w-0 w-full max-w-full border-[var(--micaa-line)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Información del Proyecto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <User className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium break-words">{budget.project.client || "No especificado"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 min-w-0">
                <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Ubicación</p>
                  <p className="font-medium break-words">{budget.project.location || "No especificado"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 min-w-0">
                <Calendar className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Fecha de Inicio</p>
                  <p className="font-medium">
                    {budget.project.startDate ? formatDate(budget.project.startDate) : "No definida"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 min-w-0">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <p className="font-medium capitalize">{budget.project.status}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="tech-card shadow-none min-w-0 w-full max-w-full border-[var(--micaa-line)]">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base sm:text-lg">Resumen Financiero</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <p className="text-sm text-muted-foreground shrink-0">Total</p>
              <p className="measure text-base sm:text-xl font-bold text-[var(--micaa-accent)] text-right whitespace-nowrap tabular-nums shrink-0">
                {formatCurrency(Number(budget.total) > 0.0005 ? budget.total : totalItems + transportCost)}
              </p>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3 min-w-0">
                <span className="text-muted-foreground min-w-0">Subtotal actividades</span>
                <span className="font-semibold tabular-nums text-right whitespace-nowrap shrink-0">{formatCurrency(totalItems)}</span>
              </div>
              {transportCost > 0 && (
                <div className="flex justify-between gap-3 min-w-0">
                  <span className="text-muted-foreground">{TRANSPORT_LINE_LABEL}</span>
                  <span className="font-semibold tabular-nums text-right shrink-0">{formatCurrency(transportCost)}</span>
                </div>
              )}
            </div>
            <Collapsible open={financeOpen} onOpenChange={setFinanceOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-primary hover:text-primary/90 -ml-2"
                >
                  <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${financeOpen ? "rotate-180" : ""}`} />
                  {financeOpen ? "Ocultar detalle" : "Ver detalle"}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-1">
                {transportCost > 0 && (
                  <p className="text-xs text-muted-foreground leading-relaxed break-words">
                    {transportOrigin(transportSnap)}
                    {transportDetail(transportSnap) ? ` · ${transportDetail(transportSnap)}` : ""}
                    {" · incluye GG, utilidad e IT"}
                  </p>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed break-words">{BASE_PRICE_NOTE}</p>
                <div>
                  <p className="text-xs text-muted-foreground">Fase de construcción</p>
                  <p className="text-sm font-medium">{budget.phase ? budget.phase.name : "Multifase"}</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>

      {/* Budget Items */}
      <Card className="tech-card shadow-none min-w-0 w-full border-[var(--micaa-line)]">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base sm:text-lg flex items-center gap-2">
            <Calculator className="w-5 h-5 shrink-0 text-primary" />
            <span>Detalles del Presupuesto</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {itemsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <div className="text-right space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : orderedItems.length > 0 ? (
            <div className="space-y-6">
              {phaseGroups.map((group) => (
                <div key={group.phaseId} data-testid={`phase-group-${group.phaseId}`} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3 border-b border-orange-100 pb-2 mb-2 min-w-0">
                    <h3 className="font-semibold text-on-surface break-words min-w-0">
                      {group.name}
                      {!group.isActive && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(fase anterior)</span>
                      )}
                    </h3>
                    <span className="font-semibold tabular-nums text-primary shrink-0 whitespace-nowrap">{formatCurrency(group.total)}</span>
                  </div>

                  {/* Móvil: lista en cards */}
                  <div className="md:hidden space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="row-accent rounded-[14px] border border-[var(--micaa-line)] bg-white p-3 pl-4 space-y-1.5 min-w-0"
                      >
                        <p className="text-apu text-[13.5px] font-semibold tracking-tight text-[var(--micaa-fg)]">
                          <ExpandableText apu lines={2} moreLabel="Ver nombre completo" lessLabel="Ver menos">
                            {item.activity?.name || `Actividad #${item.activityId}`}
                          </ExpandableText>
                        </p>
                        <div className="flex justify-between gap-2 text-xs text-[var(--micaa-muted)]">
                          <span>
                            {item.activity?.unit || "—"} · cant.{" "}
                            <span className="measure">
                              {Number(item.quantity).toLocaleString("es-BO", { maximumFractionDigits: 3 })}
                            </span>
                          </span>
                          <span className="measure shrink-0">
                            P.U. {formatCurrency(Number(item.unitPrice))}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 text-sm pt-1 border-t border-[var(--micaa-line)]">
                          <span className="text-[var(--micaa-muted)]">Subtotal</span>
                          <span className="measure font-semibold text-[var(--micaa-accent)] whitespace-nowrap">
                            {formatCurrency(itemEffectiveSubtotal(item))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: tabla */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="py-1 pr-2 font-medium">Actividad</th>
                          <th className="py-1 px-2 font-medium">Und</th>
                          <th className="py-1 px-2 font-medium text-right">Cantidad</th>
                          <th className="py-1 px-2 font-medium text-right">P. unit.</th>
                          <th className="py-1 pl-2 font-medium text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => (
                          <tr key={item.id} className="border-t border-gray-100">
                            <td className="py-2 pr-2">{item.activity?.name || `Actividad #${item.activityId}`}</td>
                            <td className="py-2 px-2 text-muted-foreground">{item.activity?.unit || "—"}</td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {Number(item.quantity).toLocaleString("es-BO", { maximumFractionDigits: 3 })}
                            </td>
                            <td className="measure py-2 px-2 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                            <td className="measure py-2 pl-2 text-right font-medium whitespace-nowrap">{formatCurrency(itemEffectiveSubtotal(item))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <div className="border-t pt-4 bg-[#FAFAF8] p-3 sm:p-4 rounded-lg space-y-2 min-w-0">
                <div className="flex justify-between items-center gap-3 min-w-0">
                  <p className="text-base sm:text-lg font-semibold min-w-0">
                    {transportCost > 0 ? "Subtotal actividades" : "Total del Presupuesto"}
                  </p>
                  <p className="measure text-lg sm:text-xl font-bold text-[var(--micaa-accent)] text-right shrink-0">
                    {formatCurrency(totalItems)}
                  </p>
                </div>
                {transportCost > 0 && (
                  <>
                    <div className="flex justify-between items-center gap-3 text-sm min-w-0">
                      <p className="text-gray-700 min-w-0">{TRANSPORT_LINE_LABEL}</p>
                      <p className="font-semibold tabular-nums shrink-0">{formatCurrency(transportCost)}</p>
                    </div>
                    <div className="flex justify-between items-center gap-3 border-t pt-2 min-w-0">
                      <p className="text-base sm:text-lg font-semibold">Total del Presupuesto</p>
                      <p className="measure text-lg sm:text-xl font-bold text-[var(--micaa-accent)] shrink-0">
                        {formatCurrency(totalItems + transportCost)}
                      </p>
                    </div>
                  </>
                )}
                {!isAnonymous && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Podés cambiar cantidades o precios con el botón «Editar» arriba.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-muted-foreground">
                Este presupuesto aún no tiene items calculados.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <SuggestedSuppliersCard
        city={(budget as any)?.project?.city || null}
        activityIds={(budgetItems || [])
          .map((it) => Number(it.activityId))
          .filter((n) => Number.isFinite(n) && n > 0)}
      />

      {/* Total sticky en móvil — Plano vivo */}
      <div className="sticky-budget-total" aria-live="polite">
        <div className="min-w-0">
          <div className="l">Total del presupuesto</div>
          <div className="text-[11px] opacity-70 mt-0.5">
            {budget.phase ? budget.phase.name : "Multifase"}
          </div>
        </div>
        <div className="v measure whitespace-nowrap shrink-0">
          {formatCurrency(Number(budget.total) > 0.0005 ? Number(budget.total) : totalItems + transportCost)}
        </div>
      </div>

      {showEditForm && !isAnonymous && (
        <MultiphaseBudgetForm
          budget={budget}
          onClose={() => {
            setShowEditForm(false);
            queryClient.invalidateQueries({ queryKey: [`/api/budgets/${budgetId}`] });
            queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
          }}
        />
      )}
    </div>
  );
}
