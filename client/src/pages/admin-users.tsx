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
import { Search, Edit, Users, Shield, Trash2, UserCheck, UserX } from "lucide-react";

interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  city?: string;
  country?: string;
}

export default function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    role: "",
    isActive: true
  });
  const { toast } = useToast();

  // Fetch users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await apiRequest("PUT", `/api/admin/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      toast({
        title: "Éxito",
        description: "Usuario actualizado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar usuario",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Éxito",
        description: "Usuario eliminado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar usuario",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      role: user.role,
      isActive: user.isActive
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUser) return;

    updateMutation.mutate({
      id: editingUser.id,
      ...formData
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
      case 'supplier':
        return <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />Proveedor</Badge>;
      default:
        return <Badge variant="outline"><Users className="h-3 w-3 mr-1" />Usuario</Badge>;
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="default" className="bg-green-500">
        <UserCheck className="h-3 w-3 mr-1" />Activo
      </Badge>
    ) : (
      <Badge variant="destructive">
        <UserX className="h-3 w-3 mr-1" />Inactivo
      </Badge>
    );
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !selectedRole || selectedRole === 'all' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-bold">
            <span className="hidden sm:inline">Gestión de Usuarios</span>
            <span className="sm:hidden">Usuarios</span>
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-2">
            Administra roles, permisos y estado de usuarios del sistema
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Users className="h-4 w-4 mr-2" />
          Administrador
        </Badge>
      </div>

      {/* Controles y filtros */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar usuarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Todos los roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="supplier">Proveedor</SelectItem>
            <SelectItem value="user">Usuario</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Usuarios</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Administradores</p>
                <p className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</p>
              </div>
              <Shield className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Proveedores</p>
                <p className="text-2xl font-bold">{users.filter(u => u.role === 'supplier').length}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Usuarios Activos</p>
                <p className="text-2xl font-bold">{users.filter(u => u.isActive).length}</p>
              </div>
              <UserCheck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de usuarios */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Usuarios ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {isLoading ? (
            <div className="text-center py-8">Cargando usuarios...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Usuario</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden xl:table-cell">Nombre Completo</TableHead>
                  <TableHead className="hidden sm:table-cell">Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Registro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{user.username}</span>
                        <span className="lg:hidden text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{user.email}</TableCell>
                    <TableCell className="hidden xl:table-cell">{`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}</TableCell>
                    <TableCell className="hidden sm:table-cell">{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{getStatusBadge(user.isActive)}</TableCell>
                    <TableCell className="hidden md:table-cell">{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Usuario: {user.username}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                              <div>
                                <Label htmlFor="role">Rol</Label>
                                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">Usuario</SelectItem>
                                    <SelectItem value="supplier">Proveedor</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="isActive"
                                  checked={formData.isActive}
                                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                />
                                <Label htmlFor="isActive">Usuario Activo</Label>
                              </div>
                              <div className="flex justify-end space-x-2">
                                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
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
                            if (confirm(`¿Estás seguro de eliminar al usuario ${user.username}?`)) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                          disabled={deleteMutation.isPending || user.role === 'admin'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}