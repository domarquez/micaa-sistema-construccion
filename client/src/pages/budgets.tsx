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
        title: "Generando APU completo...",
        description: "Obteniendo análisis de precios unitarios",
      });

      // Verificar autenticación
      const token = localStorage.getItem('token');
      if (!token) {
        toast({
          title: "Sesión expirada",
          description: "Por favor, inicia sesión para generar el APU completo.",
          variant: "destructive",
        });
        return;
      }

      // Verificar que el token funciona
      const authCheck = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!authCheck.ok) {
        localStorage.removeItem('token');
        toast({
          title: "Sesión expirada",
          description: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente para generar el APU.",
          variant: "destructive",
        });
        return;
      }

      // Obtener datos completos del presupuesto con items
      const budgetResponse = await fetch(`/api/budgets/${budget.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!budgetResponse.ok) {
        if (budgetResponse.status === 401) {
          localStorage.removeItem('token');
          toast({
            title: "Sesión expirada",
            description: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
            variant: "destructive",
          });
          return;
        }
        throw new Error('Error al obtener datos del presupuesto');
      }

      const budgetDetails = await budgetResponse.json();

      // Importar jsPDF dinámicamente
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

      // Procesar cada item del presupuesto
      if (budgetDetails.items && budgetDetails.items.length > 0) {
        for (let i = 0; i < budgetDetails.items.length; i++) {
          const item = budgetDetails.items[i];
          
          checkNewPage(60);
          
          // Encabezado del item
          doc.setFontSize(12);
          doc.text(`ITEM ${(i + 1).toString().padStart(2, '0')}: ${item.activity?.name || 'Actividad sin nombre'}`, margin, yPosition);
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

          // Obtener APU de la actividad si existe
          if (item.activity?.id) {
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
        title: "APU generado exitosamente",
        description: `Descargado: APU_Completo_${projectName}_${budget.id}.pdf`,
      });
      
    } catch (error) {
      console.error('Error generando APU:', error);
      
      // Fallback: generar PDF básico sin APU detallado
      toast({
        title: "Generando PDF básico...",
        description: "No se pudo obtener APU completo, generando resumen",
      });
      
      try {
        await generateBasicPDF(budget);
      } catch (fallbackError) {
        toast({
          title: "Error al generar PDF",
          description: "No se pudo crear ningún documento. Verifique su conexión.",
          variant: "destructive",
        });
      }
    }
  };

  // Función para generar PDF básico como fallback
  const generateBasicPDF = async (budget: BudgetWithProject) => {
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
    doc.text('La Paz, Bolivia | contacto@micaa.store | +591 70000000', margin, yPosition + 16);
    yPosition += 30;

    // Título del documento
    doc.setFontSize(16);
    doc.text('RESUMEN DE PRESUPUESTO', pageWidth / 2, yPosition, { align: 'center' });
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
    yPosition += 8;
    doc.text(`FASE: ${budget.phase?.name || 'Multifase'}`, margin, yPosition);
    yPosition += 20;

    // Total destacado
    doc.setFontSize(16);
    doc.text('TOTAL GENERAL:', margin, yPosition);
    doc.text(`Bs ${parseFloat(budget.total).toFixed(2)}`, margin + 120, yPosition);
    yPosition += 20;

    // Nota
    doc.setFontSize(10);
    doc.text('NOTA: Para obtener el desglose APU completo, inicie sesión', margin, yPosition);
    yPosition += 6;
    doc.text('en MICAA y utilice la función de descarga detallada.', margin, yPosition);
    yPosition += 15;

    // Condiciones
    doc.setFontSize(8);
    doc.text('CONDICIONES GENERALES:', margin, yPosition);
    yPosition += 6;
    doc.text('• Validez de la oferta: 30 días calendario', margin + 5, yPosition);
    yPosition += 4;
    doc.text('• Moneda: Bolivianos (Bs)', margin + 5, yPosition);
    yPosition += 4;
    doc.text('• Precios incluyen materiales, mano de obra y gastos generales', margin + 5, yPosition);

    // Descargar
    const projectName = budget.project?.name?.replace(/[^a-zA-Z0-9\s]/g, '') || 'proyecto';
    doc.save(`Presupuesto_Resumen_${projectName}_${budget.id}.pdf`);
    
    toast({
      title: "PDF básico generado",
      description: "Se descargó un resumen del presupuesto. Para APU completo, mantenga la sesión activa.",
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
