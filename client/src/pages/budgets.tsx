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
  Printer
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import MultiphaseBudgetForm from "@/components/budgets/multi-phase-budget-form";
import type { BudgetWithProject } from "@shared/schema";

export default function Budgets() {
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithProject | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();

  // Auto-open form when accessing /budgets/new
  useEffect(() => {
    if (location === '/budgets/new') {
      setShowForm(true);
    }
  }, [location]);

  const { data: budgets, isLoading: budgetsLoading } = useQuery<BudgetWithProject[]>({
    queryKey: ["/api/budgets"],
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Proyecto eliminado",
        description: "El proyecto y todos sus presupuestos han sido eliminados correctamente.",
      });
    },
    onError: (error) => {
      console.error('Error deleting project:', error);
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar el proyecto. Inténtelo nuevamente.",
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
    // Navigate back to budgets list if on new budget route
    if (location === '/budgets/new') {
      window.history.pushState(null, '', '/budgets');
    }
  };

  const handleDeleteProject = (projectId: number) => {
    deleteProjectMutation.mutate(projectId);
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

    // Encabezado empresarial más profesional
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('MICAA', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistema Integral de Construcción y Arquitectura', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
    
    doc.setFontSize(10);
    doc.text('Santa Cruz, Bolivia | contacto@micaa.store', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Línea decorativa
    doc.setLineWidth(1.5);
    doc.setDrawColor(0, 100, 150); // Color azul empresarial
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 20;

    // Título del documento con mejor diseño
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 100, 150); // Color azul para el título
    doc.text('ANÁLISIS DE PRECIOS UNITARIOS (APU)', pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0); // Volver a color negro
    doc.setFont('helvetica', 'normal');
    yPosition += 25;

    // Información del proyecto en formato tabla profesional
    checkNewPage(50);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DEL PROYECTO', margin, yPosition);
    yPosition += 10;
    
    // Fondo gris para la información del proyecto
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 45, 'F');
    
    // Líneas divisorias
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    // Primera columna
    doc.text('PROYECTO:', margin + 5, yPosition + 5);
    doc.text('CLIENTE:', margin + 5, yPosition + 15);
    doc.text('UBICACIÓN:', margin + 5, yPosition + 25);
    
    // Segunda columna - valores
    doc.setFont('helvetica', 'normal');
    doc.text(budget.project?.name || 'Sin nombre', margin + 50, yPosition + 5);
    doc.text(budget.project?.client || 'No especificado', margin + 50, yPosition + 15);
    doc.text(`${budget.project?.location || 'No especificada'}, ${budget.project?.city || 'Sin ciudad'}`, margin + 50, yPosition + 25);
    
    // Tercera columna
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA:', margin + 110, yPosition + 5);
    doc.text('PRESUPUESTO #:', margin + 110, yPosition + 15);
    doc.text('ESTADO:', margin + 110, yPosition + 25);
    
    // Cuarta columna - valores
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('es-BO'), margin + 155, yPosition + 5);
    doc.text(budget.id.toString(), margin + 155, yPosition + 15);
    doc.text(budget.status === 'active' ? 'ACTIVO' : budget.status.toUpperCase(), margin + 155, yPosition + 25);
    
    yPosition += 50;

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
      
      // Título de la fase más profesional
      doc.setFillColor(0, 100, 150); // Fondo azul
      doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, 12, 'F');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255); // Texto blanco
      doc.text(`FASE: ${phaseName}`, margin + 5, yPosition + 5);
      doc.setTextColor(0, 0, 0); // Volver a negro
      doc.setFont('helvetica', 'normal');
      yPosition += 20;

      // Procesar items de esta fase
      for (let index = 0; index < (phaseItems as any[]).length; index++) {
        const item = (phaseItems as any[])[index];
        checkNewPage(60);
        
        // Encabezado del item más compacto
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPosition - 1, pageWidth - 2 * margin, 12, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${(index + 1).toString().padStart(2, '0')}. ${item.activity?.name || 'Actividad sin nombre'}`, margin + 2, yPosition + 4);
        if (item.activity?.isCustomActivity) {
          doc.setTextColor(150, 0, 150);
          doc.text('(P)', margin + 2, yPosition + 8);
          doc.setTextColor(0, 0, 0);
        }
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`${item.activity?.unit || 'und'} | Cant: ${parseFloat(item.quantity || 0).toFixed(2)} | P.U: ${parseFloat(item.unitPrice || 0).toFixed(2)}`, margin + 100, yPosition + 4);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`Bs ${parseFloat(item.subtotal || 0).toFixed(2)}`, margin + 150, yPosition + 8);
        doc.setFont('helvetica', 'normal');
        yPosition += 15;

        totalGeneral += parseFloat(item.subtotal || 0);

        // Obtener APU de la actividad si existe y tenemos token
        if (item.activity?.id && token) {
          try {
            const apuResponse = await fetch(`/api/activities/${item.activity.id}/apu-calculation`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (apuResponse.ok) {
              const apuData = await apuResponse.json();
            
            // Título APU compacto
            doc.setFontSize(8);
            doc.text('COMPOSICIÓN APU:', margin, yPosition);
            yPosition += 5;

            // Encabezados compactos
            doc.setFontSize(7);
            doc.text('DESCRIPCIÓN', margin, yPosition);
            doc.text('UND', margin + 70, yPosition);
            doc.text('CANT', margin + 90, yPosition);
            doc.text('P.U', margin + 110, yPosition);
            doc.text('TOTAL', margin + 130, yPosition);
            yPosition += 3;
            doc.line(margin, yPosition, pageWidth - margin, yPosition);
            yPosition += 3;

            // Materiales compacto
            if (apuData.breakdown?.materials?.length > 0) {
              doc.setFontSize(7);
              doc.text('MAT:', margin, yPosition);
              yPosition += 3;
              
              apuData.breakdown.materials.forEach((material: any) => {
                checkNewPage(5);
                doc.text((material.name || 'Material').substring(0, 25), margin + 5, yPosition);
                doc.text(material.unit || 'und', margin + 70, yPosition);
                doc.text((material.quantity || 0).toFixed(1), margin + 90, yPosition);
                doc.text((material.unitCost || 0).toFixed(1), margin + 110, yPosition);
                doc.text((material.subtotal || 0).toFixed(2), margin + 130, yPosition);
                yPosition += 3;
              });
              yPosition += 2;
            }

            // Mano de obra compacto
            if (apuData.breakdown?.labor?.length > 0) {
              checkNewPage(8);
              doc.setFontSize(7);
              doc.text('M.O:', margin, yPosition);
              yPosition += 3;
              
              apuData.breakdown.labor.forEach((labor: any) => {
                checkNewPage(5);
                doc.text((labor.name || 'Trabajador').substring(0, 25), margin + 5, yPosition);
                doc.text(labor.unit || 'hr', margin + 70, yPosition);
                doc.text((labor.quantity || 0).toFixed(1), margin + 90, yPosition);
                doc.text((labor.unitCost || 0).toFixed(1), margin + 110, yPosition);
                doc.text((labor.subtotal || 0).toFixed(2), margin + 130, yPosition);
                yPosition += 3;
              });
              yPosition += 2;
            }

            // Herramientas compacto
            if (apuData.breakdown?.equipment?.length > 0) {
              checkNewPage(8);
              doc.setFontSize(7);
              doc.text('HER:', margin, yPosition);
              yPosition += 3;
              
              apuData.breakdown.equipment.forEach((equipment: any) => {
                checkNewPage(5);
                doc.text((equipment.name || 'Herramienta').substring(0, 25), margin + 5, yPosition);
                doc.text(equipment.unit || 'hr', margin + 70, yPosition);
                doc.text((equipment.quantity || 0).toFixed(1), margin + 90, yPosition);
                doc.text((equipment.unitCost || 0).toFixed(1), margin + 110, yPosition);
                doc.text((equipment.subtotal || 0).toFixed(2), margin + 130, yPosition);
                yPosition += 3;
              });
              yPosition += 2;
            }

            // Resumen del APU compacto
            checkNewPage(12);
            doc.line(margin + 90, yPosition, pageWidth - margin, yPosition);
            yPosition += 3;
            doc.setFontSize(7);
            doc.text(`Mat: ${(apuData.totals?.materials || 0).toFixed(2)} | M.O: ${(apuData.totals?.labor || 0).toFixed(2)} | Her: ${(apuData.totals?.equipment || 0).toFixed(2)}`, margin + 90, yPosition);
            yPosition += 3;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(`TOTAL APU: Bs ${(apuData.totalUnitPrice || 0).toFixed(2)}`, margin + 90, yPosition);
            doc.setFont('helvetica', 'normal');
            yPosition += 8;
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

    // Total general final con mejor diseño
    checkNewPage(50);
    
    // Fondo para el resumen final
    doc.setFillColor(0, 100, 150);
    doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 30, 'F');
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('RESUMEN GENERAL DEL PRESUPUESTO', pageWidth / 2, yPosition + 8, { align: 'center' });
    
    doc.setFontSize(16);
    doc.text(`TOTAL GENERAL: Bs ${totalGeneral.toFixed(2)}`, pageWidth / 2, yPosition + 20, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    yPosition += 40;

    // Pie de página profesional
    checkNewPage(25);
    yPosition += 10;
    
    // Línea divisoria
    doc.setDrawColor(0, 100, 150);
    doc.setLineWidth(1);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Este Análisis de Precios Unitarios ha sido elaborado con', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
    
    doc.setFont('helvetica', 'bold');
    doc.text('MICAA - Sistema Integral de Construcción y Arquitectura', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.text('Santa Cruz, Bolivia | contacto@micaa.store', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    
    // Nota legal de responsabilidad
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('NOTA LEGAL: MICAA se exime de toda responsabilidad por los precios expuestos,', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;
    doc.text('los cuales son referenciales y sujetos a modificaciones de precios y diseño.', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;
    doc.text('Es responsabilidad del creador del presupuesto verificar y ofrecer precios actualizados.', pageWidth / 2, yPosition, { align: 'center' });
    
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
    doc.text('Santa Cruz, Bolivia | contacto@micaa.store', pageWidth / 2, yPosition, { align: 'center' });
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
      {/* Budgets Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-on-surface">Gestión de Presupuestos</h2>
          <p className="text-sm md:text-base text-gray-600">Crear y administrar presupuestos de construcción</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-primary text-white hover:bg-primary-variant shadow-material w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Nuevo Presupuesto</span>
          <span className="sm:hidden">Nuevo</span>
        </Button>
      </div>

      {/* Budgets List */}
      <Card className="shadow-material overflow-hidden">
        <CardHeader className="border-b border-gray-200 p-4 md:p-6">
          <CardTitle className="text-base md:text-lg font-semibold text-on-surface">
            Lista de Presupuestos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
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
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                              <IconComponent className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {budget.project.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {budget.project.location || budget.project.city}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-900">
                          {budget.project.client || 'No especificado'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {budget.phase ? budget.phase.name : "Multifase"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(budget.total)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={budget.status === 'active' ? 'default' : 
                                    budget.status === 'completed' ? 'secondary' : 'outline'}
                          >
                            {budget.status === 'active' ? 'Activo' : 
                             budget.status === 'completed' ? 'Completado' : 'Borrador'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {formatRelativeTime(budget.createdAt!)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.location.href = `/budgets/${budget.id}`}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver detalles del presupuesto"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(budget)}
                              className="text-green-600 hover:text-green-800"
                              title="Editar presupuesto"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadPDF(budget)}
                              className="text-purple-600 hover:text-purple-800"
                              title="Descargar APU completo con desglose detallado"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(`/budgets/${budget.id}`, '_blank')}
                              className="text-orange-600 hover:text-orange-800"
                              title="Abrir para imprimir"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
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
                                    onClick={() => handleDeleteProject(budget.project.id)}
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
        </CardContent>
      </Card>

      {/* Budget Form Modal */}
      {showForm && (
        <MultiphaseBudgetForm
          budget={editingBudget}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
