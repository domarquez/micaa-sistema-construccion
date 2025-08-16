import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Users, Wrench, Edit, Save, X, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { ActivityComposition } from "@shared/schema";

interface ActivityDetailDialogProps {
  activityId: number;
  activityName: string;
  unitPrice: string;
  children: React.ReactNode;
}

export default function ActivityDetailDialog({ 
  activityId, 
  activityName, 
  unitPrice,
  children 
}: ActivityDetailDialogProps) {
  const [open, setOpen] = useState(false);
  const [editingComposition, setEditingComposition] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{[key: number]: {quantity: string, unitCost: string, description: string}}>({});
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Check if this is a custom activity that can be edited
  const isCustomActivity = activityId > 10000;
  const realActivityId = isCustomActivity ? activityId - 10000 : activityId;

  const { data: compositions, isLoading } = useQuery<ActivityComposition[]>({
    queryKey: ["/api/activities", activityId, "compositions"],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/activities/${activityId}/compositions`);
      return response.json();
    },
    enabled: open && activityId > 0,
  });

  const { data: apuCalculation, isLoading: calculationLoading } = useQuery({
    queryKey: ["/api/activities", activityId, "apu-calculation"],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/activities/${activityId}/apu-calculation`);
      return response.json();
    },
    enabled: open && activityId > 0,
  });

  // Mutations for editing custom activity compositions
  const updateCompositionMutation = useMutation({
    mutationFn: async ({ compositionId, data }: { compositionId: number, data: any }) => {
      const response = await apiRequest('PUT', `/api/user-activities/${realActivityId}/compositions/${compositionId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities", activityId, "compositions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities", activityId, "apu-calculation"] });
      setEditingComposition(null);
      toast({ title: "Éxito", description: "Composición actualizada correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la composición", variant: "destructive" });
    }
  });

  const deleteCompositionMutation = useMutation({
    mutationFn: async (compositionId: number) => {
      const response = await apiRequest('DELETE', `/api/user-activities/${realActivityId}/compositions/${compositionId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities", activityId, "compositions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities", activityId, "apu-calculation"] });
      toast({ title: "Éxito", description: "Composición eliminada correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar la composición", variant: "destructive" });
    }
  });

  const addCompositionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', `/api/user-activities/${realActivityId}/compositions`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities", activityId, "compositions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities", activityId, "apu-calculation"] });
      toast({ title: "Éxito", description: "Nueva composición agregada correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo agregar la composición", variant: "destructive" });
    }
  });

  const handleEdit = (compositionId: number, composition: ActivityComposition) => {
    setEditingComposition(compositionId);
    setEditValues({
      ...editValues,
      [compositionId]: {
        quantity: composition.quantity || '0',
        unitCost: composition.unitCost || '0',
        description: composition.description || ''
      }
    });
  };

  const handleSave = (compositionId: number) => {
    const values = editValues[compositionId];
    if (values) {
      updateCompositionMutation.mutate({
        compositionId,
        data: {
          quantity: parseFloat(values.quantity),
          unitCost: parseFloat(values.unitCost),
          description: values.description
        }
      });
    }
  };

  const handleCancel = () => {
    setEditingComposition(null);
    setEditValues({});
  };

  const handleDelete = (compositionId: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta composición?')) {
      deleteCompositionMutation.mutate(compositionId);
    }
  };

  const [showAddModal, setShowAddModal] = useState<{open: boolean, type: string}>({open: false, type: ''});
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');

  // Get catalogs for selection
  const { data: materialsCatalog } = useQuery({
    queryKey: ["/api/materials"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/materials');
      return response.json();
    },
    enabled: showAddModal.open && showAddModal.type === 'material'
  });

  const { data: laborCatalog } = useQuery({
    queryKey: ["/api/labor-categories"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/labor-categories');
      return response.json();
    },
    enabled: showAddModal.open && showAddModal.type === 'labor'
  });

  const { data: toolsCatalog } = useQuery({
    queryKey: ["/api/tools"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/tools');
      return response.json();
    },
    enabled: showAddModal.open && showAddModal.type === 'equipment'
  });

  const handleAddComposition = (type: string) => {
    setShowAddModal({open: true, type});
    setSelectedItem(null);
    setQuantity('1');
  };

  const handleConfirmAdd = () => {
    if (!selectedItem) return;
    
    let compositionData;
    if (showAddModal.type === 'material') {
      compositionData = {
        type: 'material',
        materialId: selectedItem.id,
        description: selectedItem.name,
        unit: selectedItem.unit,
        quantity: parseFloat(quantity),
        unitCost: parseFloat(selectedItem.price)
      };
    } else if (showAddModal.type === 'labor') {
      compositionData = {
        type: 'labor',
        laborId: selectedItem.id,
        description: selectedItem.name,
        unit: selectedItem.unit,
        quantity: parseFloat(quantity),
        unitCost: parseFloat(selectedItem.hourlyRate)
      };
    } else if (showAddModal.type === 'equipment') {
      compositionData = {
        type: 'equipment',
        toolId: selectedItem.id,
        description: selectedItem.name,
        unit: selectedItem.unit,
        quantity: parseFloat(quantity),
        unitCost: parseFloat(selectedItem.unitPrice)
      };
    }

    addCompositionMutation.mutate(compositionData);
    setShowAddModal({open: false, type: ''});
  };

  // Group compositions by type for detailed tables
  const materials = compositions?.filter(c => c.type === 'material') || [];
  const labor = compositions?.filter(c => c.type === 'labor') || [];
  const equipment = compositions?.filter(c => c.type === 'equipment') || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Análisis de Precios Unitarios (APU)
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Desglose detallado de materiales, mano de obra y costos para: {activityName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* APU Calculation Summary */}
          {apuCalculation && !calculationLoading && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Análisis de Precios Unitarios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {/* 1. Materiales */}
                  <div className="border-b pb-2">
                    <div className="flex justify-between font-medium">
                      <span>1. MATERIALES</span>
                      <span>{formatCurrency(apuCalculation.materialsTotal)}</span>
                    </div>
                  </div>
                  
                  {/* 2. Mano de Obra */}
                  <div className="border-b pb-2">
                    <div className="flex justify-between font-medium mb-1">
                      <span>2. MANO DE OBRA</span>
                      <span></span>
                    </div>
                    <div className="ml-4 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Total mano de obra</span>
                        <span>{formatCurrency(apuCalculation.laborTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cargas sociales (55.00%)</span>
                        <span>{formatCurrency(apuCalculation.breakdown.laborCharges)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>I.V.A. de M.O. y cargas sociales (14.94%)</span>
                        <span>{formatCurrency(apuCalculation.breakdown.laborIVA)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-sm">
                        <span>Total mano de obra</span>
                        <span>{formatCurrency(apuCalculation.laborWithCharges + apuCalculation.breakdown.laborIVA)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 3. Equipos */}
                  <div className="border-b pb-2">
                    <div className="flex justify-between font-medium mb-1">
                      <span>3. EQUIPO, MAQUINARIA Y HERRAMIENTAS</span>
                      <span></span>
                    </div>
                    <div className="ml-4 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Total equipos</span>
                        <span>{formatCurrency(apuCalculation.equipmentTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Herramientas (5.00%)</span>
                        <span>{formatCurrency(apuCalculation.breakdown.tools)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-sm">
                        <span>Total equipo, maquinaria y herramientas</span>
                        <span>{formatCurrency(apuCalculation.equipmentWithTools)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 4. Gastos Generales */}
                  <div className="border-b pb-2">
                    <div className="flex justify-between font-medium">
                      <span>4. GASTOS GENERALES Y ADMINISTRATIVOS</span>
                      <span></span>
                    </div>
                    <div className="ml-4 text-xs">
                      <div className="flex justify-between font-medium">
                        <span>Gastos generales (8.00%)</span>
                        <span>{formatCurrency(apuCalculation.administrativeCost)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 5. Utilidad */}
                  <div className="border-b pb-2">
                    <div className="flex justify-between font-medium">
                      <span>5. UTILIDAD</span>
                      <span></span>
                    </div>
                    <div className="ml-4 text-xs">
                      <div className="flex justify-between font-medium">
                        <span>Utilidad (15.00%)</span>
                        <span>{formatCurrency(apuCalculation.utilityCost)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 6. Impuestos */}
                  <div className="border-b pb-2">
                    <div className="flex justify-between font-medium">
                      <span>6. IMPUESTOS</span>
                      <span></span>
                    </div>
                    <div className="ml-4 text-xs">
                      <div className="flex justify-between font-medium">
                        <span>IT (3.09%)</span>
                        <span>{formatCurrency(apuCalculation.taxCost)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Total Final */}
                  <div className="bg-blue-50 p-3 rounded-lg mt-3">
                    <div className="flex justify-between text-base font-bold">
                      <span>Total Precio Unitario</span>
                      <span>{formatCurrency(apuCalculation.totalUnitPrice)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Compositions Tables */}
          {compositions && compositions.length > 0 && (
            <div className="space-y-4">
              {/* Materials Detail */}
              {materials.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      Materiales
                      <Badge variant="outline">{materials.length} items</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-gray-600">
                        Total materiales: {formatCurrency(materials.reduce((sum, m) => sum + parseFloat(m.quantity) * parseFloat(m.unitCost), 0))}
                      </div>
                      {isCustomActivity && user && (
                        <Button size="sm" onClick={() => handleAddComposition('material')}>
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar Material
                        </Button>
                      )}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Unidad</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Precio Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          {isCustomActivity && user && <TableHead className="text-right">Acciones</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materials.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {editingComposition === item.id ? (
                                <Input
                                  value={editValues[item.id]?.description || ''}
                                  onChange={(e) => setEditValues({
                                    ...editValues,
                                    [item.id]: { ...editValues[item.id], description: e.target.value }
                                  })}
                                  className="w-full"
                                />
                              ) : item.description}
                            </TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell className="text-right">
                              {editingComposition === item.id ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editValues[item.id]?.quantity || '0'}
                                  onChange={(e) => setEditValues({
                                    ...editValues,
                                    [item.id]: { ...editValues[item.id], quantity: e.target.value }
                                  })}
                                  className="w-20 text-right"
                                />
                              ) : parseFloat(item.quantity).toFixed(3)}
                            </TableCell>
                            <TableCell className="text-right">
                              {editingComposition === item.id ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editValues[item.id]?.unitCost || '0'}
                                  onChange={(e) => setEditValues({
                                    ...editValues,
                                    [item.id]: { ...editValues[item.id], unitCost: e.target.value }
                                  })}
                                  className="w-24 text-right"
                                />
                              ) : formatCurrency(parseFloat(item.unitCost))}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {editingComposition === item.id ? 
                                formatCurrency(
                                  parseFloat(editValues[item.id]?.quantity || '0') * 
                                  parseFloat(editValues[item.id]?.unitCost || '0')
                                ) :
                                formatCurrency(parseFloat(item.quantity) * parseFloat(item.unitCost))
                              }
                            </TableCell>
                            {isCustomActivity && user && (
                              <TableCell className="text-right">
                                {editingComposition === item.id ? (
                                  <div className="flex gap-1">
                                    <Button size="sm" onClick={() => handleSave(item.id)} disabled={updateCompositionMutation.isPending}>
                                      <Save className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleCancel}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="outline" onClick={() => handleEdit(item.id, item)}>
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleDelete(item.id)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Labor Detail */}
              {labor.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-600" />
                      Mano de Obra
                      <Badge variant="outline">{labor.length} items</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-gray-600">
                        Total mano de obra: {formatCurrency(labor.reduce((sum, l) => sum + parseFloat(l.quantity) * parseFloat(l.unitCost), 0))}
                      </div>
                      {isCustomActivity && user && (
                        <Button size="sm" onClick={() => handleAddComposition('labor')}>
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar Mano de Obra
                        </Button>
                      )}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Unidad</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Precio Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          {isCustomActivity && user && <TableHead className="text-right">Acciones</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {labor.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {editingComposition === item.id ? (
                                <Input
                                  value={editValues[item.id]?.description || ''}
                                  onChange={(e) => setEditValues({
                                    ...editValues,
                                    [item.id]: { ...editValues[item.id], description: e.target.value }
                                  })}
                                  className="w-full"
                                />
                              ) : item.description}
                            </TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell className="text-right">
                              {editingComposition === item.id ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editValues[item.id]?.quantity || '0'}
                                  onChange={(e) => setEditValues({
                                    ...editValues,
                                    [item.id]: { ...editValues[item.id], quantity: e.target.value }
                                  })}
                                  className="w-20 text-right"
                                />
                              ) : parseFloat(item.quantity).toFixed(3)}
                            </TableCell>
                            <TableCell className="text-right">
                              {editingComposition === item.id ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editValues[item.id]?.unitCost || '0'}
                                  onChange={(e) => setEditValues({
                                    ...editValues,
                                    [item.id]: { ...editValues[item.id], unitCost: e.target.value }
                                  })}
                                  className="w-24 text-right"
                                />
                              ) : formatCurrency(parseFloat(item.unitCost))}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {editingComposition === item.id ? 
                                formatCurrency(
                                  parseFloat(editValues[item.id]?.quantity || '0') * 
                                  parseFloat(editValues[item.id]?.unitCost || '0')
                                ) :
                                formatCurrency(parseFloat(item.quantity) * parseFloat(item.unitCost))
                              }
                            </TableCell>
                            {isCustomActivity && user && (
                              <TableCell className="text-right">
                                {editingComposition === item.id ? (
                                  <div className="flex gap-1">
                                    <Button size="sm" onClick={() => handleSave(item.id)} disabled={updateCompositionMutation.isPending}>
                                      <Save className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleCancel}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="outline" onClick={() => handleEdit(item.id, item)}>
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleDelete(item.id)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Equipment Detail */}
              {equipment.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-orange-600" />
                      Equipos
                      <Badge variant="outline">{equipment.length} items</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Unidad</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Precio Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {equipment.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.description}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell className="text-right">{parseFloat(item.quantity).toFixed(3)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(parseFloat(item.unitCost))}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(parseFloat(item.quantity) * parseFloat(item.unitCost))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {isLoading || calculationLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !apuCalculation ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No hay composiciones disponibles para esta actividad</p>
                <p className="text-sm">Las composiciones se crean y gestionan dentro del sistema MICAA</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </DialogContent>

      {/* Add Composition Modal */}
      <Dialog open={showAddModal.open} onOpenChange={(open) => setShowAddModal({open, type: showAddModal.type})}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Agregar {showAddModal.type === 'material' ? 'Material' : showAddModal.type === 'labor' ? 'Mano de Obra' : 'Equipo'}
            </DialogTitle>
            <DialogDescription>
              Selecciona un elemento del catálogo y especifica la cantidad
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {showAddModal.type === 'material' && materialsCatalog && (
              <div>
                <label className="block text-sm font-medium mb-2">Material:</label>
                <Select value={selectedItem?.id?.toString() || ""} onValueChange={(value) => {
                  const material = materialsCatalog.find((m: any) => m.id.toString() === value);
                  setSelectedItem(material);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materialsCatalog.map((material: any) => (
                      <SelectItem key={material.id} value={material.id.toString()}>
                        {material.name} - {formatCurrency(parseFloat(material.price))} / {material.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showAddModal.type === 'labor' && laborCatalog && (
              <div>
                <label className="block text-sm font-medium mb-2">Mano de Obra:</label>
                <Select value={selectedItem?.id?.toString() || ""} onValueChange={(value) => {
                  const labor = laborCatalog.find((l: any) => l.id.toString() === value);
                  setSelectedItem(labor);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona mano de obra" />
                  </SelectTrigger>
                  <SelectContent>
                    {laborCatalog.map((labor: any) => (
                      <SelectItem key={labor.id} value={labor.id.toString()}>
                        {labor.name} - {formatCurrency(parseFloat(labor.hourlyRate))} / {labor.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showAddModal.type === 'equipment' && toolsCatalog && (
              <div>
                <label className="block text-sm font-medium mb-2">Equipo:</label>
                <Select value={selectedItem?.id?.toString() || ""} onValueChange={(value) => {
                  const tool = toolsCatalog.find((t: any) => t.id.toString() === value);
                  setSelectedItem(tool);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un equipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {toolsCatalog.map((tool: any) => (
                      <SelectItem key={tool.id} value={tool.id.toString()}>
                        {tool.name} - {formatCurrency(parseFloat(tool.unitPrice))} / {tool.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Cantidad:</label>
              <Input
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ingresa la cantidad"
              />
            </div>

            {selectedItem && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium">Resumen:</h4>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedItem.name} × {quantity} {selectedItem.unit}
                </p>
                <p className="text-sm font-medium mt-1">
                  Costo unitario: {formatCurrency(parseFloat(
                    selectedItem.price || selectedItem.hourlyRate || selectedItem.unitPrice
                  ))}
                </p>
                <p className="text-sm font-medium">
                  Total: {formatCurrency(
                    parseFloat(quantity || '0') * parseFloat(
                      selectedItem.price || selectedItem.hourlyRate || selectedItem.unitPrice
                    )
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddModal({open: false, type: ''})}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmAdd} 
              disabled={!selectedItem || addCompositionMutation.isPending}
            >
              {addCompositionMutation.isPending ? 'Agregando...' : 'Agregar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}