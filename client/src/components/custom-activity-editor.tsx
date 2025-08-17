import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Edit3, 
  Save, 
  X, 
  Trash2, 
  Package, 
  Users, 
  Wrench,
  Calculator,
  ArrowLeft
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CustomActivity {
  id: number;
  userId: number;
  name: string;
  unit: string;
  description?: string;
  phaseId: number;
  phase?: { id: number; name: string; };
  createdAt: string;
  updatedAt: string;
}

interface Composition {
  id: number;
  customActivityId: number;
  materialId?: number;
  laborId?: number;
  toolId?: number;
  description: string;
  unit: string;
  quantity: string;
  unitCost: string;
  type: 'material' | 'labor' | 'equipment';
  createdAt: string;
  updatedAt: string;
}

interface CustomActivityEditorProps {
  activity: CustomActivity;
  onBack: () => void;
}

export default function CustomActivityEditor({ activity, onBack }: CustomActivityEditorProps) {
  const [activeTab, setActiveTab] = useState("materials");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newComposition, setNewComposition] = useState({
    description: "",
    unit: "",
    quantity: "",
    unitCost: "",
    type: "material",
    materialId: "",
    laborId: "",
    toolId: "",
    isNewMaterial: false,
    selectedCategoryId: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load compositions for this activity
  const { data: compositions = [], isLoading } = useQuery({
    queryKey: ['/api/custom-activities', activity.id, 'compositions'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/custom-activities/${activity.id}/compositions`);
      return response.json();
    }
  });

  // Load material categories for selection
  const { data: materialCategories = [] } = useQuery({
    queryKey: ['/api/material-categories'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/material-categories');
      return response.json();
    }
  });

  // Load materials filtered by category
  const { data: materials = [] } = useQuery({
    queryKey: ['/api/materials', newComposition.selectedCategoryId],
    queryFn: async () => {
      let url = '/api/materials';
      if (newComposition.selectedCategoryId) {
        url += `?category=${newComposition.selectedCategoryId}`;
      }
      const response = await apiRequest('GET', url);
      return response.json();
    },
    enabled: !newComposition.isNewMaterial // Only load when not creating new material
  });

  // Load labor categories for selection
  const { data: laborCategories = [] } = useQuery({
    queryKey: ['/api/catalog/labor'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/catalog/labor');
      return response.json();
    }
  });

  // Load tool/equipment categories for selection
  const { data: toolCategories = [] } = useQuery({
    queryKey: ['/api/catalog/tools'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/catalog/tools');
      return response.json();
    }
  });

  // Add composition mutation
  const addCompositionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', `/api/custom-activities/${activity.id}/compositions`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-activities', activity.id, 'compositions'] });
      toast({ title: "Éxito", description: "Composición agregada correctamente" });
      setShowAddDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo agregar la composición", variant: "destructive" });
    }
  });

  // Delete composition mutation
  const deleteCompositionMutation = useMutation({
    mutationFn: async (compositionId: number) => {
      const response = await apiRequest('DELETE', `/api/custom-activities/${activity.id}/compositions/${compositionId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-activities', activity.id, 'compositions'] });
      toast({ title: "Éxito", description: "Composición eliminada correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar la composición", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setNewComposition({
      description: "",
      unit: "",
      quantity: "",
      unitCost: "",
      type: "material",
      materialId: "",
      laborId: "",
      toolId: "",
      isNewMaterial: false,
      selectedCategoryId: ""
    });
  };

  const handleAddComposition = async () => {
    if (!newComposition.description || !newComposition.unit || !newComposition.quantity || !newComposition.unitCost) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseFloat(newComposition.quantity);
    const unitCost = parseFloat(newComposition.unitCost);

    if (isNaN(quantity) || quantity <= 0 || isNaN(unitCost) || unitCost <= 0) {
      toast({
        title: "Error",
        description: "La cantidad y precio unitario deben ser números válidos mayores a 0",
        variant: "destructive",
      });
      return;
    }

    try {
      let compositionData: any = {
        description: newComposition.description,
        unit: newComposition.unit,
        quantity,
        unitCost,
        type: newComposition.type
      };

      // Add specific IDs based on type and handle new materials
      if (newComposition.type === "material") {
        if (newComposition.isNewMaterial) {
          // Create new material first
          const materialResponse = await apiRequest('POST', '/api/materials', {
            name: newComposition.description,
            unit: newComposition.unit,
            price: unitCost,
            categoryId: parseInt(newComposition.selectedCategoryId) || 1 // Use selected category
          });
          const newMaterial = await materialResponse.json();
          compositionData.materialId = newMaterial.id;
          
          // Invalidate materials cache to refresh list
          queryClient.invalidateQueries({ queryKey: ['/api/catalog/materials'] });
        } else if (newComposition.materialId) {
          compositionData.materialId = parseInt(newComposition.materialId);
        }
      } else if (newComposition.type === "labor" && newComposition.laborId) {
        compositionData.laborId = parseInt(newComposition.laborId);
      } else if (newComposition.type === "equipment" && newComposition.toolId) {
        compositionData.toolId = parseInt(newComposition.toolId);
      }

      addCompositionMutation.mutate(compositionData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al procesar la composición",
        variant: "destructive"
      });
    }
  };

  const handleDeleteComposition = (compositionId: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta composición?")) {
      deleteCompositionMutation.mutate(compositionId);
    }
  };

  // Filter compositions by type
  const materialsCompositions = compositions.filter((c: Composition) => c.type === 'material');
  const laborCompositions = compositions.filter((c: Composition) => c.type === 'labor');
  const equipmentCompositions = compositions.filter((c: Composition) => c.type === 'equipment');

  // Calculate totals
  const calculateTotal = (quantity: string, unitCost: string) => {
    const q = parseFloat(quantity) || 0;
    const c = parseFloat(unitCost) || 0;
    return q * c;
  };

  const materialsTotal = materialsCompositions.reduce((sum: number, comp: Composition) => sum + calculateTotal(comp.quantity, comp.unitCost), 0);
  const laborTotal = laborCompositions.reduce((sum: number, comp: Composition) => sum + calculateTotal(comp.quantity, comp.unitCost), 0);
  const equipmentTotal = equipmentCompositions.reduce((sum: number, comp: Composition) => sum + calculateTotal(comp.quantity, comp.unitCost), 0);
  const grandTotal = materialsTotal + laborTotal + equipmentTotal;

  if (isLoading) {
    return <div className="p-4">Cargando composiciones...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{activity.name}</h1>
            <p className="text-gray-600">
              {activity.unit} • {activity.phase?.name}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Composición
        </Button>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calculator className="w-5 h-5 mr-2" />
            Resumen de Costos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Materiales</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(materialsTotal)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Mano de Obra</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(laborTotal)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Equipos</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(equipmentTotal)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(grandTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compositions Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="materials" className="flex items-center space-x-2">
            <Package className="w-4 h-4" />
            <span>Materiales ({materialsCompositions.length})</span>
          </TabsTrigger>
          <TabsTrigger value="labor" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Mano de Obra ({laborCompositions.length})</span>
          </TabsTrigger>
          <TabsTrigger value="equipment" className="flex items-center space-x-2">
            <Wrench className="w-4 h-4" />
            <span>Equipos ({equipmentCompositions.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="space-y-4">
          <CompositionTable 
            compositions={materialsCompositions} 
            onDelete={handleDeleteComposition}
            calculateTotal={calculateTotal}
          />
        </TabsContent>

        <TabsContent value="labor" className="space-y-4">
          <CompositionTable 
            compositions={laborCompositions} 
            onDelete={handleDeleteComposition}
            calculateTotal={calculateTotal}
          />
        </TabsContent>

        <TabsContent value="equipment" className="space-y-4">
          <CompositionTable 
            compositions={equipmentCompositions} 
            onDelete={handleDeleteComposition}
            calculateTotal={calculateTotal}
          />
        </TabsContent>
      </Tabs>

      {/* Add Composition Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar Nueva Composición</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Tipo de Composición */}
            <div>
              <Label className="text-sm font-medium">Tipo</Label>
              <Select 
                value={newComposition.type}
                onValueChange={(value) => setNewComposition(prev => ({...prev, type: value, materialId: "", laborId: "", toolId: "", description: "", unit: "", unitCost: ""}))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="material">Material</SelectItem>
                  <SelectItem value="labor">Mano de Obra</SelectItem>
                  <SelectItem value="equipment">Equipo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selector de Material */}
            {newComposition.type === "material" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Material</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setNewComposition(prev => ({...prev, isNewMaterial: !prev.isNewMaterial, materialId: "", selectedCategoryId: "", description: "", unit: "", unitCost: ""}))}
                  >
                    {newComposition.isNewMaterial ? "Seleccionar Existente" : "Crear Nuevo"}
                  </Button>
                </div>
                
                {!newComposition.isNewMaterial ? (
                  <div className="space-y-3">
                    {/* Selector de Categoría */}
                    <div>
                      <Label className="text-sm">Categoría de Material *</Label>
                      <Select 
                        value={newComposition.selectedCategoryId}
                        onValueChange={(value) => {
                          setNewComposition(prev => ({
                            ...prev, 
                            selectedCategoryId: value,
                            materialId: "", // Reset material selection
                            description: "",
                            unit: "",
                            unitCost: ""
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar categoría..." />
                        </SelectTrigger>
                        <SelectContent>
                          {materialCategories.map((category: any) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Selector de Material - Solo mostrar si hay categoría seleccionada */}
                    {newComposition.selectedCategoryId && (
                      <div>
                        <Label className="text-sm">Material *</Label>
                        <Select 
                          value={newComposition.materialId}
                          onValueChange={(value) => {
                            const material = materials.find((m: any) => m.id.toString() === value);
                            if (material) {
                              setNewComposition(prev => ({
                                ...prev, 
                                materialId: value,
                                description: material.name,
                                unit: material.unit,
                                unitCost: material.price.toString()
                              }));
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar material..." />
                          </SelectTrigger>
                          <SelectContent>
                            {materials.map((material: any) => (
                              <SelectItem key={material.id} value={material.id.toString()}>
                                {material.name} - {material.unit} - Bs. {material.price}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Categoría del Material *</Label>
                      <Select 
                        value={newComposition.selectedCategoryId}
                        onValueChange={(value) => setNewComposition(prev => ({...prev, selectedCategoryId: value}))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar categoría..." />
                        </SelectTrigger>
                        <SelectContent>
                          {materialCategories.map((category: any) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Nombre del Material *</Label>
                      <Input
                        value={newComposition.description}
                        onChange={(e) => setNewComposition(prev => ({...prev, description: e.target.value}))}
                        placeholder="Ej: Cemento Portland Especial"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-sm">Unidad *</Label>
                        <Input
                          value={newComposition.unit}
                          onChange={(e) => setNewComposition(prev => ({...prev, unit: e.target.value}))}
                          placeholder="Ej: Bolsa, kg"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Precio (Bs.) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newComposition.unitCost}
                          onChange={(e) => setNewComposition(prev => ({...prev, unitCost: e.target.value}))}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Selector de Mano de Obra */}
            {newComposition.type === "labor" && (
              <div>
                <Label className="text-sm font-medium">Mano de Obra</Label>
                <Select 
                  value={newComposition.laborId}
                  onValueChange={(value) => {
                    const labor = laborCategories.find((l: any) => l.id.toString() === value);
                    if (labor) {
                      setNewComposition(prev => ({
                        ...prev, 
                        laborId: value,
                        description: labor.name,
                        unit: labor.unit,
                        unitCost: labor.cost.toString()
                      }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar mano de obra..." />
                  </SelectTrigger>
                  <SelectContent>
                    {laborCategories.map((labor: any) => (
                      <SelectItem key={labor.id} value={labor.id.toString()}>
                        {labor.name} - {labor.unit} - Bs. {labor.cost}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Selector de Equipo */}
            {newComposition.type === "equipment" && (
              <div>
                <Label className="text-sm font-medium">Equipo</Label>
                <Select 
                  value={newComposition.toolId}
                  onValueChange={(value) => {
                    const tool = toolCategories.find((t: any) => t.id.toString() === value);
                    if (tool) {
                      setNewComposition(prev => ({
                        ...prev, 
                        toolId: value,
                        description: tool.name,
                        unit: tool.unit,
                        unitCost: tool.cost.toString()
                      }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar equipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {toolCategories.map((tool: any) => (
                      <SelectItem key={tool.id} value={tool.id.toString()}>
                        {tool.name} - {tool.unit} - Bs. {tool.cost}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Cantidad */}
            <div>
              <Label className="text-sm font-medium">Cantidad *</Label>
              <Input
                type="number"
                step="0.01"
                value={newComposition.quantity}
                onChange={(e) => setNewComposition(prev => ({...prev, quantity: e.target.value}))}
                placeholder="0.00"
              />
            </div>

            {/* Resumen */}
            {newComposition.description && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium">{newComposition.description}</p>
                <p className="text-xs text-gray-600">
                  {newComposition.quantity} {newComposition.unit} × Bs. {newComposition.unitCost} = 
                  Bs. {(parseFloat(newComposition.quantity || "0") * parseFloat(newComposition.unitCost || "0")).toFixed(2)}
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAddComposition}
                disabled={addCompositionMutation.isPending || !newComposition.description || !newComposition.quantity || !newComposition.unitCost}
              >
                {addCompositionMutation.isPending ? "Agregando..." : "Agregar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Composition Table Component
function CompositionTable({ 
  compositions, 
  onDelete, 
  calculateTotal 
}: { 
  compositions: Composition[], 
  onDelete: (id: number) => void,
  calculateTotal: (quantity: string, unitCost: string) => number
}) {
  if (compositions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay composiciones agregadas aún
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Descripción</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Unidad</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Cantidad</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">P. Unit.</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Total</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-900">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {compositions.map((composition) => (
                <tr key={composition.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{composition.description}</td>
                  <td className="px-4 py-3 text-sm">{composition.unit}</td>
                  <td className="px-4 py-3 text-sm text-right">{parseFloat(composition.quantity).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(parseFloat(composition.unitCost))}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {formatCurrency(calculateTotal(composition.quantity, composition.unitCost))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(composition.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}