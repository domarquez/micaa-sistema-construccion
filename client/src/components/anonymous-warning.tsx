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
      <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-orange-800 dark:text-orange-200 mb-1 text-xs sm:text-sm">
            Modo Anónimo - Los datos no se guardarán
          </p>
          <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
            Puedes {action}, pero los datos se perderán al cerrar la sesión. 
            Regístrate gratis para guardar tu trabajo permanentemente.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 w-full sm:w-auto">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => window.location.href = "/login"}
            className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-900/30 w-full sm:w-auto"
          >
            <User className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="truncate">Iniciar Sesión</span>
          </Button>
          <Button 
            size="sm"
            onClick={() => window.location.href = "/register"}
            className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto"
          >
            <UserPlus className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="truncate">Registro Gratis</span>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}