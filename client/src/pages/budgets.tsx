import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Calculator, 
  FileText,
  Home,
  Building2,
  FolderRoot,
  Trash2,
  Eye,
  Download,
  Printer,
  Lock,
  UserPlus
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import MultiphaseBudgetForm from "@/components/budgets/multi-phase-budget-form";
import type { BudgetWithProject } from "@shared/schema";
import { AnonymousBudgetWarning } from "@/components/anonymous-budget-warning";
import { useAuth } from "@/hooks/useAuth";

export default function Budgets() {
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithProject | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const { isAnonymous } = useAuth();

  // Auto-open form when accessing /budgets/new
  useEffect(() => {
    if (location === '/budgets/new') {
      setShowForm(true);
    }
  }, [location]);

  const { data: budgets, isLoading: budgetsLoading } = useQuery<BudgetWithProject[]>({
    queryKey: isAnonymous ? ["/api/anonymous/budgets"] : ["/api/budgets"],
    queryFn: isAnonymous ? () => {
      // Para usuarios anónimos, cargar presupuestos desde sessionStorage
      const anonymousBudgets = JSON.parse(sessionStorage.getItem('anonymousBudgets') || '[]');
      console.log('📋 Cargando presupuestos temporales:', anonymousBudgets);
      return anonymousBudgets.map((budget: any) => ({
        id: budget.id,
        projectId: budget.projectId,
        phaseId: null,
        total: budget.total || 0,
        status: budget.status || 'active',
        createdAt: budget.createdAt || new Date().toISOString(),
        updatedAt: budget.updatedAt || new Date().toISOString(),
        project: budget.project || {
          id: budget.projectId,
          name: budget.project?.name || 'Proyecto Sin Título',
          description: budget.project?.description || '',
          location: budget.project?.location || '',
          client: budget.project?.client || '',
          city: budget.project?.city || '',
          country: budget.project?.country || 'Bolivia',
          createdAt: budget.createdAt || new Date().toISOString(),
          updatedAt: budget.updatedAt || new Date().toISOString(),
          userId: 0
        }
      }));
    } : undefined,
    enabled: true, // Always enabled for both cases
    staleTime: isAnonymous ? 0 : 2 * 60 * 1000, // No cache for anonymous
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (budgetId: number) => {
      if (isAnonymous) {
        // Para usuarios anónimos, eliminar presupuesto temporal de sessionStorage
        const anonymousBudgets = JSON.parse(sessionStorage.getItem('anonymousBudgets') || '[]');
        const filteredBudgets = anonymousBudgets.filter((budget: any) => budget.id !== budgetId);
        sessionStorage.setItem('anonymousBudgets', JSON.stringify(filteredBudgets));
        console.log('🗑️ Presupuesto temporal eliminado:', budgetId);
      } else {
        // Para usuarios autenticados, eliminar del servidor
        const budget = budgets?.find(b => b.id === budgetId);
        if (budget?.projectId) {
          await apiRequest("DELETE", `/api/projects/${budget.projectId}`);
        }
      }
    },
    onSuccess: () => {
      // Invalidar queries de manera normal ahora que el endpoint funciona
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/anonymous/budgets"] });
      toast({
        title: isAnonymous ? "Presupuesto eliminado" : "Proyecto eliminado",
        description: isAnonymous 
          ? "El presupuesto temporal ha sido eliminado correctamente."
          : "El proyecto y todos sus presupuestos han sido eliminados correctamente.",
      });
    },
    onError: (error) => {
      console.error('Error deleting:', error);
      toast({
        title: "Error al eliminar",
        description: isAnonymous 
          ? "No se pudo eliminar el presupuesto. Inténtelo nuevamente."
          : "No se pudo eliminar el proyecto. Inténtelo nuevamente.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (budget: BudgetWithProject) => {
    setEditingBudget(budget);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingBudget(null);
    // Forzar recarga completa de datos
    queryClient.removeQueries({ queryKey: ["/api/budgets"] });
    queryClient.removeQueries({ queryKey: ["/api/anonymous/budgets"] });
    queryClient.refetchQueries({ queryKey: ["/api/budgets"] });
    queryClient.refetchQueries({ queryKey: ["/api/anonymous/budgets"] });
    // Navigate back to budgets list if on new budget route
    if (location === '/budgets/new') {
      window.history.pushState(null, '', '/budgets');
    }
  };

  const handleDeleteBudget = (budgetId: number) => {
    deleteProjectMutation.mutate(budgetId);
  };

  const handleDownloadPDF = async (budget: BudgetWithProject) => {
    try {
      toast({
        title: "Generando PDF...",
        description: "Creando documento de presupuesto",
      });

      // Debug: Verificar estado completo del localStorage
      console.log('🔍 LocalStorage keys:', Object.keys(localStorage));
      console.log('🔍 All localStorage content:', JSON.stringify(localStorage));

      // Intentar obtener datos completos del presupuesto con autenticación
      const token = localStorage.getItem('auth_token'); // Corregido: usar 'auth_token' en lugar de 'token'
      let budgetDetails = null;
      
      console.log('🔍 Token disponible:', !!token);
      console.log('🔍 Intentando obtener datos del presupuesto', budget.id);
      
      if (token) {
        try {
          console.log('📡 Haciendo petición al API...');
          const budgetResponse = await fetch(`/api/budgets/${budget.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          console.log('📡 Respuesta del API:', budgetResponse.status);
          
          if (budgetResponse.ok) {
            budgetDetails = await budgetResponse.json();
            console.log('✅ Datos del presupuesto obtenidos exitosamente');
            console.log('📊 Items encontrados:', budgetDetails?.items?.length);
          } else {
            console.log('❌ Error de autenticación:', budgetResponse.status);
            const errorText = await budgetResponse.text();
            console.log('❌ Error details:', errorText);
          }
        } catch (error) {
          console.log('❌ Error de conexión:', error);
        }
      } else {
        console.log('❌ Sin token disponible - verificando otras opciones');
        
        // Intentar sin autenticación para ver si el presupuesto es público
        try {
          console.log('🔓 Intentando acceso sin autenticación...');
          const publicResponse = await fetch(`/api/budgets/${budget.id}`);
          if (publicResponse.ok) {
            budgetDetails = await publicResponse.json();
            console.log('✅ Datos obtenidos sin autenticación');
          }
        } catch (error) {
          console.log('❌ No se puede acceder sin autenticación');
        }
      }

      // Depuración: verificar qué datos tenemos
      console.log('Budget details:', budgetDetails);
      console.log('Has items:', budgetDetails?.items?.length);
      console.log('Token available:', !!token);

      // Si tenemos datos detallados, generar APU completo
      if (budgetDetails && budgetDetails.items && budgetDetails.items.length > 0) {
        console.log('Generando APU completo con', budgetDetails.items.length, 'items');
        await generateDetailedAPU(budget, budgetDetails, token);
      } else {
        // Si no hay datos detallados, generar PDF básico
        console.log('Generando PDF básico - motivo:', !budgetDetails ? 'No budgetDetails' : !budgetDetails.items ? 'No items array' : 'Items array empty');
        await generateBasicPDF(budget);
      }
      
    } catch (error) {
      console.error('Error generando PDF:', error);
      
      // Fallback: generar PDF básico
      try {
        await generateBasicPDF(budget);
      } catch (fallbackError) {
        toast({
          title: "Error al generar PDF",
          description: "No se pudo crear el documento. Verifique su navegador.",
          variant: "destructive",
        });
      }
    }
  };

  // Imprime el desglose real del APU (insumos + cargas + GG/utilidad/IT). Devuelve la nueva Y.
  const printApuBreakdown = (
    doc: any,
    apu: any,
    item: any,
    startY: number,
    margin: number,
    pageWidth: number,
    checkNewPage: (space?: number) => boolean,
  ): number => {
    let y = startY;
    const right = pageWidth - margin;
    const colUnit = margin + 112;
    const colQty = margin + 140;
    const colPu = margin + 160;
    const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n : 0).toLocaleString('es-BO', { minimumFractionDigits: d, maximumFractionDigits: d });
    const ensure = (space = 6) => { if (checkNewPage(space)) y = 20; };
    const trunc = (t: string, max = 62) => (t && t.length > max ? t.slice(0, max - 1) + '…' : t || '');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    ensure(8);
    doc.text('Insumo', margin + 2, y);
    doc.text('Und', colUnit, y);
    doc.text('Cant.', colQty, y, { align: 'right' });
    doc.text('P.U. (Bs)', colPu + 12, y, { align: 'right' });
    doc.text('Parcial (Bs)', right, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 4;

    const sections: Array<[string, string, number]> = [
      ['material', 'MATERIALES', apu.materialsTotal],
      ['labor', 'MANO DE OBRA', apu.laborTotal],
      ['equipment', 'EQUIPO Y MAQUINARIA', apu.equipmentTotal],
    ];
    for (const [type, title, total] of sections) {
      const rows = (apu.rows || []).filter((r: any) => r.inputType === type);
      if (rows.length === 0) continue;
      ensure(8);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin + 2, y);
      doc.setFont('helvetica', 'normal');
      y += 3.5;
      for (const r of rows) {
        ensure(5);
        const tag = r.source && r.source !== 'base' ? ` [${r.sourceLabel || r.source}]` : '';
        doc.text(trunc(`${r.name}${tag}`), margin + 4, y);
        doc.text(String(r.unit || ''), colUnit, y);
        doc.text(fmt(r.effectiveQuantity ?? r.quantity, 4), colQty, y, { align: 'right' });
        doc.text(fmt(r.unitPrice), colPu + 12, y, { align: 'right' });
        doc.text(fmt(r.subtotal), right, y, { align: 'right' });
        y += 3.5;
      }
      ensure(5);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total ${title.toLowerCase()}`, colQty, y, { align: 'right' });
      doc.text(fmt(total), right, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 4;
    }

    const p = apu.percentages || {};
    const lines: Array<[string, number, boolean?]> = [
      [`Cargas sociales (${fmt(p.socialCharges)}% de M.O.)`, apu.laborCharges],
      [`IVA M.O. (${fmt(p.laborIva)}%)`, apu.laborIVA],
      [`Herramientas menores (${fmt(p.minorTools)}% de M.O.)`, apu.tools],
      ['COSTO DIRECTO', apu.directCost, true],
      [`Gastos generales (${fmt(p.administrative)}%)`, apu.administrativeCost],
      [`Utilidad (${fmt(p.utility)}%)`, apu.utilityCost],
      [`IT (${fmt(p.tax)}%)`, apu.taxCost],
      [`PRECIO UNITARIO APU (Bs/${apu.unit || item.activity?.unit || 'und'})`, apu.totalUnitPrice, true],
    ];
    for (const [label, value, bold] of lines) {
      ensure(5);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(label, colQty + 22, y, { align: 'right' });
      doc.text(fmt(value), right, y, { align: 'right' });
      y += 3.5;
    }
    doc.setFont('helvetica', 'normal');
    const stored = parseFloat(item.unitPrice || 0);
    if (Number.isFinite(apu.totalUnitPrice) && Math.abs(stored - apu.totalUnitPrice) > 0.005) {
      ensure(5);
      doc.setFontSize(7);
      doc.text(`Nota: el P.U. guardado del ítem (Bs ${fmt(stored)}) difiere del APU en vivo; actualícelo desde "Ver / ajustar APU".`, margin + 2, y);
      y += 3.5;
    }
    doc.setFontSize(9);
    return y + 2;
  };

  // Función para generar APU detallado
  const generateDetailedAPU = async (budget: BudgetWithProject, budgetDetails: any, token: string | null) => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPosition = 20;

    // Función para verificar si necesita nueva página
    const checkNewPage = (requiredSpace = 20) => {
      if (yPosition > 270 - requiredSpace) {
        doc.addPage();
        yPosition = 20;
        return true;
      }
      return false;
    };

    // Título principal simple
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ANÁLISIS DE PRECIOS UNITARIOS (APU)', pageWidth / 2, yPosition, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    yPosition += 8;
    
    // Línea delgada
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 100, 150);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // Información del proyecto compacta y uniforme
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`PROYECTO: ${budget.project?.name || 'Sin nombre'}`, margin, yPosition);
    yPosition += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${budget.project?.client || 'No especificado'} | Ubicación: ${budget.project?.location || 'No especificada'}, ${budget.project?.city || 'Sin ciudad'}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-BO')} | Presupuesto #${budget.id} | Estado: ${budget.status === 'active' ? 'ACTIVO' : budget.status.toUpperCase()}`, margin, yPosition);
    yPosition += 15;

    let totalGeneral = 0;

    // Agrupar items por fase
    const itemsByPhase = budgetDetails.items.reduce((acc: any, item: any) => {
      const phaseName = item.activity?.phase?.name || 'Sin Fase';
      if (!acc[phaseName]) {
        acc[phaseName] = [];
      }
      acc[phaseName].push(item);
      return acc;
    }, {});

    // Procesar cada fase y sus items
    for (const [phaseName, phaseItems] of Object.entries(itemsByPhase)) {
      checkNewPage(40);
      
      // Título de la fase uniforme
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`FASE: ${phaseName}`, margin, yPosition);
      doc.setFont('helvetica', 'normal');
      yPosition += 5;
      
      // Línea delgada azul
      doc.setLineWidth(0.3);
      doc.setDrawColor(0, 100, 150);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // Procesar items de esta fase
      for (let index = 0; index < (phaseItems as any[]).length; index++) {
        const item = (phaseItems as any[])[index];
        checkNewPage(60);
        
        // Encabezado del item uniforme
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${(index + 1).toString().padStart(2, '0')}. ${item.activity?.name || 'Actividad sin nombre'}`, margin, yPosition);
        if (item.activity?.isCustomActivity) {
          doc.text('(P)', margin + 120, yPosition);
        }
        
        doc.setFont('helvetica', 'normal');
        doc.text(`${item.activity?.unit || 'und'} | Cant: ${parseFloat(item.quantity || 0).toFixed(1)} | P.U: ${parseFloat(item.unitPrice || 0).toFixed(2)} | Total: Bs ${parseFloat(item.subtotal || 0).toFixed(2)}`, margin, yPosition + 4);
        yPosition += 10;

        totalGeneral += parseFloat(item.subtotal || 0);

        // APU real del ítem (en vivo, con overrides del proyecto/ítem). Fallback: APU de la actividad.
        if (item.activity?.id && token) {
          try {
            const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
            let apuData: any = null;
            const itemRes = await fetch(`/api/budget-items/${item.id}/apu`, { headers });
            if (itemRes.ok) {
              apuData = (await itemRes.json()).apu;
            } else {
              const city = encodeURIComponent(budget.project?.city || 'Santa Cruz');
              const actRes = await fetch(`/api/activities/${item.activity.id}/apu-calculation?ciudad=${city}`, { headers });
              if (actRes.ok) apuData = await actRes.json();
            }
            if (apuData && Array.isArray(apuData.rows)) {
              yPosition = printApuBreakdown(doc, apuData, item, yPosition, margin, pageWidth, checkNewPage);
            } else {
              doc.setFontSize(8);
              doc.text('APU no disponible para esta actividad', margin, yPosition);
              yPosition += 6;
            }
          } catch (error) {
            console.log(`Error obteniendo APU para actividad ${item.activity.id}:`, error);
            doc.setFontSize(8);
            doc.text('APU no disponible para esta actividad', margin, yPosition);
            yPosition += 8;
          }
        }

        // Separador entre items más compacto
        yPosition += 2;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
      }

      // Subtotal de la fase más compacto
      const phaseTotal = (phaseItems as any[]).reduce((total: number, item: any) => total + parseFloat(item.subtotal || 0), 0);
      checkNewPage(10);
      doc.setFillColor(230, 230, 230);
      doc.rect(margin, yPosition - 2, pageWidth - 2 * margin, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`SUBTOTAL ${phaseName}: Bs ${phaseTotal.toFixed(2)}`, margin + 3, yPosition + 3);
      doc.setFont('helvetica', 'normal');
      yPosition += 12;
    }

    // Total general uniforme
    checkNewPage(20);
    
    // Línea delgada
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 100, 150);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL GENERAL: Bs ${totalGeneral.toFixed(2)}`, pageWidth / 2, yPosition, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    yPosition += 15;

    // Nota legal compacta
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('NOTA LEGAL: MICAA se exime de toda responsabilidad por los precios expuestos, los cuales son', margin, yPosition);
    yPosition += 3;
    doc.text('referenciales y sujetos a modificaciones. Es responsabilidad del creador verificar precios actualizados.', margin, yPosition);
    
    // Pie de página MICAA pequeño
    yPosition = 842 - 10; // A4 height
    doc.setFontSize(7);
    doc.text('MICAA - Sistema Integral de Construcción y Arquitectura | Santa Cruz, Bolivia | contacto@micaaa.top', pageWidth / 2, yPosition, { align: 'center' });
    
    // Descargar PDF
    const projectName = budget.project?.name?.replace(/[^a-zA-Z0-9\s]/g, '') || 'proyecto';
    doc.save(`APU_Completo_${projectName}_${budget.id}.pdf`);
    
    toast({
      title: "APU completo generado",
      description: `Descargado: APU_Completo_${projectName}_${budget.id}.pdf`,
    });
  };

  // Función para generar PDF básico como fallback
  const generateBasicPDF = async (budget: BudgetWithProject) => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPosition = 20;

    // Función para verificar si necesita nueva página
    const checkNewPage = (requiredSpace = 20) => {
      if (yPosition > 270 - requiredSpace) {
        doc.addPage();
        yPosition = 20;
        return true;
      }
      return false;
    };

    // Encabezado empresarial más profesional (versión básica)
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('MICAA', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistema Integral de Construcción y Arquitectura', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
    
    doc.setFontSize(10);
    doc.text('Santa Cruz, Bolivia | contacto@micaaa.top', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Línea decorativa
    doc.setLineWidth(1.5);
    doc.setDrawColor(0, 100, 150);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 20;

    // Título del documento
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 100, 150);
    doc.text('PRESUPUESTO DE OBRA', pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    yPosition += 25;

    // Información del proyecto
    doc.setFontSize(11);
    doc.text(`PROYECTO: ${budget.project?.name || 'Sin nombre'}`, margin, yPosition);
    yPosition += 8;
    doc.text(`CLIENTE: ${budget.project?.client || 'No especificado'}`, margin, yPosition);
    yPosition += 8;
    doc.text(`UBICACION: ${budget.project?.location || 'No especificada'}`, margin, yPosition);
    yPosition += 8;
    doc.text(`CIUDAD: ${budget.project?.city || 'No especificada'}`, margin, yPosition);
    yPosition += 8;
    doc.text(`FECHA: ${new Date().toLocaleDateString('es-BO')}`, margin, yPosition);
    yPosition += 8;
    doc.text(`PRESUPUESTO #${budget.id}`, margin, yPosition);
    yPosition += 8;
    doc.text(`FASE: ${budget.phase?.name || 'Multifase'}`, margin, yPosition);
    yPosition += 20;

    // Obtener actividades del presupuesto de la lista actual
    checkNewPage(50);
    doc.setFontSize(12);
    doc.text('RESUMEN DE ACTIVIDADES:', margin, yPosition);
    yPosition += 10;

    // Encabezados de tabla
    doc.setFontSize(9);
    doc.text('ITEM', margin, yPosition);
    doc.text('DESCRIPCION', margin + 20, yPosition);
    doc.text('UND', margin + 120, yPosition);
    doc.text('CANTIDAD', margin + 140, yPosition);
    doc.text('SUBTOTAL (Bs)', margin + 170, yPosition);
    yPosition += 6;
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Nota sobre datos
    doc.setFontSize(8);
    doc.text('NOTA: Para el desglose completo APU (Análisis de Precios Unitarios) con', margin, yPosition);
    yPosition += 4;
    doc.text('materiales, mano de obra y herramientas, mantenga la sesión activa en MICAA.', margin, yPosition);
    yPosition += 15;

    // Total destacado
    checkNewPage(30);
    doc.setFontSize(14);
    doc.text('RESUMEN FINANCIERO:', margin, yPosition);
    yPosition += 10;
    doc.setFontSize(12);
    doc.text('TOTAL GENERAL:', margin, yPosition);
    doc.text(`Bs ${parseFloat(budget.total).toFixed(2)}`, margin + 120, yPosition);
    yPosition += 15;

    // Información adicional si está disponible
    if (budget.project?.equipmentPercentage) {
      doc.setFontSize(10);
      doc.text('PORCENTAJES APLICADOS:', margin, yPosition);
      yPosition += 6;
      doc.setFontSize(9);
      doc.text(`• Equipos y herramientas: ${budget.project.equipmentPercentage}%`, margin + 5, yPosition);
      yPosition += 4;
      if (budget.project.administrativePercentage) {
        doc.text(`• Gastos administrativos: ${budget.project.administrativePercentage}%`, margin + 5, yPosition);
        yPosition += 4;
      }
      if (budget.project.utilityPercentage) {
        doc.text(`• Utilidad: ${budget.project.utilityPercentage}%`, margin + 5, yPosition);
        yPosition += 4;
      }
      if (budget.project.taxPercentage) {
        doc.text(`• Impuestos: ${budget.project.taxPercentage}%`, margin + 5, yPosition);
        yPosition += 4;
      }
      yPosition += 8;
    }

    // Condiciones generales
    checkNewPage(40);
    doc.setFontSize(10);
    doc.text('CONDICIONES GENERALES:', margin, yPosition);
    yPosition += 8;
    doc.setFontSize(8);
    doc.text('• Validez de la oferta: 30 días calendario', margin + 5, yPosition);
    yPosition += 4;
    doc.text('• Moneda: Bolivianos (Bs)', margin + 5, yPosition);
    yPosition += 4;
    doc.text('• Precios incluyen materiales, mano de obra y gastos generales', margin + 5, yPosition);
    yPosition += 4;
    doc.text('• Para modificaciones, contactar a MICAA', margin + 5, yPosition);
    yPosition += 4;
    doc.text('• Este documento es un resumen. El APU completo requiere acceso autenticado', margin + 5, yPosition);
    yPosition += 15;

    // Pie de página
    doc.setFontSize(7);
    doc.text('Generado por MICAA - Sistema Integral de Construcción y Arquitectura', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;
    doc.text('Para obtener el APU completo con análisis detallado, acceda a su cuenta en MICAA', pageWidth / 2, yPosition, { align: 'center' });

    // Descargar
    const projectName = budget.project?.name?.replace(/[^a-zA-Z0-9\s]/g, '') || 'proyecto';
    doc.save(`Presupuesto_${projectName}_${budget.id}.pdf`);
    
    toast({
      title: "Presupuesto generado",
      description: "Se descargó el resumen del presupuesto. Para APU completo, mantenga la sesión activa.",
    });
  };

  const getProjectIcon = (projectName: string) => {
    if (projectName.toLowerCase().includes('casa')) return Home;
    if (projectName.toLowerCase().includes('edificio')) return Building2;
    return FolderRoot;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Advertencia para usuarios anónimos */}
      {isAnonymous && (
        <AnonymousBudgetWarning />
      )}
      
      {/* Budgets Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center sm:gap-4 mobile-padding">
        <div>
          <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-on-surface">
            {isAnonymous ? "Presupuestos (Modo Prueba)" : "Gestión de Presupuestos"}
          </h2>
          <p className="text-xs sm:text-sm md:text-base text-gray-600">
            {isAnonymous 
              ? "Crear presupuestos temporales - regístrate para guardarlos permanentemente"
              : "Crear y administrar presupuestos de construcción"
            }
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            onClick={() => {
              console.log('🔵 Crear presupuesto button clicked - Mobile/Desktop');
              setShowForm(true);
            }}
            className="bg-primary text-white hover:bg-primary-variant shadow-material w-full sm:w-auto text-sm px-4 py-3 sm:px-3 sm:py-2 h-12 sm:h-9 touch-target"
            style={{ minHeight: '48px', minWidth: '48px' }}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">
              {isAnonymous ? "Crear Presupuesto de Prueba" : "Nuevo Presupuesto"}
            </span>
            <span className="sm:hidden">
              {isAnonymous ? "Crear Presupuesto" : "Nuevo"}
            </span>
          </Button>
          {isAnonymous && (
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/register'}
              className="w-full sm:w-auto text-sm px-4 py-3 sm:px-3 sm:py-2 h-12 sm:h-9 touch-target"
              style={{ minHeight: '48px', minWidth: '48px' }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Registrarse para Guardar</span>
              <span className="sm:hidden">Registrarse</span>
            </Button>
          )}
        </div>
      </div>

      {/* Budgets List */}
      <Card className="shadow-material overflow-hidden">
        <CardHeader className="border-b border-gray-200 p-4 md:p-6">
          <CardTitle className="text-base md:text-lg font-semibold text-on-surface">
            Lista de Presupuestos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="table-responsive hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Proyecto</TableHead>
                  <TableHead className="text-xs sm:text-sm">Cliente</TableHead>
                  <TableHead className="text-xs sm:text-sm">Fase</TableHead>
                  <TableHead className="text-xs sm:text-sm">Total</TableHead>
                  <TableHead className="text-xs sm:text-sm">Estado</TableHead>
                  <TableHead className="text-xs sm:text-sm">Creado</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgetsLoading ? (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <div>
                              <Skeleton className="h-4 w-32 mb-1" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell>
                          <div className="flex justify-end space-x-2">
                            <Skeleton className="w-8 h-8 rounded" />
                            <Skeleton className="w-8 h-8 rounded" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : budgets?.length ? (
                  budgets.map((budget) => {
                    const IconComponent = getProjectIcon(budget.project.name);
                    return (
                      <TableRow key={budget.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center">
                              <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                            </div>
                            <div>
                              <div className="text-xs sm:text-sm font-medium text-gray-900">
                                {budget.project.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {budget.project.location || budget.project.city}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-900 text-xs sm:text-sm">
                          {budget.project.client || 'No especificado'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {budget.phase ? budget.phase.name : "Multifase"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-xs sm:text-sm">
                          {formatCurrency(budget.total)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={budget.status === 'active' ? 'default' : 
                                    budget.status === 'completed' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {budget.status === 'active' ? 'Activo' : 
                             budget.status === 'completed' ? 'Completado' : 'Borrador'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500 text-xs">
                          {formatRelativeTime(budget.createdAt!)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end space-x-1 sm:space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.location.href = `/budgets/${budget.id}`}
                              className="text-blue-600 hover:text-blue-800 h-7 w-7 sm:h-8 sm:w-8"
                              title="Ver detalles del presupuesto"
                            >
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(budget)}
                              className="text-green-600 hover:text-green-800 h-7 w-7 sm:h-8 sm:w-8"
                              title="Editar presupuesto"
                            >
                              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadPDF(budget)}
                              className="text-purple-600 hover:text-purple-800 h-7 w-7 sm:h-8 sm:w-8"
                              title="Descargar APU completo con desglose detallado"
                            >
                              <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(`/budgets/${budget.id}`, '_blank')}
                              className="text-orange-600 hover:text-orange-800 h-7 w-7 sm:h-8 sm:w-8"
                              title="Abrir para imprimir"
                            >
                              <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 sm:h-8 sm:w-8"
                                >
                                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Se eliminará permanentemente el proyecto "{budget.project.name}" y todos sus presupuestos asociados.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteBudget(budget.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No hay presupuestos creados</p>
                      <p className="text-sm">Cree su primer presupuesto para comenzar</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden mobile-grid p-4 space-y-4">
            {budgetsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <Skeleton className="w-12 h-12 rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                    <div className="flex justify-center space-x-2 pt-2">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <Skeleton key={j} className="w-10 h-10 rounded" />
                      ))}
                    </div>
                  </div>
                </Card>
              ))
            ) : budgets?.length ? (
              budgets.map((budget) => {
                const IconComponent = getProjectIcon(budget.project.name);
                return (
                  <Card key={budget.id} className="p-4 touch-target tap-highlight-none">
                    <div className="flex items-start space-x-3 mb-3">
                      <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-on-surface truncate mb-1">
                          {budget.project.name}
                        </h3>
                        <p className="text-xs text-gray-600 truncate">
                          {budget.project.client || 'Sin cliente'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {budget.createdAt ? formatRelativeTime(budget.createdAt) : 'Fecha no disponible'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Fase:</span>
                        <span className="text-xs font-medium">
                          {budget.phase?.name || 'Multifase'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Total:</span>
                        <span className="text-sm font-bold text-primary">
                          {formatCurrency(parseFloat(budget.total))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Estado:</span>
                        <Badge variant="secondary" className="text-xs px-2 py-0">
                          {budget.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex justify-center space-x-0.5 sm:space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.location.href = `/budgets/${budget.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 touch-target h-7 w-7"
                        title="Ver detalles"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(budget)}
                        className="text-green-600 hover:text-green-800 hover:bg-green-50 touch-target h-7 w-7"
                        title="Editar presupuesto"
                      >
                        <FileText className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownloadPDF(budget)}
                        className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 touch-target h-7 w-7"
                        title="Descargar APU"
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 touch-target h-7 w-7"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="mx-4 max-w-sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-base">¿Eliminar proyecto?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm">
                              Se eliminará permanentemente "{budget.project.name}" y todos sus presupuestos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteBudget(budget.id)}
                              className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-12">
                <Calculator className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-2">No hay presupuestos creados</p>
                <p className="text-sm text-gray-400 mb-4">Cree su primer presupuesto para comenzar</p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="bg-primary text-white hover:bg-primary-variant mobile-button"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Presupuesto
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Budget Form Modal */}
      {showForm && (
        <MultiphaseBudgetForm 
          onClose={() => {
            console.log('🔴 Cerrando formulario desde componente');
            setShowForm(false);
            setEditingBudget(null);
          }}
          budget={editingBudget}
        />
      )}
    </div>
  );
}
