import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction, ArrowLeft, Mail, Lock, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

type RecoveryStep = 'email' | 'verify' | 'newPassword';

export default function Login() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('email');
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
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
      
      window.location.href = '/';
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRecoveryLoading(true);

    try {
      const response = await fetch('/api/auth/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail, type: 'password_reset' })
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Error al enviar código');
      }

      toast({
        title: "Código enviado",
        description: "Revisa tu email (también la carpeta de spam) para obtener el código de verificación",
      });

      setRecoveryStep('verify');
    } catch (error: any) {
      const errorMessage = error.message || 'Error de conexión. Intenta de nuevo.';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsRecoveryLoading(false);
    }
  };

  const handleVerifyRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Código inválido",
        description: "El código debe tener 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    setRecoveryStep('newPassword');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmNewPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setIsRecoveryLoading(true);

    try {
      const response = await fetch('/api/auth/email/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: recoveryEmail, 
          code: verificationCode,
          newPassword: newPassword 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al restablecer contraseña');
      }

      toast({
        title: "Contraseña actualizada",
        description: "Ya puedes iniciar sesión con tu nueva contraseña",
      });

      setShowPasswordRecovery(false);
      setRecoveryStep('email');
      setRecoveryEmail("");
      setVerificationCode("");
      setNewPassword("");
      setConfirmNewPassword("");
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

  const resetRecovery = () => {
    setShowPasswordRecovery(false);
    setRecoveryStep('email');
    setRecoveryEmail("");
    setVerificationCode("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100 px-2 sm:px-4 py-4 sm:py-8 safe-area-inset-top safe-area-inset-bottom overflow-x-hidden flex flex-col items-center justify-center">
      <div className="absolute top-1 sm:top-2 md:top-4 left-1 sm:left-2 md:left-4 z-10">
        <Link href="/">
          <Button variant="outline" size="sm" className="flex items-center gap-1 sm:gap-2 mobile-ultra-compact text-[10px] sm:text-xs md:text-sm px-1 sm:px-2 py-0.5 sm:py-1 h-6 sm:h-7 md:h-8">
            <ArrowLeft className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Volver</span>
          </Button>
        </Link>
      </div>

      <Card className="auth-card w-full sm:max-w-xs md:max-w-md shadow-lg">
        <CardHeader className="text-center p-2 sm:p-4 md:p-6">
          <div className="mx-auto w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-primary rounded-lg flex items-center justify-center mb-2 sm:mb-3 md:mb-4">
            <Construction className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
          </div>
          <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold">MICAA</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Sistema de presupuestos
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 sm:p-4 md:p-6">
          {!showPasswordRecovery ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3 md:space-y-4">
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="username" className="text-xs sm:text-sm">Usuario</Label>
                  <Input
                    id="username"
                    type="text"
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    required
                    placeholder="Ingresa tu usuario"
                    className="text-xs sm:text-sm h-8 sm:h-9 md:h-10"
                    data-testid="input-login-username"
                  />
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="password" className="text-xs sm:text-sm">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    required
                    placeholder="Ingresa tu contraseña"
                    className="text-xs sm:text-sm h-8 sm:h-9 md:h-10"
                    data-testid="input-login-password"
                  />
                </div>
                {error && (
                  <div className="text-red-600 text-[10px] sm:text-xs bg-red-50 p-1.5 sm:p-2 md:p-3 rounded-md border border-red-200">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full text-xs sm:text-sm h-8 sm:h-9 md:h-10" disabled={isLoading} data-testid="button-login">
                  {isLoading ? "Iniciando..." : "Iniciar Sesión"}
                </Button>
              </form>
              
              <div className="mt-2 sm:mt-3 md:mt-4 text-center">
                <button 
                  type="button"
                  onClick={() => setShowPasswordRecovery(true)}
                  className="text-[10px] sm:text-xs md:text-sm text-primary hover:underline"
                  data-testid="button-forgot-password"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <div className="mt-3 sm:mt-4 md:mt-6 text-center">
                <p className="text-[10px] sm:text-xs md:text-sm text-gray-600">
                  ¿No tienes cuenta?{" "}
                  <Link href="/register" className="text-primary hover:underline font-medium">
                    Regístrate aquí
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {recoveryStep === 'email' && (
                <>
                  <div className="text-center mb-4">
                    <Mail className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold">Recuperar Contraseña</h3>
                    <p className="text-sm text-gray-600">
                      Ingresa tu email para recibir un código
                    </p>
                  </div>
                  
                  <form onSubmit={handleSendRecoveryCode} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recovery-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="recovery-email"
                          type="email"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          required
                          placeholder="tu@email.com"
                          className="pl-10"
                          data-testid="input-recovery-email"
                        />
                      </div>
                    </div>
                    
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isRecoveryLoading} data-testid="button-send-recovery-code">
                      <Mail className="w-4 h-4 mr-2" />
                      {isRecoveryLoading ? "Enviando..." : "Enviar Código"}
                    </Button>
                  </form>
                </>
              )}

              {recoveryStep === 'verify' && (
                <>
                  <div className="text-center mb-4">
                    <Mail className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold">Verificar Código</h3>
                    <p className="text-sm text-gray-600">
                      Ingresa el código de 6 dígitos que recibiste
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Enviado a: {recoveryEmail}
                    </p>
                  </div>
                  
                  <form onSubmit={handleVerifyRecoveryCode} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recovery-code">Código de Verificación</Label>
                      <Input
                        id="recovery-code"
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                        placeholder="000000"
                        className="text-center text-2xl tracking-widest"
                        maxLength={6}
                        data-testid="input-recovery-code"
                      />
                    </div>
                    
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" data-testid="button-verify-recovery-code">
                      Verificar Código
                    </Button>
                  </form>

                  <div className="text-center">
                    <button 
                      type="button"
                      onClick={handleSendRecoveryCode}
                      className="text-sm text-blue-600 hover:underline"
                      disabled={isRecoveryLoading}
                    >
                      ¿No recibiste el código? Reenviar
                    </button>
                  </div>
                </>
              )}

              {recoveryStep === 'newPassword' && (
                <>
                  <div className="text-center mb-4">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold">Nueva Contraseña</h3>
                    <p className="text-sm text-gray-600">
                      Crea una nueva contraseña para tu cuenta
                    </p>
                  </div>
                  
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nueva Contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          placeholder="Mínimo 6 caracteres"
                          className="pl-10"
                          data-testid="input-new-password"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-new-password">Confirmar Contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="confirm-new-password"
                          type="password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          required
                          placeholder="Confirmar contraseña"
                          className="pl-10"
                          data-testid="input-confirm-new-password"
                        />
                      </div>
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={isRecoveryLoading} data-testid="button-reset-password">
                      {isRecoveryLoading ? "Actualizando..." : "Actualizar Contraseña"}
                    </Button>
                  </form>
                </>
              )}
              
              <div className="text-center">
                <button 
                  type="button"
                  onClick={resetRecovery}
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
