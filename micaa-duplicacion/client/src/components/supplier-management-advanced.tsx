import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  MapPin, 
  Phone, 
  Globe, 
  Star, 
  MoreHorizontal, 
  Edit, 
  Eye, 
  Plus,
  Building2,
  Crown,
  Truck,
  Users,
  Calendar,
  TrendingUp
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { SupplierCompany } from "@shared/schema";

interface SupplierStats {
  totalSuppliers: number;
  activeSuppliers: number;
  premiumSuppliers: number;
  averageRating: number;
  totalOrders: number;
  monthlyGrowth: number;
}

export function SupplierManagementAdvanced() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [selectedMembership, setSelectedMembership] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers, isLoading: suppliersLoading } = useQuery<SupplierCompany[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: stats } = useQuery<SupplierStats>({
    queryKey: ["/api/supplier-stats"],
  });

  const verifySupplierMutation = useMutation({
    mutationFn: async (supplierId: number) => {
      const response = await fetch(`/api/suppliers/${supplierId}/verify`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Error al verificar proveedor');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Proveedor verificado",
        description: "El proveedor ha sido verificado correctamente",
      });
    },
  });

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];

    return suppliers.filter(supplier => {
      const matchesSearch = supplier.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           supplier.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpecialty = selectedSpecialty === "all" || supplier.speciality === selectedSpecialty;
      const matchesMembership = selectedMembership === "all" || supplier.membershipType === selectedMembership;

      return matchesSearch && matchesSpecialty && matchesMembership;
    });
  }, [suppliers, searchQuery, selectedSpecialty, selectedMembership]);

  const specialties = Array.from(new Set(suppliers?.map(s => s.speciality).filter(Boolean))) || [];

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  const getMembershipBadge = (type: string) => {
    return type === "premium" ? (
      <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600">
        <Crown className="w-3 h-3 mr-1" />
        Premium
      </Badge>
    ) : (
      <Badge variant="outline">Básico</Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">{stats?.totalSuppliers || 0}</p>
              </div>
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Activos</p>
                <p className="text-2xl font-bold text-green-600">{stats?.activeSuppliers || 0}</p>
              </div>
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Premium</p>
                <p className="text-2xl font-bold text-yellow-600">{stats?.premiumSuppliers || 0}</p>
              </div>
              <Crown className="w-6 h-6 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rating Promedio</p>
                <p className="text-2xl font-bold text-purple-600">{stats?.averageRating?.toFixed(1) || "0.0"}</p>
              </div>
              <Star className="w-6 h-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pedidos</p>
                <p className="text-2xl font-bold text-orange-600">{stats?.totalOrders || 0}</p>
              </div>
              <Truck className="w-6 h-6 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Crecimiento</p>
                <p className="text-2xl font-bold text-teal-600">+{stats?.monthlyGrowth || 0}%</p>
              </div>
              <TrendingUp className="w-6 h-6 text-teal-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gestión de Proveedores</CardTitle>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Proveedor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Vista General</TabsTrigger>
              <TabsTrigger value="directory">Directorio</TabsTrigger>
              <TabsTrigger value="analytics">Análisis</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar proveedores..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Especialidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las especialidades</SelectItem>
                    {specialties.map(specialty => (
                      <SelectItem key={specialty} value={specialty}>
                        {specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedMembership} onValueChange={setSelectedMembership}>
                  <SelectTrigger>
                    <SelectValue placeholder="Membresía" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las membresías</SelectItem>
                    <SelectItem value="free">Básica</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  Más Filtros
                </Button>
              </div>

              {/* Suppliers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSuppliers.map((supplier) => (
                  <Card key={supplier.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={supplier.logoUrl || ""} />
                            <AvatarFallback>
                              {supplier.companyName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold text-lg">{supplier.companyName}</h3>
                            <p className="text-sm text-gray-600">{supplier.speciality}</p>
                          </div>
                        </div>
                        {getMembershipBadge(supplier.membershipType)}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center">
                            {getRatingStars(parseFloat(supplier.rating || "0"))}
                          </div>
                          <span className="text-sm text-gray-600">
                            ({supplier.reviewCount} reseñas)
                          </span>
                        </div>

                        {supplier.address && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            <span>{supplier.city}, {supplier.country}</span>
                          </div>
                        )}

                        {supplier.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4" />
                            <span>{supplier.phone}</span>
                          </div>
                        )}

                        {supplier.website && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Globe className="w-4 h-4" />
                            <span className="truncate">{supplier.website}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="flex items-center gap-2">
                            {supplier.isVerified && (
                              <Badge variant="secondary" className="text-xs">
                                Verificado
                              </Badge>
                            )}
                            <Badge variant={supplier.isActive ? "default" : "outline"} className="text-xs">
                              {supplier.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="w-4 h-4 mr-2" />
                                Ver Perfil
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              {!supplier.isVerified && (
                                <DropdownMenuItem
                                  onClick={() => verifySupplierMutation.mutate(supplier.id)}
                                >
                                  Verificar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="directory" className="space-y-6">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Especialidad</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Membresía</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={supplier.logoUrl || ""} />
                              <AvatarFallback className="text-xs">
                                {supplier.companyName.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{supplier.companyName}</p>
                              <p className="text-sm text-gray-500">{supplier.businessType}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{supplier.speciality}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {supplier.city}, {supplier.country}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center">
                              {getRatingStars(parseFloat(supplier.rating || "0"))}
                            </div>
                            <span className="text-sm">({supplier.reviewCount})</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getMembershipBadge(supplier.membershipType)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={supplier.isActive ? "default" : "outline"}>
                              {supplier.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                            {supplier.isVerified && (
                              <Badge variant="secondary" className="text-xs">
                                Verificado
                              </Badge>
                            )}
                          </div>
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
                                <Eye className="w-4 h-4 mr-2" />
                                Ver Perfil
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="text-center py-12">
                <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Análisis de Proveedores
                </h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Visualice estadísticas detalladas sobre el rendimiento y engagement de sus proveedores.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}