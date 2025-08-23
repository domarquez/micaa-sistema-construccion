import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, Printer, UserPlus, Lock } from "lucide-react";
import { Link } from "wouter";

interface AnonymousBudgetWarningProps {
  showActions?: boolean;
  className?: string;
}

export function AnonymousBudgetWarning({ showActions = true, className = "" }: AnonymousBudgetWarningProps) {
  return (
    <Alert className={`border-orange-200 bg-orange-50 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-800 font-semibold">
        Modo de Prueba - Presupuesto Temporal
      </AlertTitle>
      <AlertDescription className="text-orange-700 space-y-2">
        <p>
          ✅ <strong>Puedes hacer todo:</strong> Crear, editar, calcular, descargar PDF e imprimir presupuestos
        </p>
        <p>
          ⚠️ <strong>Importante:</strong> Este presupuesto NO se guardará automáticamente en la base de datos
        </p>
        <p>
          💾 Para guardar permanentemente tus proyectos y acceder desde cualquier dispositivo, 
          necesitas registrarte gratuitamente.
        </p>
        
        {showActions && (
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <Link href="/register">
              <Button size="sm" className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white">
                <UserPlus className="w-4 h-4 mr-2" />
                Registrarse Gratis
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm" variant="outline" className="w-full sm:w-auto border-orange-200 text-orange-700 hover:bg-orange-100">
                <Lock className="w-4 h-4 mr-2" />
                Ya tengo cuenta
              </Button>
            </Link>
          </div>
        )}
        
        <div className="text-sm text-orange-600 mt-2">
          <strong>Funciones disponibles sin registro:</strong>
          <div className="flex flex-wrap gap-4 mt-1">
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              Descargar PDF
            </span>
            <span className="flex items-center gap-1">
              <Printer className="w-3 h-3" />
              Imprimir
            </span>
            <span className="flex items-center gap-1">
              ✏️ Editar en tiempo real
            </span>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}