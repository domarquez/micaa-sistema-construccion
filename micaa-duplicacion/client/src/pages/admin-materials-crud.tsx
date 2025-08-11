import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Search, Edit, Plus, Trash2, Package, DollarSign } from "lucide-react";

interface Material {
  id: number;
  name: string;
  unit: string;
  price: number;
  categoryId: number;
  category: {
    id: number;
    name: string;
  };
}

interface MaterialCategory {
  id: number;
  name: string;
}

export default function AdminMaterialsCRUD() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    unit: "",
    price: "",
    categoryId: ""
  });
  const { toast } = useToast();

  // Fetch materials
  const { data: materials = [], isLoading } = useQuery<Material[]>({
    queryKey: ["/api/admin/materials", { search: searchTerm, category: selectedCategory }],
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<MaterialCategory[]>({
    queryKey: ["/api/material-categories"],
  });

  // Create material mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/admin/materials", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/materials"] });
      setShowCreateDialog(false);
      setFormData({ name: "", unit: "", price: "", categoryId: "" });
      toast({
        title: "Éxito",
        description: "Material creado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear material",
        variant: "destructive",
      });
    },
  });

  // Update material mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest(`/api/admin/materials/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/materials"] });
      setEditingMaterial(null);
      setFormData({ name: "", unit: "", price: "", categoryId: "" });
      toast({
        title: "Éxito",
        description: "Material actualizado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar material",
        variant: "destructive",
      });
    },
  });

  // Delete material mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/materials/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/materials"] });
      toast({
        title: "Éxito",
        description: "Material eliminado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar material",
        variant: "destructive",
      });
    },
  });

  // Bulk price update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: (data: { adjustmentFactor: number; categoryId?: string }) => 
      apiRequest("/api/admin/bulk-price-update", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/materials"] });
      toast({
        title: "Éxito",
        description: `${data.updatedMaterials} materiales actualizados`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar precios",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      unit: material.unit,
      price: Number(material.price).toString(),
      categoryId: material.categoryId.toString()
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.unit || !formData.price || !formData.categoryId) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      });
      return;
    }

    const data = {
      name: formData.name,
      unit: formData.unit,
      price: parseFloat(formData.price),
      categoryId: parseInt(formData.categoryId)
    };

    if (editingMaterial) {
      updateMutation.mutate({ id: editingMaterial.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleBulkUpdate = (factor: number) => {
    bulkUpdateMutation.mutate({
      adjustmentFactor: factor,
      categoryId: selectedCategory || undefined
    });
  };

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === "all" || material.categoryId.toString() === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión Completa de Materiales</h1>
          <p className="text-gray-600 mt-2">
            CRUD completo - Crear, editar, eliminar y gestionar precios de materiales
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Package className="h-4 w-4 mr-2" />
          Administrador
        </Badge>
      </div>

      {/* Controles y filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar materiales..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
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

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Material
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Material</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre del material"
                  required
                />
              </div>
              <div>
                <Label htmlFor="unit">Unidad</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="Ej: kg, m2, pza"
                  required
                />
              </div>
              <div>
                <Label htmlFor="price">Precio</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="category">Categoría</Label>
                <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creando..." : "Crear"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Herramientas de gestión masiva */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            Gestión Masiva de Precios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleBulkUpdate(1.1)}
              disabled={bulkUpdateMutation.isPending}
            >
              +10% Precios
            </Button>
            <Button
              variant="outline"
              onClick={() => handleBulkUpdate(0.9)}
              disabled={bulkUpdateMutation.isPending}
            >
              -10% Precios
            </Button>
            <Button
              variant="outline"
              onClick={() => handleBulkUpdate(1.05)}
              disabled={bulkUpdateMutation.isPending}
            >
              +5% Precios
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de materiales */}
      <Card>
        <CardHeader>
          <CardTitle>Materiales ({filteredMaterials.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Cargando materiales...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Precio (Bs.)</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium">{material.name}</TableCell>
                    <TableCell>{material.category.name}</TableCell>
                    <TableCell>{material.unit}</TableCell>
                    <TableCell>Bs. {Number(material.price).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(material)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Material</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                              <div>
                                <Label htmlFor="edit-name">Nombre</Label>
                                <Input
                                  id="edit-name"
                                  value={formData.name}
                                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-unit">Unidad</Label>
                                <Input
                                  id="edit-unit"
                                  value={formData.unit}
                                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-price">Precio</Label>
                                <Input
                                  id="edit-price"
                                  type="number"
                                  step="0.01"
                                  value={formData.price}
                                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-category">Categoría</Label>
                                <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map((category) => (
                                      <SelectItem key={category.id} value={category.id.toString()}>
                                        {category.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex justify-end space-x-2">
                                <Button type="button" variant="outline" onClick={() => setEditingMaterial(null)}>
                                  Cancelar
                                </Button>
                                <Button type="submit" disabled={updateMutation.isPending}>
                                  {updateMutation.isPending ? "Actualizando..." : "Actualizar"}
                                </Button>
                              </div>
                            </form>
                          </DialogContent>
                        </Dialog>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm("¿Estás seguro de eliminar este material?")) {
                              deleteMutation.mutate(material.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}