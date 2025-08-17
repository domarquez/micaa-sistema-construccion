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
        title: "Generando PDF completo...",
        description: "Obteniendo detalles de la cotización",
      });

      // Obtener token de autenticación
      const token = localStorage.getItem('token');
      if (!token) {
        toast({
          title: "Sesión expirada",
          description: "Por favor, inicia sesión nuevamente.",
          variant: "destructive",
        });
        return;
      }

      // Obtener datos completos del presupuesto
      const response = await fetch(`/api/budgets/${budget.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Sesión expirada",
            description: "Por favor, inicia sesión nuevamente.",
            variant: "destructive",
          });
          return;
        }
        throw new Error('Error al obtener datos del presupuesto');
      }

      const budgetDetails = await response.json();

      // Importar jsPDF dinámicamente
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
      doc.text('COTIZACION DETALLADA DE CONSTRUCCION', pageWidth / 2, yPosition, { align: 'center' });
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
      yPosition += 8;
      doc.text(`FASE: ${budget.phase?.name || 'Multifase'}`, margin, yPosition);
      yPosition += 15;

      // Encabezado de tabla detallada
      doc.setFontSize(9);
      doc.text('ITEM', margin, yPosition);
      doc.text('DESCRIPCION', margin + 15, yPosition);
      doc.text('UND', margin + 100, yPosition);
      doc.text('CANT.', margin + 115, yPosition);
      doc.text('P.UNIT. (Bs)', margin + 135, yPosition);
      doc.text('TOTAL (Bs)', margin + 165, yPosition);
      yPosition += 5;

      // Línea separadora
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      let totalGeneral = 0;

      // Items del presupuesto con detalles completos
      if (budgetDetails.items && budgetDetails.items.length > 0) {
        budgetDetails.items.forEach((item: any, index: number) => {
          // Verificar si necesita nueva página
          if (yPosition > 260) {
            doc.addPage();
            yPosition = 30;
            
            // Repetir encabezado en nueva página
            doc.setFontSize(9);
            doc.text('ITEM', margin, yPosition);
            doc.text('DESCRIPCION', margin + 15, yPosition);
            doc.text('UND', margin + 100, yPosition);
            doc.text('CANT.', margin + 115, yPosition);
            doc.text('P.UNIT. (Bs)', margin + 135, yPosition);
            doc.text('TOTAL (Bs)', margin + 165, yPosition);
            yPosition += 5;
            doc.line(margin, yPosition, pageWidth - margin, yPosition);
            yPosition += 8;
          }
          
          const itemNumber = (index + 1).toString().padStart(2, '0');
          const quantity = parseFloat(item.quantity || 0);
          const unitPrice = parseFloat(item.unitPrice || 0);
          const subtotal = parseFloat(item.subtotal || 0);
          
          totalGeneral += subtotal;
          
          let activityName = item.activity?.name || 'Actividad sin nombre';
          
          // Verificar si es actividad personalizada
          if (item.isCustomActivity) {
            activityName += ' (Personalizada)';
          }
          
          // Truncar nombre si es muy largo
          if (activityName.length > 35) {
            activityName = activityName.substring(0, 32) + '...';
          }
          
          doc.setFontSize(8);
          doc.text(itemNumber, margin, yPosition);
          doc.text(activityName, margin + 15, yPosition);
          doc.text(item.activity?.unit || 'und', margin + 100, yPosition);
          doc.text(quantity.toFixed(2), margin + 115, yPosition, { align: 'right' });
          doc.text(unitPrice.toFixed(2), margin + 150, yPosition, { align: 'right' });
          doc.text(subtotal.toFixed(2), margin + 185, yPosition, { align: 'right' });
          yPosition += 6;
        });
      } else {
        doc.setFontSize(10);
        doc.text('No hay actividades registradas en este presupuesto', margin, yPosition);
        yPosition += 10;
      }

      // Separador antes del total
      yPosition += 10;
      doc.line(margin + 130, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // Total general
      doc.setFontSize(12);
      doc.text('TOTAL GENERAL:', margin + 100, yPosition);
      doc.text(`Bs ${totalGeneral.toFixed(2)}`, margin + 185, yPosition, { align: 'right' });
      yPosition += 15;

      // Información adicional
      doc.setFontSize(8);
      doc.text('CONDICIONES GENERALES:', margin, yPosition);
      yPosition += 6;
      doc.text('• Los precios incluyen materiales, mano de obra y gastos generales', margin + 5, yPosition);
      yPosition += 4;
      doc.text('• Validez de la oferta: 30 días calendario', margin + 5, yPosition);
      yPosition += 4;
      doc.text('• Moneda: Bolivianos (Bs)', margin + 5, yPosition);
      yPosition += 4;
      doc.text('• Precios sujetos a variación según disponibilidad de materiales', margin + 5, yPosition);
      yPosition += 10;

      // Pie de página profesional
      doc.setFontSize(7);
      doc.text('Este presupuesto ha sido elaborado con MICAA - Sistema Integral de Construcción', pageWidth / 2, yPosition, { align: 'center' });
      doc.text('www.micaa.store | contacto@micaa.store | La Paz, Bolivia', pageWidth / 2, yPosition + 5, { align: 'center' });
      
      // Descargar PDF
      const projectName = budget.project?.name?.replace(/[^a-zA-Z0-9\s]/g, '') || 'proyecto';
      doc.save(`Cotizacion_Completa_${projectName}_${budget.id}.pdf`);
      
      toast({
        title: "Cotización PDF generada",
        description: `Descargado: Cotizacion_Completa_${projectName}_${budget.id}.pdf`,
      });
      
    } catch (error) {
      console.error('Error generando PDF:', error);
      toast({
        title: "Error al generar PDF",
        description: "Problema al obtener los datos. Verifique su conexión e intente nuevamente.",
        variant: "destructive",
      });
    }
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
                              title="Descargar PDF del presupuesto"
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
