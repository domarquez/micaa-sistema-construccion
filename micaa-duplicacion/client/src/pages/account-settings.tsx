import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Settings, Shield } from "lucide-react";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export default function AccountSettings() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configuración de Cuenta</h1>
        <p className="text-gray-600 mt-2">
          Gestiona tu perfil y configuraciones de seguridad
        </p>
      </div>

      <Tabs defaultValue="security" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Seguridad
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Preferencias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
              <CardDescription>
                Actualiza tu información de perfil
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Funcionalidad de edición de perfil próximamente disponible.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6 mt-6">
          <div className="grid gap-6">
            <div className="flex justify-center">
              <ChangePasswordForm />
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Sesiones Activas</CardTitle>
                <CardDescription>
                  Gestiona tus sesiones y dispositivos conectados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Funcionalidad de gestión de sesiones próximamente disponible.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferencias de Sistema</CardTitle>
              <CardDescription>
                Configura el comportamiento de la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Configuraciones de preferencias próximamente disponibles.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}