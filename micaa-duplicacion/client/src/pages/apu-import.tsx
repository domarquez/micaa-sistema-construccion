import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, CheckCircle, AlertCircle, FolderOpen } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function APUImport() {
  const [importStatus, setImportStatus] = useState<{
    imported: number;
    errors: number;
  } | null>(null);
  const { toast } = useToast();

  const importAPU = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/import-apu", {});
      return await response.json();
    },
    onSuccess: (result: any) => {
      setImportStatus(result);
      toast({
        title: "Importación completada",
        description: `Se importaron ${result.imported} composiciones de actividades con ${result.errors} errores.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error en la importación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importCompleteData = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/import-complete-data", {});
      return await response.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Importación de empresas completada",
        description: `Se importaron ${result.data.suppliers} empresas proveedoras reales de Bolivia.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error en la importación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reorganizeActivities = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reorganize-activities", {});
      return await response.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Reorganización completada",
        description: `Se reclasificaron ${result.reclassified} actividades de ${result.analyzed} analizadas.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error en la reorganización",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    setImportStatus(null);
    importAPU.mutate();
  };

  const calculatePrices = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/calculate-all-prices", {});
      return await response.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Cálculo de precios completado",
        description: `Se actualizaron ${result.updated} precios de actividades. ${result.errors} errores.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error en el cálculo de precios",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReorganize = () => {
    reorganizeActivities.mutate();
  };

  const handleCalculatePrices = () => {
    calculatePrices.mutate();
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Importar Análisis de Precios Unitarios</h1>
          <p className="text-gray-600 mt-2">
            Importa composiciones de actividades basadas en análisis de precios unitarios estándar
          </p>
        </div>

        {/* Información sobre APUs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Datos de APU Disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-700">
                El sistema extraerá automáticamente análisis de precios unitarios reales desde la base de datos MICAA
                y los vinculará con las actividades existentes en tu base de datos.
              </p>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900">Fuente de Datos: Sistema MICAA</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Se accederá directamente a la base de datos de análisis de precios unitarios
                    del sistema MICAA para obtener composiciones actualizadas con:
                  </p>
                  <ul className="text-sm text-gray-600 mt-2 space-y-1">
                    <li>• Materiales con cantidades y precios específicos</li>
                    <li>• Mano de obra especializada por actividad</li>
                    <li>• Equipos y herramientas necesarios</li>
                    <li>• Costos indirectos y porcentajes aplicables</li>
                  </ul>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Proceso de Importación</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      El sistema buscará actividades similares en tu base de datos y asignará
                      las composiciones correspondientes. Los materiales se vincularán automáticamente
                      con los existentes en tu inventario.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botón de importación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-600" />
              Iniciar Importación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-700">
                Haz clic en el botón para importar TODAS las composiciones de actividades desde insucons.com.
                Este proceso importará todos los grupos y todos los APUs disponibles.
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Importación Masiva</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Este proceso puede tomar entre 15-30 minutos dependiendo de la cantidad de APUs.
                      Se procesarán todos los grupos disponibles en insucons.com.
                      No cierres esta ventana durante el proceso.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handleImport} 
                  disabled={importAPU.isPending}
                  className="w-full md:w-auto"
                >
                  {importAPU.isPending ? "Importando..." : "Importar TODOS los APUs"}
                </Button>
                
                <Button 
                  onClick={handleReorganize}
                  disabled={reorganizeActivities.isPending}
                  variant="outline"
                  className="w-full md:w-auto border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  {reorganizeActivities.isPending ? "Reorganizando..." : "Reorganizar Actividades por Fases"}
                </Button>

                <Button 
                  onClick={handleCalculatePrices}
                  disabled={calculatePrices.isPending}
                  variant="outline"
                  className="w-full md:w-auto border-green-300 text-green-700 hover:bg-green-50"
                >
                  {calculatePrices.isPending ? "Calculando..." : "Calcular Precios de Todas las Actividades"}
                </Button>

                <Button 
                  onClick={() => importCompleteData.mutate()}
                  disabled={importCompleteData.isPending}
                  variant="outline"
                  className="w-full md:w-auto border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  {importCompleteData.isPending ? "Importando..." : "Importar Empresas Proveedoras Reales"}
                </Button>
                
                <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg space-y-1">
                  <p><strong>Reorganizar:</strong> Distribuye las actividades importadas en las fases correctas según su tipo (demolición → preliminares, vidrios → acabados, etc.)</p>
                  <p><strong>Calcular Precios:</strong> Actualiza automáticamente los precios unitarios de todas las actividades basándose en sus composiciones importadas (materiales + mano de obra).</p>
                  <p><strong>Empresas Proveedoras:</strong> Importa 178 empresas reales de Bolivia incluyendo proveedores de materiales, constructoras, empresas eléctricas y de diseño con datos de contacto auténticos.</p>
                </div>
              </div>

              {importAPU.isPending && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                    Procesando importación masiva desde insucons.com...
                  </div>
                  <Progress value={undefined} className="w-full" />
                  <p className="text-xs text-gray-500">
                    Extrayendo todos los grupos, APUs y composiciones. Por favor espera...
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resultados de la importación */}
        {importStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Resultados de la Importación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-700">
                      {importStatus.imported}
                    </div>
                    <div className="text-sm text-green-600">
                      Composiciones importadas exitosamente
                    </div>
                  </div>

                  {importStatus.errors > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-yellow-700">
                        {importStatus.errors}
                      </div>
                      <div className="text-sm text-yellow-600">
                        Actividades no encontradas o con errores
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Próximos pasos</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Las actividades ahora tienen composiciones definidas</li>
                    <li>• Puedes revisar y ajustar las composiciones en la sección de Actividades</li>
                    <li>• Los precios se calcularán automáticamente al crear presupuestos</li>
                    <li>• Los costos se actualizan cuando cambies precios de materiales</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}