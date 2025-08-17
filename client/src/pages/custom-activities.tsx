import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, ArrowLeft, Plus } from "lucide-react";
import { Link } from "wouter";
import CustomActivityManagerDB from "@/components/custom-activity-manager-db";
import CustomActivityEditor from "@/components/custom-activity-editor";
import { apiRequest } from "@/lib/queryClient";

interface CustomActivity {
  id: number;
  userId: number;
  name: string;
  unit: string;
  description?: string;
  phaseId: number;
  phase?: { id: number; name: string; };
  createdAt: string;
  updatedAt: string;
}

export default function CustomActivities() {
  const [editingActivity, setEditingActivity] = useState<CustomActivity | null>(null);

  // Load statistics from database
  const { data: customActivities } = useQuery({
    queryKey: ['/api/custom-activities'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/custom-activities');
      return response.json();
    }
  });

  const { data: userActivities } = useQuery({
    queryKey: ['/api/user-activities'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user-activities');
      return response.json();
    }
  });

  const handleEditActivity = (activity: any) => {
    // Convert user activity to CustomActivity format for editing
    const editableActivity = {
      id: activity.id,
      userId: activity.userId,
      name: activity.customActivityName || activity.name,
      unit: activity.unit,
      description: activity.description,
      phaseId: activity.phaseId,
      phase: activity.phase,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
      customActivityId: activity.customActivityId || activity.id + 10000
    };
    setEditingActivity(editableActivity);
  };

  const handleBackFromEdit = () => {
    setEditingActivity(null);
  };

  const handleActivitySelect = (activity: CustomActivity) => {
    // For now, just show a message. Later can integrate with budget creation
    alert(`Actividad "${activity.name}" seleccionada. Funcionalidad de agregar a presupuesto próximamente.`);
  };

  if (editingActivity) {
    return (
      <CustomActivityEditor
        activity={editingActivity}
        onBack={handleBackFromEdit}
      />
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Volver al Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Actividades Personalizadas</h1>
            <p className="text-gray-600">
              Crea y gestiona tus propias actividades de construcción personalizadas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Actividades Nuevas</p>
                <p className="text-2xl font-bold text-primary">
                  {customActivities?.length || 0}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Settings className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Actividades</p>
                <p className="text-2xl font-bold text-green-600">
                  {(customActivities?.length || 0) + (userActivities?.length || 0)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Plus className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Actividades Duplicadas</p>
                <p className="text-2xl font-bold text-orange-600">
                  {userActivities?.length || 0}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <Settings className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="activities" className="space-y-6">
        <TabsList>
          <TabsTrigger value="activities">Mis Actividades</TabsTrigger>
          <TabsTrigger value="materials">Materiales Personalizados</TabsTrigger>
          <TabsTrigger value="guide">Guía de Uso</TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="space-y-6">
          {/* Actividades Creadas Manualmente - PRIMERO */}
          <CustomActivityManagerDB onEditActivity={handleEditActivity} />
          
          {/* Actividades Duplicadas (Verde) - SEGUNDO */}
          {userActivities && userActivities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">🟢 Actividades Duplicadas del Sistema</CardTitle>
                <p className="text-sm text-gray-600">
                  Actividades que duplicaste desde el catálogo principal y puedes personalizar
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {userActivities.map((activity: any) => (
                    <div 
                      key={activity.id} 
                      className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {activity.customActivityName}
                          <span className="text-green-700 font-semibold text-sm ml-2 bg-green-100 px-2 py-1 rounded">
                            (Personalizada)
                          </span>
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {activity.phase?.name || 'Sin Fase'}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            Unidad: {activity.unit}
                          </span>
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            ID: {activity.customActivityId}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditActivity(activity)}
                          className="gap-2"
                        >
                          <Settings className="w-4 h-4" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="materials" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Materiales Personalizados</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const materials = JSON.parse(localStorage.getItem('userMaterialPrices') || '[]');
                
                if (materials.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">Aún no tienes materiales personalizados</p>
                      <p className="text-sm text-gray-500">
                        Ve a cualquier presupuesto y personaliza los precios de los materiales para agregarlos aquí
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {materials.map((material: any) => (
                      <div key={material.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{material.customName}</p>
                          <p className="text-sm text-gray-600">
                            Original: {material.originalName} • {material.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">Bs {parseFloat(material.price).toFixed(2)}</p>
                          <p className="text-xs text-gray-500">
                            Guardado: {new Date(material.savedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guide" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Guía de Uso - Actividades Personalizadas</CardTitle>
            </CardHeader>
            <CardContent className="prose max-w-none">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">¿Qué son las actividades personalizadas?</h3>
                  <p className="text-gray-600">
                    Las actividades personalizadas te permiten crear y modificar actividades de construcción 
                    según tus necesidades específicas. Puedes cambiar nombres, precios, agregar o quitar 
                    materiales, y tener tu propia base de datos de actividades.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Cómo crear actividades personalizadas:</h3>
                  <ul className="list-decimal list-inside space-y-2 text-gray-600">
                    <li>Haz clic en "Nueva Actividad" para crear una desde cero</li>
                    <li>O ve a cualquier presupuesto y haz clic en "Copiar y Personalizar" en una actividad existente</li>
                    <li>Edita el nombre, descripción y unidad de medida</li>
                    <li>Agrega, modifica o elimina materiales, mano de obra y equipos</li>
                    <li>Guarda tu actividad personalizada</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Personalizar materiales:</h3>
                  <ul className="list-decimal list-inside space-y-2 text-gray-600">
                    <li>En cualquier presupuesto, expande una actividad</li>
                    <li>Haz clic en el ícono de edición junto a un material</li>
                    <li>Cambia el nombre y precio del material</li>
                    <li>El material personalizado se guardará en tu lista</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Usar en presupuestos:</h3>
                  <p className="text-gray-600">
                    Próximamente podrás usar tus actividades personalizadas directamente en nuevos presupuestos, 
                    creando una experiencia completamente personalizada para tus proyectos de construcción.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}