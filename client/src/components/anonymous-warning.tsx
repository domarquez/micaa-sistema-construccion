import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, User, UserPlus } from "lucide-react";

interface AnonymousWarningProps {
  action?: string;
  className?: string;
}

export function AnonymousWarning({ action = "realizar esta acción", className = "" }: AnonymousWarningProps) {
  return (
    <Alert className={`border-orange-200 bg-orange-50 dark:bg-orange-900/20 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <p className="font-semibold text-orange-800 dark:text-orange-200 mb-1">
            Modo Anónimo - Los datos no se guardarán
          </p>
          <p className="text-sm text-orange-700 dark:text-orange-300">
            Puedes {action}, pero los datos se perderán al cerrar la sesión. 
            Regístrate gratis para guardar tu trabajo permanentemente.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => window.location.href = "/login"}
            className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-900/30"
          >
            <User className="w-3 h-3 mr-1" />
            Iniciar Sesión
          </Button>
          <Button 
            size="sm"
            onClick={() => window.location.href = "/register"}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <UserPlus className="w-3 h-3 mr-1" />
            Registro Gratis
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}