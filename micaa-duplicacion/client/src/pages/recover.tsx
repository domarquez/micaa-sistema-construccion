import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction, Mail, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function Recover() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        toast({
          title: "Credenciales enviadas",
          description: "Revisa tu email para obtener tus credenciales de acceso",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Error al procesar la solicitud",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Error de conexión. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-700">Email Enviado</CardTitle>
            <CardDescription>
              Hemos enviado tus credenciales de acceso a tu email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                Revisa tu bandeja de entrada (y carpeta de spam) para encontrar tu usuario y contraseña temporal.
              </p>
              
              <div className="space-y-2">
                <Button asChild className="w-full">
                  <Link href="/login">
                    Ir a Iniciar Sesión
                  </Link>
                </Button>
                
                <Button variant="outline" asChild className="w-full">
                  <Link href="/public">
                    Continuar como Visitante
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
            <Construction className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Recuperar Credenciales</CardTitle>
          <CardDescription>
            Ingresa tu email para recibir tu usuario y contraseña
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu-email@ejemplo.com"
                className="w-full"
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
              <div className="flex items-start space-x-2">
                <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Información importante
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Te enviaremos tanto tu nombre de usuario como una contraseña temporal por email. 
                    Te recomendamos cambiar la contraseña después de iniciar sesión.
                  </p>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar Credenciales"}
            </Button>

            <div className="text-center space-y-3">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                asChild
              >
                <Link href="/public">
                  Continuar como Visitante
                </Link>
              </Button>
              
              <div className="flex items-center justify-center space-x-4 text-sm">
                <Link href="/login" className="text-blue-600 hover:underline flex items-center">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Volver al Login
                </Link>
                <span className="text-gray-400">|</span>
                <Link href="/register" className="text-blue-600 hover:underline">
                  Crear Cuenta
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}