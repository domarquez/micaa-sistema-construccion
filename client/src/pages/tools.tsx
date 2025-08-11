import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wrench, Clock, DollarSign, Pencil, Save, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

interface Tool {
  id: number;
  name: string;
  description: string;
  unit: string;
  unitPrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function EditableToolRow({ tool }: { tool: Tool }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrice, setEditedPrice] = useState(tool.unitPrice);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (newPrice: string) => {
      return await apiRequest('PUT', `/api/tools/${tool.id}`, {
        unitPrice: newPrice
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
      toast({
        title: "Precio actualizado",
        description: `El precio de ${tool.name} se actualizó exitosamente.`,
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el precio",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(editedPrice);
  };

  const handleCancel = () => {
    setEditedPrice(tool.unitPrice);
    setIsEditing(false);
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(parseFloat(price));
  };

  const getToolIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('retroexcavadora') || lowerName.includes('volqueta')) {
      return '🚛';
    } else if (lowerName.includes('bomba') || lowerName.includes('compresora')) {
      return '⚙️';
    } else if (lowerName.includes('soldadura') || lowerName.includes('perforación')) {
      return '🔧';
    } else if (lowerName.includes('mezcladora') || lowerName.includes('vibradora')) {
      return '🏗️';
    } else {
      return '🛠️';
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getToolIcon(tool.name)}</span>
          {tool.name}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{tool.description}</TableCell>
      <TableCell>
        <Badge variant="outline">{tool.unit}</Badge>
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              value={editedPrice}
              onChange={(e) => setEditedPrice(e.target.value)}
              className="w-24"
            />
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {formatPrice(tool.unitPrice)}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function Tools() {
  const { data: tools = [], isLoading } = useQuery<Tool[]>({
    queryKey: ["/api/tools"],
  });
  
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(parseFloat(price));
  };

  const getToolIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('retroexcavadora') || lowerName.includes('volqueta')) {
      return '🚛';
    } else if (lowerName.includes('bomba') || lowerName.includes('compresora')) {
      return '⚙️';
    } else if (lowerName.includes('soldadura') || lowerName.includes('perforación')) {
      return '🔧';
    } else if (lowerName.includes('mezcladora') || lowerName.includes('vibradora')) {
      return '🏗️';
    } else {
      return '🛠️';
    }
  };

  const expensiveTools = tools.filter(tool => parseFloat(tool.unitPrice) > 50);
  const moderateTools = tools.filter(tool => parseFloat(tool.unitPrice) >= 20 && parseFloat(tool.unitPrice) <= 50);
  const basicTools = tools.filter(tool => parseFloat(tool.unitPrice) < 20);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Wrench className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Herramientas y Equipos</h1>
            <p className="text-muted-foreground">
              Catálogo de herramientas con precios reales para construcción en Bolivia
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Herramientas</p>
                  <p className="text-2xl font-bold">{tools.length}</p>
                </div>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Equipo Pesado</p>
                  <p className="text-2xl font-bold">{expensiveTools.length}</p>
                </div>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Herramientas Básicas</p>
                  <p className="text-2xl font-bold">{basicTools.length}</p>
                </div>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-8">
        {/* Equipo Pesado */}
        {expensiveTools.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🚛 Equipo Pesado
                <Badge variant="destructive">{expensiveTools.length}</Badge>
              </CardTitle>
              <CardDescription>
                Equipos especializados de alto valor (más de 50 BOB/hora)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Herramienta</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Precio Unitario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensiveTools.map((tool) => (
                    user?.role === 'admin' ? (
                      <EditableToolRow key={tool.id} tool={tool} />
                    ) : (
                      <TableRow key={tool.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getToolIcon(tool.name)}</span>
                            {tool.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{tool.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tool.unit}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {formatPrice(tool.unitPrice)}
                        </TableCell>
                      </TableRow>
                    )
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Herramientas Moderadas */}
        {moderateTools.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔧 Herramientas Especializadas
                <Badge variant="secondary">{moderateTools.length}</Badge>
              </CardTitle>
              <CardDescription>
                Herramientas de uso frecuente (20-50 BOB/hora)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Herramienta</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Precio Unitario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moderateTools.map((tool) => (
                    <TableRow key={tool.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getToolIcon(tool.name)}</span>
                          {tool.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{tool.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tool.unit}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-orange-600">
                        {formatPrice(tool.unitPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Herramientas Básicas */}
        {basicTools.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🛠️ Herramientas Básicas
                <Badge variant="default">{basicTools.length}</Badge>
              </CardTitle>
              <CardDescription>
                Herramientas de uso general (menos de 20 BOB/hora)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Herramienta</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Precio Unitario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {basicTools.map((tool) => (
                    <TableRow key={tool.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getToolIcon(tool.name)}</span>
                          {tool.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{tool.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tool.unit}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatPrice(tool.unitPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}