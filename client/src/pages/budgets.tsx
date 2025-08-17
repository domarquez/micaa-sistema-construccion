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

      // Intentar obtener datos completos del presupuesto con autenticación
      const token = localStorage.getItem('token');
      let budgetDetails = null;
      
      if (token) {
        try {
          const budgetResponse = await fetch(`/api/budgets/${budget.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (budgetResponse.ok) {
            budgetDetails = await budgetResponse.json();
            console.log('✅ Datos del presupuesto obtenidos exitosamente');
          } else {
            console.log('❌ Error de autenticación:', budgetResponse.status);
          }
        } catch (error) {
          console.log('❌ Error de conexión:', error);
        }
      } else {
        console.log('❌ Sin token disponible');
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

    // Encabezado empresarial
    doc.setFontSize(18);
    doc.text('MICAA', margin, yPosition);
    doc.setFontSize(10);
    doc.text('Sistema Integral de Construccion y Arquitectura', margin, yPosition + 8);
    doc.text('La Paz, Bolivia | contacto@micaa.store | +591 70000000', margin, yPosition + 16);
    yPosition += 30;

    // Título del documento
    doc.setFontSize(16);
    doc.text('ANALISIS DE PRECIOS UNITARIOS (APU)', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Información del proyecto
    doc.setFontSize(11);
    doc.text(`PROYECTO: ${budget.project?.name || 'Sin nombre'}`, margin, yPosition);
    yPosition += 8;
    doc.text(`CLIENTE: ${budget.project?.client || 'No especificado'}`, margin, yPosition);
    yPosition += 8;
    doc.text(`UBICACION: ${budget.project?.location || 'No especificada'}`, margin, yPosition);
    yPosition += 8;
    doc.text(`FECHA: ${new Date().toLocaleDateString('es-BO')}`, margin, yPosition);
    yPosition += 8;
    doc.text(`PRESUPUESTO #${budget.id}`, margin, yPosition);
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
      
      // Título de la fase
      doc.setFontSize(14);
      doc.text(`FASE: ${phaseName}`, margin, yPosition);
      yPosition += 8;
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 12;

      // Procesar items de esta fase
      for (let index = 0; index < (phaseItems as any[]).length; index++) {
        const item = (phaseItems as any[])[index];
        checkNewPage(60);
        
        // Encabezado del item
        doc.setFontSize(12);
        doc.text(`ITEM ${(index + 1).toString().padStart(2, '0')}: ${item.activity?.name || 'Actividad sin nombre'}`, margin, yPosition);
        if (item.isCustomActivity) {
          doc.text('(Personalizada)', margin + 120, yPosition);
        }
        yPosition += 8;

        doc.setFontSize(10);
        doc.text(`Unidad: ${item.activity?.unit || 'und'}`, margin, yPosition);
        doc.text(`Cantidad: ${parseFloat(item.quantity || 0).toFixed(2)}`, margin + 60, yPosition);
        doc.text(`P. Unit: Bs ${parseFloat(item.unitPrice || 0).toFixed(2)}`, margin + 120, yPosition);
        yPosition += 6;
        doc.text(`Subtotal: Bs ${parseFloat(item.subtotal || 0).toFixed(2)}`, margin, yPosition);
        yPosition += 10;

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
            
            // Título APU
            doc.setFontSize(9);
            doc.text('COMPOSICION Y ANALISIS DE PRECIOS:', margin, yPosition);
            yPosition += 8;

            // Encabezados de tabla
            doc.setFontSize(8);
            doc.text('DESCRIPCION', margin, yPosition);
            doc.text('UND', margin + 80, yPosition);
            doc.text('CANT', margin + 100, yPosition);
            doc.text('P.UNIT', margin + 120, yPosition);
            doc.text('PARCIAL', margin + 145, yPosition);
            yPosition += 5;
            doc.line(margin, yPosition, pageWidth - margin, yPosition);
            yPosition += 5;

            // Materiales
            if (apuData.breakdown?.materials?.length > 0) {
              doc.setFontSize(8);
              doc.text('MATERIALES:', margin, yPosition);
              yPosition += 5;
              
              apuData.breakdown.materials.forEach((material: any) => {
                checkNewPage(8);
                doc.text(material.name || 'Material', margin + 5, yPosition);
                doc.text(material.unit || 'und', margin + 80, yPosition);
                doc.text((material.quantity || 0).toFixed(2), margin + 100, yPosition);
                doc.text((material.unitCost || 0).toFixed(2), margin + 120, yPosition);
                doc.text((material.subtotal || 0).toFixed(2), margin + 145, yPosition);
                yPosition += 4;
              });
              yPosition += 3;
            }

            // Mano de obra
            if (apuData.breakdown?.labor?.length > 0) {
              checkNewPage(15);
              doc.text('MANO DE OBRA:', margin, yPosition);
              yPosition += 5;
              
              apuData.breakdown.labor.forEach((labor: any) => {
                checkNewPage(8);
                doc.text(labor.name || 'Trabajador', margin + 5, yPosition);
                doc.text(labor.unit || 'hr', margin + 80, yPosition);
                doc.text((labor.quantity || 0).toFixed(2), margin + 100, yPosition);
                doc.text((labor.unitCost || 0).toFixed(2), margin + 120, yPosition);
                doc.text((labor.subtotal || 0).toFixed(2), margin + 145, yPosition);
                yPosition += 4;
              });
              yPosition += 3;
            }

            // Herramientas y equipos
            if (apuData.breakdown?.equipment?.length > 0) {
              checkNewPage(15);
              doc.text('HERRAMIENTAS Y EQUIPOS:', margin, yPosition);
              yPosition += 5;
              
              apuData.breakdown.equipment.forEach((equipment: any) => {
                checkNewPage(8);
                doc.text(equipment.name || 'Herramienta', margin + 5, yPosition);
                doc.text(equipment.unit || 'hr', margin + 80, yPosition);
                doc.text((equipment.quantity || 0).toFixed(2), margin + 100, yPosition);
                doc.text((equipment.unitCost || 0).toFixed(2), margin + 120, yPosition);
                doc.text((equipment.subtotal || 0).toFixed(2), margin + 145, yPosition);
                yPosition += 4;
              });
              yPosition += 3;
            }

            // Resumen del APU
            checkNewPage(20);
            doc.line(margin + 100, yPosition, pageWidth - margin, yPosition);
            yPosition += 5;
            doc.setFontSize(9);
            doc.text('RESUMEN APU:', margin + 80, yPosition);
            yPosition += 5;
            doc.text(`Materiales: Bs ${(apuData.totals?.materials || 0).toFixed(2)}`, margin + 80, yPosition);
            yPosition += 4;
            doc.text(`Mano de obra: Bs ${(apuData.totals?.labor || 0).toFixed(2)}`, margin + 80, yPosition);
            yPosition += 4;
            doc.text(`Herramientas: Bs ${(apuData.totals?.equipment || 0).toFixed(2)}`, margin + 80, yPosition);
            yPosition += 4;
            doc.setFontSize(10);
            doc.text(`TOTAL APU: Bs ${(apuData.totalUnitPrice || 0).toFixed(2)}`, margin + 80, yPosition);
            yPosition += 10;
          }
        } catch (error) {
          console.log(`Error obteniendo APU para actividad ${item.activity.id}:`, error);
          doc.setFontSize(8);
          doc.text('APU no disponible para esta actividad', margin, yPosition);
          yPosition += 8;
        }
      }

        // Separador entre items
        yPosition += 5;
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 10;
      }

      // Subtotal de la fase
      const phaseTotal = (phaseItems as any[]).reduce((total: number, item: any) => total + parseFloat(item.subtotal || 0), 0);
      checkNewPage(15);
      doc.setFontSize(11);
      doc.text(`SUBTOTAL FASE ${phaseName}: Bs ${phaseTotal.toFixed(2)}`, margin, yPosition);
      yPosition += 15;
    }

    // Total general final
    checkNewPage(30);
    doc.setFontSize(14);
    doc.text('RESUMEN GENERAL DEL PRESUPUESTO', margin, yPosition);
    yPosition += 10;
    doc.setFontSize(12);
    doc.text(`TOTAL GENERAL: Bs ${totalGeneral.toFixed(2)}`, margin, yPosition);
    yPosition += 15;

    // Pie de página
    doc.setFontSize(7);
    doc.text('Este APU ha sido elaborado con MICAA - Sistema Integral de Construcción', pageWidth / 2, yPosition, { align: 'center' });
    
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

    // Encabezado empresarial
    doc.setFontSize(18);
    doc.text('MICAA', margin, yPosition);
    doc.setFontSize(10);
    doc.text('Sistema Integral de Construccion y Arquitectura', margin, yPosition + 8);
    doc.text('La Paz, Bolivia | contacto@micaa.store | +591 70000000', margin, yPosition + 16);
    yPosition += 30;

    // Título del documento
    doc.setFontSize(16);
    doc.text('PRESUPUESTO DE OBRA', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

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
