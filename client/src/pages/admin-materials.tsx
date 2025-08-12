import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Search, DollarSign, Save, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Material {
  id: number;
  name: string;
  description: string;
  unit: string;
  price: number;
  categoryId: number;
  category?: {
    id: number;
    name: string;
  };
}

interface MaterialCategory {
  id: number;
  name: string;
}

export default function AdminMaterials() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch materials
  const { data: materials = [], isLoading: materialsLoading } = useQuery<Material[]>({
    queryKey: ["/api/admin/materials", { categoryId: selectedCategory, search: searchTerm }],
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<MaterialCategory[]>({
    queryKey: ["/api/material-categories"],
  });

  // Material price update mutation - NUEVA IMPLEMENTACION
  const updatePriceMutation = useMutation({
    mutationFn: async ({ materialId, price }: { materialId: number; price: number }) => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token de autenticación no encontrado');
      }

      console.log("Using NEW route: /api/admin/update-material-price");
      console.log("Sending data:", { materialId, price });

      const response = await fetch("/api/admin/update-material-price", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ materialId, price }),
      });

      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log("Success response:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/materials"] });
      toast({
        title: "✓ Precio actualizado",
        description: "El precio se ha actualizado correctamente.",
      });
      setEditingMaterial(null);
      setNewPrice("");
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Global price adjustment mutation
  const globalAdjustmentMutation = useMutation({
    mutationFn: async (factor: number) => {
      const response = await apiRequest("POST", '/api/apply-price-adjustment', { factor, updatedBy: 'admin' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/materials"] });
      toast({
        title: "Ajuste aplicado",
        description: "El ajuste global de precios se aplicó correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo aplicar el ajuste global de precios.",
        variant: "destructive",
      });
    },
  });

  const filteredMaterials = materials.filter((material: Material) => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === "all" || material.categoryId.toString() === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleEditPrice = (material: Material) => {
    setEditingMaterial(material);
    setNewPrice(Number(material.price).toString());
    setIsDialogOpen(true);
  };

  const handleSavePrice = () => {
    if (!editingMaterial || !newPrice) {
      console.log("Missing material or price data");
      return;
    }
    
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Error",
        description: "Por favor ingresa un precio válido.",
        variant: "destructive",
      });
      return;
    }

    console.log("Starting price update using mutation...", {
      materialId: editingMaterial.id,
      materialName: editingMaterial.name,
      newPrice: price
    });

    updatePriceMutation.mutate({ materialId: editingMaterial.id, price });
  };

  const handleGlobalAdjustment = (factor: number) => {
    globalAdjustmentMutation.mutate(factor);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Precios de Materiales</h1>
          <p className="text-gray-600 mt-2">
            Administra los precios base de todos los materiales del sistema
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <DollarSign className="h-4 w-4 mr-2" />
          Administrador
        </Badge>
      </div>

      {/* Global Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ajustes Globales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={() => handleGlobalAdjustment(1.1)}
              disabled={globalAdjustmentMutation.isPending}
              variant="outline"
            >
              {globalAdjustmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Aumentar 10%
            </Button>
            <Button
              onClick={() => handleGlobalAdjustment(0.9)}
              disabled={globalAdjustmentMutation.isPending}
              variant="outline"
            >
              {globalAdjustmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Reducir 10%
            </Button>
            <Button
              onClick={() => handleGlobalAdjustment(1.05)}
              disabled={globalAdjustmentMutation.isPending}
              variant="outline"
            >
              {globalAdjustmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Aumentar 5%
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar materiales..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Materials Table */}
      <Card>
        <CardHeader>
          <CardTitle>Materiales ({filteredMaterials.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {materialsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Precio Base</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.map((material: Material) => (
                  <TableRow key={material.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{material.name}</div>
                        {material.description && (
                          <div className="text-sm text-gray-500">{material.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {material.category?.name || 'Sin categoría'}
                      </Badge>
                    </TableCell>
                    <TableCell>{material.unit}</TableCell>
                    <TableCell className="text-right font-mono">
                      Bs. {Number(material.price).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPrice(material)}
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Editar Precio
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Price Edit Dialog - moved outside of table loop */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent aria-describedby="dialog-description">
          <DialogHeader>
            <DialogTitle>Editar Precio Base</DialogTitle>
            <p id="dialog-description" className="text-sm text-gray-600">
              Actualiza el precio base del material seleccionado
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Material</label>
              <p className="text-gray-600">{editingMaterial?.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Precio Actual</label>
              <p className="text-gray-600">Bs. {editingMaterial?.price ? Number(editingMaterial.price).toFixed(2) : '0.00'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Nuevo Precio</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSavePrice}
                disabled={updatePriceMutation.isPending}
                className="flex-1"
              >
                {updatePriceMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {updatePriceMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingMaterial(null);
                  setNewPrice("");
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}