import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";
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
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Fetch materials
  const { data: materials = [], isLoading: materialsLoading } = useQuery<Material[]>({
    queryKey: ["/api/admin/materials", { categoryId: selectedCategory, search: searchTerm }],
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<MaterialCategory[]>({
    queryKey: ["/api/material-categories"],
  });

  const handleEditPrice = (material: Material) => {
    setEditingMaterial(material);
    setNewPrice(Number(material.price).toString());
    setShowModal(true);
  };

  const handleSavePrice = async () => {
    if (!editingMaterial || !newPrice) {
      alert("Faltan datos del material o precio");
      return;
    }
    
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      alert("Por favor ingresa un precio válido.");
      return;
    }

    setIsSaving(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        alert('No se encontró token de autenticación. Inicia sesión nuevamente.');
        setIsSaving(false);
        return;
      }

      console.log("=== USANDO FETCH DIRECTO CLEAN ===");
      console.log("URL: /api/admin/update-material-price");
      console.log("Method: POST");
      console.log("Data:", { materialId: editingMaterial.id, price });

      const response = await window.fetch("/api/admin/update-material-price", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          materialId: editingMaterial.id, 
          price: price 
        }),
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        alert(`Error ${response.status}: ${errorText}`);
        setIsSaving(false);
        return;
      }

      const result = await response.json();
      console.log("Success response:", result);
      
      // Recargar los materiales
      queryClient.invalidateQueries({ queryKey: ["/api/admin/materials"] });
      
      alert(`✓ Precio actualizado exitosamente a Bs. ${price.toFixed(2)}`);
      
      // Cerrar modal
      setEditingMaterial(null);
      setNewPrice("");
      setShowModal(false);
      setIsSaving(false);
      
    } catch (error) {
      console.error("Fetch error:", error);
      alert(`Error al actualizar precio: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      setIsSaving(false);
    }
  };

  const filteredMaterials = materials.filter((material) => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "" || selectedCategory === "all" || material.categoryId.toString() === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Materiales</h1>
          <p className="text-gray-600">Administra precios y materiales del sistema</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar Material</label>
              <Input
                placeholder="Buscar por nombre o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
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
          </div>
        </CardContent>
      </Card>

      {/* Materials Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Lista de Materiales ({filteredMaterials.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {materialsLoading ? (
            <div className="text-center py-4">Cargando materiales...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Precio (Bs.)</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.map((material) => {
                  const category = categories.find(cat => cat.id === material.categoryId);
                  return (
                    <TableRow key={material.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{material.name}</p>
                          {material.description && (
                            <p className="text-sm text-gray-500">{material.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {category && (
                          <Badge variant="outline">{category.name}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{material.unit}</TableCell>
                      <TableCell>
                        <span className="font-mono">
                          {Number(material.price).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleEditPrice(material)}
                          className="flex items-center gap-1"
                        >
                          <DollarSign className="h-3 w-3" />
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal simple SIN shadcn */}
      {showModal && editingMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Editar Precio Base</h3>
            <p className="text-sm text-gray-600 mb-4">
              Actualiza el precio base del material seleccionado
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block">Material</label>
                <p className="text-gray-600">{editingMaterial.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium block">Precio Actual</label>
                <p className="text-gray-600">Bs. {Number(editingMaterial.price).toFixed(2)}</p>
              </div>
              <div>
                <label className="text-sm font-medium block">Nuevo Precio</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSavePrice}
                disabled={isSaving}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingMaterial(null);
                  setNewPrice("");
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}