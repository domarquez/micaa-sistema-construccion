import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Search, 
  Phone, 
  MapPin, 
  Users,
  Calendar,
  Filter
} from "lucide-react";

export default function ReviewCompanies() {
  const [searchTerm, setSearchTerm] = useState("");

  // Obtener empresas
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["/api/supplier-companies"],
    retry: false,
  });

  // Filtrar empresas
  const filteredCompanies = companies.filter((company: any) => {
    const matchesSearch = 
      company.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.phone?.includes(searchTerm);
    
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Empresas Importadas</h1>
          <p className="text-muted-foreground mt-2">
            Total: {companies.length} empresas | Mostrando: {filteredCompanies.length}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">
            {companies.filter((c: any) => c.isActive).length} activas
          </span>
        </div>
      </div>

      {/* Búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="w-5 h-5" />
            <span>Buscar Empresas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, dirección o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Grid de empresas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompanies.map((company: any) => (
          <Card key={company.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg leading-tight">
                    {company.companyName || 'Sin nombre'}
                  </CardTitle>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {company.businessType || 'General'}
                    </Badge>
                    {company.isActive ? (
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        Activa
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Inactiva
                      </Badge>
                    )}
                  </div>
                </div>
                <Building2 className="w-8 h-8 text-primary flex-shrink-0" />
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Dirección */}
              {company.address && (
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {company.address}
                  </p>
                </div>
              )}
              
              {/* Ciudad */}
              {company.city && (
                <div className="text-sm text-muted-foreground">
                  📍 {company.city}
                </div>
              )}
              
              {/* Teléfono */}
              {company.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-gray-700">
                    {company.phone}
                  </p>
                </div>
              )}
              
              {/* WhatsApp */}
              {company.whatsapp && company.whatsapp !== company.phone && (
                <div className="text-sm text-green-600">
                  📱 {company.whatsapp}
                </div>
              )}
              
              {/* Website */}
              {company.website && (
                <div className="text-sm text-primary truncate">
                  🌐 {company.website}
                </div>
              )}
              
              {/* Descripción */}
              {company.description && (
                <div className="text-sm text-muted-foreground bg-gray-50 p-2 rounded text-xs">
                  {company.description.substring(0, 100)}
                  {company.description.length > 100 && '...'}
                </div>
              )}
              
              {/* Especialidad */}
              {company.speciality && company.speciality !== company.businessType && (
                <Badge variant="secondary" className="text-xs">
                  {company.speciality}
                </Badge>
              )}
              
              {/* Fecha de creación */}
              <div className="flex items-center space-x-2 text-xs text-muted-foreground pt-2 border-t">
                <Calendar className="w-3 h-3" />
                <span>
                  Agregada: {new Date(company.createdAt).toLocaleDateString('es-BO')}
                </span>
              </div>
              
              {/* Rating si existe */}
              {company.rating && (
                <div className="text-xs text-yellow-600">
                  ⭐ {company.rating} ({company.reviewCount || 0} reseñas)
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {filteredCompanies.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="mx-auto w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No se encontraron empresas
            </h3>
            <p className="text-muted-foreground">
              {searchTerm ? 
                "Intentá con otros términos de búsqueda" : 
                "No hay empresas importadas aún"
              }
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Estadísticas */}
      {companies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Estadísticas de Importación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {companies.length}
                </div>
                <div className="text-sm text-muted-foreground">Total Empresas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {companies.filter((c: any) => c.isActive).length}
                </div>
                <div className="text-sm text-muted-foreground">Activas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {companies.filter((c: any) => c.isVerified).length}
                </div>
                <div className="text-sm text-muted-foreground">Verificadas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {[...new Set(companies.map((c: any) => c.businessType))].length}
                </div>
                <div className="text-sm text-muted-foreground">Tipos de Negocio</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}