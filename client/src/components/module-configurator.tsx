import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Home, Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ModuleConfiguratorProps {
  projectType?: string;
  basePrice?: number;
  onModuleChange: (modules: number, totalPrice: number) => void;
  className?: string;
}

export default function ModuleConfigurator({ 
  projectType = "galeria", 
  basePrice = 0, 
  onModuleChange,
  className = ""
}: ModuleConfiguratorProps) {
  const [modules, setModules] = useState(() => {
    // Establecer módulos iniciales según el tipo de proyecto
    return projectType.toLowerCase().includes("casa") ? 3 : 2;
  });

  const minModules = projectType.toLowerCase().includes("casa") ? 3 : 2;
  const maxModules = projectType.toLowerCase().includes("casa") ? 12 : 8;

  // Calcular precio total basado en módulos
  const totalPrice = basePrice * modules;

  // Notificar cambios al componente padre
  useEffect(() => {
    onModuleChange(modules, totalPrice);
  }, [modules, totalPrice, onModuleChange]);

  const incrementModules = () => {
    if (modules < maxModules) {
      setModules(modules + 1);
    }
  };

  const decrementModules = () => {
    if (modules > minModules) {
      setModules(modules - 1);
    }
  };

  const getProjectIcon = () => {
    return projectType.toLowerCase().includes("casa") ? 
      <Home className="w-5 h-5" /> : 
      <Building2 className="w-5 h-5" />;
  };

  const getProjectTypeLabel = () => {
    return projectType.toLowerCase().includes("casa") ? "Casa" : "Galería";
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getProjectIcon()}
          Configurador de Módulos - {getProjectTypeLabel()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Información del proyecto */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {getProjectTypeLabel()}
            </Badge>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Mínimo: {minModules} módulos | Máximo: {maxModules} módulos
            </span>
          </div>
        </div>

        {/* Configurador principal */}
        <div className="flex items-center justify-center space-x-6 py-4">
          {/* Botón decrementar */}
          <Button
            variant="outline"
            size="icon"
            onClick={decrementModules}
            disabled={modules <= minModules}
            className="h-12 w-12"
          >
            <Minus className="w-5 h-5" />
          </Button>

          {/* Display de módulos */}
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">
              {modules}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {modules === 1 ? "módulo" : "módulos"}
            </div>
          </div>

          {/* Botón incrementar */}
          <Button
            variant="outline"
            size="icon"
            onClick={incrementModules}
            disabled={modules >= maxModules}
            className="h-12 w-12"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        <Separator />

        {/* Información de precios */}
        {basePrice > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Precio estimado por módulo:
              </span>
              <span className="font-medium">
                {formatCurrency(basePrice)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Estimación total ({modules} módulos):
              </span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(totalPrice)}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              * Los precios se actualizarán al agregar actividades
            </div>
          </div>
        )}

        {/* Indicador visual de módulos */}
        <div className="grid grid-cols-8 gap-1 mt-4">
          {Array.from({ length: Math.min(maxModules, 8) }, (_, index) => (
            <div
              key={index}
              className={`aspect-square rounded-sm border-2 ${
                index < modules
                  ? "bg-primary border-primary"
                  : "bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              }`}
            />
          ))}
          {maxModules > 8 && (
            <div className="col-span-8 text-center text-xs text-gray-500 mt-1">
              {modules > 8 && `+${modules - 8} módulos adicionales`}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}