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
import { AnonymousWarning } from "@/components/anonymous-warning";
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
      // Para usuarios anónimos, cargar desde sessionStorage
      const anonymousProjects = JSON.parse(sessionStorage.getItem('anonymousProjects') || '[]');
      return anonymousProjects.map((project: any) => ({
        id: project.id,
        project: {
          id: project.id,
          name: project.name,
          client: project.client,
          location: project.location,
          city: project.city,
          country: project.country
        },
        total: project.total.toString(),
        status: 'active',
        createdAt: project.createdAt,
        phase: { id: 1, name: 'Temporal' }
      }));
    } : undefined,
    retry: false
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
            
            // Título APU uniforme
            doc.setFontSize(9);
            doc.text('APU:', margin, yPosition);
            yPosition += 4;

            // APU simplificado y uniforme
            doc.setFontSize(9);
            let apuText = '';
            if (apuData.breakdown?.materials?.length > 0) {
              apuText += `Mat: ${(apuData.totals?.materials || 0).toFixed(2)} `;
            }
            if (apuData.breakdown?.labor?.length > 0) {
              apuText += `M.O: ${(apuData.totals?.labor || 0).toFixed(2)} `;
            }
            if (apuData.breakdown?.equipment?.length > 0) {
              apuText += `Her: ${(apuData.totals?.equipment || 0).toFixed(2)} `;
            }
            apuText += `= Bs ${(apuData.totalUnitPrice || 0).toFixed(2)}`;
            doc.text(apuText, margin + 5, yPosition);
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
    doc.text('MICAA - Sistema Integral de Construcción y Arquitectura | Santa Cruz, Bolivia | contacto@micaa.store', pageWidth / 2, yPosition, { align: 'center' });
    
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
      {/* Advertencia para usuarios anónimos */}
      {isAnonymous && (
        <AnonymousWarning action="crear y gestionar presupuestos" />
      )}
      
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
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
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

                    <div className="flex justify-center space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.location.href = `/budgets/${budget.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 touch-target"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(budget)}
                        className="text-green-600 hover:text-green-800 hover:bg-green-50 touch-target"
                        title="Editar presupuesto"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownloadPDF(budget)}
                        className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 touch-target"
                        title="Descargar APU"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 touch-target"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
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
                              onClick={() => handleDeleteProject(budget.project.id)}
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
          budget={editingBudget}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
