import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction, ArrowLeft, Mail } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error de autenticación');
      }

      const data = await response.json();
      localStorage.setItem('auth_token', data.token);
      
      // Redirect to dashboard
      window.location.href = '/';
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRecoveryLoading(true);

    try {
      const response = await fetch('/api/auth/password-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al enviar correo de recuperación');
      }

      toast({
        title: "Correo enviado",
        description: "Se ha enviado un correo con tus datos de acceso a tu dirección de email.",
      });

      setShowPasswordRecovery(false);
      setRecoveryEmail("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRecoveryLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Enlace para volver a vista pública */}
      <div className="absolute top-4 left-4">
        <Link href="/public">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Ver versión pública
          </Button>
        </Link>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
            <Construction className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">MICAA</CardTitle>
          <CardDescription>
            Sistema de presupuestos de construcción
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showPasswordRecovery ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Usuario</Label>
                  <Input
                    id="username"
                    type="text"
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    required
                    placeholder="Ingresa tu usuario"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    required
                    placeholder="Ingresa tu contraseña"
                  />
                </div>
                {error && (
                  <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-200">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
                </Button>
              </form>
              
              <div className="mt-4 text-center">
                <button 
                  type="button"
                  onClick={() => setShowPasswordRecovery(true)}
                  className="text-sm text-primary hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  ¿No tienes cuenta?{" "}
                  <Link href="/register" className="text-primary hover:underline">
                    Regístrate aquí
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <Mail className="w-12 h-12 text-primary mx-auto mb-2" />
                <h3 className="text-lg font-semibold">Recuperar Contraseña</h3>
                <p className="text-sm text-gray-600">
                  Ingresa tu email y te enviaremos tus datos de acceso
                </p>
              </div>
              
              <form onSubmit={handlePasswordRecovery} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">Correo Electrónico</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                    placeholder="tu@email.com"
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isRecoveryLoading}>
                  {isRecoveryLoading ? "Enviando..." : "Enviar datos de acceso"}
                </Button>
              </form>
              
              <div className="text-center">
                <button 
                  type="button"
                  onClick={() => setShowPasswordRecovery(false)}
                  className="text-sm text-gray-600 hover:underline"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}