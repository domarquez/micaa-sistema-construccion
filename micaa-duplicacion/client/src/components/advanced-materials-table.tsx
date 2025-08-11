import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Filter, 
  Download, 
  Upload, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Material, MaterialCategory } from "@shared/schema";

export function AdvancedMaterialsTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<"name" | "price" | "category">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: materials, isLoading: materialsLoading } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
  });

  const { data: categories } = useQuery<MaterialCategory[]>({
    queryKey: ["/api/material-categories"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/materials/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Error al eliminar material');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({
        title: "Material eliminado",
        description: "El material ha sido eliminado correctamente",
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: { ids: number[], priceAdjustment: number }) => {
      const response = await fetch('/api/materials/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Error al actualizar precios');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      setSelectedMaterials([]);
      toast({
        title: "Precios actualizados",
        description: "Los precios han sido actualizados correctamente",
      });
    },
  });

  const filteredMaterials = useMemo(() => {
    if (!materials) return [];

    let filtered = materials.filter(material => {
      const matchesSearch = material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           material.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "all" || material.categoryId === parseInt(selectedCategory);
      
      let matchesPrice = true;
      if (priceRange.min) {
        matchesPrice = matchesPrice && parseFloat(material.price) >= parseFloat(priceRange.min);
      }
      if (priceRange.max) {
        matchesPrice = matchesPrice && parseFloat(material.price) <= parseFloat(priceRange.max);
      }

      return matchesSearch && matchesCategory && matchesPrice;
    });

    // Sort materials
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "price":
          comparison = parseFloat(a.price) - parseFloat(b.price);
          break;
        case "category":
          const categoryA = categories?.find(c => c.id === a.categoryId)?.name || "";
          const categoryB = categories?.find(c => c.id === b.categoryId)?.name || "";
          comparison = categoryA.localeCompare(categoryB);
          break;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [materials, searchQuery, selectedCategory, priceRange, sortBy, sortOrder, categories]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMaterials(filteredMaterials.map(m => m.id));
    } else {
      setSelectedMaterials([]);
    }
  };

  const handleSelectMaterial = (materialId: number, checked: boolean) => {
    if (checked) {
      setSelectedMaterials(prev => [...prev, materialId]);
    } else {
      setSelectedMaterials(prev => prev.filter(id => id !== materialId));
    }
  };

  const handleBulkPriceUpdate = (adjustmentPercent: number) => {
    if (selectedMaterials.length === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos un material",
        variant: "destructive",
      });
      return;
    }

    bulkUpdateMutation.mutate({
      ids: selectedMaterials,
      priceAdjustment: adjustmentPercent
    });
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Nombre', 'Categoría', 'Unidad', 'Precio', 'Descripción'],
      ...filteredMaterials.map(material => [
        material.name,
        categories?.find(c => c.id === material.categoryId)?.name || "",
        material.unit,
        material.price,
        material.description || ""
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'materiales.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Gestión Avanzada de Materiales
            <Badge variant="secondary">{filteredMaterials.length} materiales</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Material
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar materiales..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories?.map(category => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Precio mínimo"
            type="number"
            value={priceRange.min}
            onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
          />

          <Input
            placeholder="Precio máximo"
            type="number"
            value={priceRange.max}
            onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
          />

          <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
            const [field, order] = value.split('-');
            setSortBy(field as typeof sortBy);
            setSortOrder(order as typeof sortOrder);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Nombre A-Z</SelectItem>
              <SelectItem value="name-desc">Nombre Z-A</SelectItem>
              <SelectItem value="price-asc">Precio menor</SelectItem>
              <SelectItem value="price-desc">Precio mayor</SelectItem>
              <SelectItem value="category-asc">Categoría A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        {selectedMaterials.length > 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-lg">
            <span className="text-sm font-medium">
              {selectedMaterials.length} materiales seleccionados
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkPriceUpdate(5)}
                disabled={bulkUpdateMutation.isPending}
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                +5%
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkPriceUpdate(-5)}
                disabled={bulkUpdateMutation.isPending}
              >
                <TrendingDown className="w-4 h-4 mr-1" />
                -5%
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkPriceUpdate(10)}
                disabled={bulkUpdateMutation.isPending}
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                +10%
              </Button>
            </div>
          </div>
        )}

        {/* Materials Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedMaterials.length === filteredMaterials.length && filteredMaterials.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Última actualización</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredMaterials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No se encontraron materiales
                  </TableCell>
                </TableRow>
              ) : (
                filteredMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedMaterials.includes(material.id)}
                        onCheckedChange={(checked) => handleSelectMaterial(material.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{material.name}</p>
                        {material.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">
                            {material.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {categories?.find(c => c.id === material.categoryId)?.name}
                      </Badge>
                    </TableCell>
                    <TableCell>{material.unit}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(parseFloat(material.price))}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {material.lastUpdated ? new Date(material.lastUpdated).toLocaleDateString() : "N/A"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => deleteMutation.mutate(material.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}