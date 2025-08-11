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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Edit, Building2, Trash2, CheckCircle, XCircle, Phone, Mail, MapPin } from "lucide-react";

interface Supplier {
  id: number;
  userId: number;
  companyName: string;
  businessType: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
}

export default function AdminSuppliers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    companyName: "",
    businessType: "",
    phone: "",
    email: "",
    address: "",
    isActive: true
  });
  const { toast } = useToast();

  // Fetch suppliers
  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/admin/suppliers"],
  });

  // Update supplier mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest(`/api/admin/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers"] });
      setEditingSupplier(null);
      toast({
        title: "Éxito",
        description: "Proveedor actualizado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar proveedor",
        variant: "destructive",
      });
    },
  });

  // Delete supplier mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/suppliers/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers"] });
      toast({
        title: "Éxito",
        description: "Proveedor eliminado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar proveedor",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      companyName: supplier.companyName,
      businessType: supplier.businessType,
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      isActive: supplier.isActive
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingSupplier) return;

    updateMutation.mutate({
      id: editingSupplier.id,
      ...formData
    });
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="default" className="bg-green-500">
        <CheckCircle className="h-3 w-3 mr-1" />Activo
      </Badge>
    ) : (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />Inactivo
      </Badge>
    );
  };

  const getBusinessTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'construction': 'bg-blue-500',
      'materials': 'bg-green-500',
      'tools': 'bg-orange-500',
      'services': 'bg-purple-500'
    };
    
    return (
      <Badge variant="secondary" className={colors[type] || 'bg-gray-500'}>
        {type}
      </Badge>
    );
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === "" || 
                         (selectedStatus === "active" && supplier.isActive) ||
                         (selectedStatus === "inactive" && !supplier.isActive);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Empresas Proveedoras</h1>
          <p className="text-gray-600 mt-2">
            Administra empresas proveedoras y sus datos de contacto
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Building2 className="h-4 w-4 mr-2" />
          Administrador
        </Badge>
      </div>

      {/* Controles y filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar proveedores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los estados</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Proveedores</p>
                <p className="text-2xl font-bold">{suppliers.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Activos</p>
                <p className="text-2xl font-bold">{suppliers.filter(s => s.isActive).length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Inactivos</p>
                <p className="text-2xl font-bold">{suppliers.filter(s => !s.isActive).length}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Construcción</p>
                <p className="text-2xl font-bold">{suppliers.filter(s => s.businessType === 'construction').length}</p>
              </div>
              <Building2 className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de proveedores */}
      <Card>
        <CardHeader>
          <CardTitle>Empresas Proveedoras ({filteredSuppliers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Cargando proveedores...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tipo de Negocio</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.companyName}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{supplier.user.username}</p>
                        <p className="text-sm text-gray-500">{supplier.user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getBusinessTypeBadge(supplier.businessType)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {supplier.phone && (
                          <div className="flex items-center text-sm">
                            <Phone className="h-3 w-3 mr-1" />
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center text-sm">
                            <Mail className="h-3 w-3 mr-1" />
                            {supplier.email}
                          </div>
                        )}
                        {supplier.address && (
                          <div className="flex items-center text-sm">
                            <MapPin className="h-3 w-3 mr-1" />
                            {supplier.address.slice(0, 30)}...
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(supplier.isActive)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(supplier)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Editar Proveedor: {supplier.companyName}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                              <div>
                                <Label htmlFor="companyName">Nombre de la Empresa</Label>
                                <Input
                                  id="companyName"
                                  value={formData.companyName}
                                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor="businessType">Tipo de Negocio</Label>
                                <Select value={formData.businessType} onValueChange={(value) => setFormData({ ...formData, businessType: value })}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="construction">Construcción</SelectItem>
                                    <SelectItem value="materials">Materiales</SelectItem>
                                    <SelectItem value="tools">Herramientas</SelectItem>
                                    <SelectItem value="services">Servicios</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="phone">Teléfono</Label>
                                <Input
                                  id="phone"
                                  value={formData.phone}
                                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="email">Email</Label>
                                <Input
                                  id="email"
                                  type="email"
                                  value={formData.email}
                                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="address">Dirección</Label>
                                <Textarea
                                  id="address"
                                  value={formData.address}
                                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                  rows={3}
                                />
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="isActive"
                                  checked={formData.isActive}
                                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                />
                                <Label htmlFor="isActive">Empresa Activa</Label>
                              </div>
                              <div className="flex justify-end space-x-2">
                                <Button type="button" variant="outline" onClick={() => setEditingSupplier(null)}>
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
                            if (confirm(`¿Estás seguro de eliminar la empresa ${supplier.companyName}?`)) {
                              deleteMutation.mutate(supplier.id);
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