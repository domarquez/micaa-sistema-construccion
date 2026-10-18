import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, Lock, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import WhatsAppCodeFlow from "@/components/WhatsAppCodeFlow";

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
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
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
        description: "Revisá tu email (también la carpeta de spam) para obtener el código de verificación",
      });

      setRecoveryStep('verify');
    } catch (error: any) {
      const errorMessage = error.message || 'Error de conexión. Intentá de nuevo.';
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

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Error al restablecer contraseña');
      }

      toast({
        title: "Contraseña actualizada",
        description: `Tu usuario es: ${data.username}. Ya podés iniciar sesión con tu nueva contraseña.`,
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
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-8 sm:py-12">
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al inicio
      </Link>

      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">MICAA</CardTitle>
          <CardDescription>
            Precios y presupuestos de construcción en Bolivia
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showPasswordRecovery ? (
            <>
              {/* Opción principal: WhatsApp (sin contraseña). Este dispositivo queda recordado 1 año. */}
              <div className="mb-3 sm:mb-4">
                <p className="text-center text-xs sm:text-sm font-medium mb-2">Entrá con tu WhatsApp</p>
                <WhatsAppCodeFlow
                  mode="login"
                  onSuccess={(data) => {
                    localStorage.setItem('auth_token', data.token);
                    window.location.href = '/';
                  }}
                />
              </div>

              <div className="relative my-3 sm:my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs sm:text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">o</span>
                </div>
              </div>

              {!showPasswordLogin ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordLogin(true)}
                  className="w-full text-center text-xs sm:text-xs md:text-sm text-muted-foreground hover:underline"
                  data-testid="button-show-password-login"
                >
                  Entrar con usuario y contraseña
                </button>
              ) : (
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
                    placeholder="Ingresá tu usuario"
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
                    placeholder="Ingresá tu contraseña"
                    className="text-xs sm:text-sm h-8 sm:h-9 md:h-10"
                    data-testid="input-login-password"
                  />
                </div>
                {error && (
                  <div className="text-red-600 text-xs sm:text-xs bg-red-50 p-1.5 sm:p-2 md:p-3 rounded-md border border-red-200">
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
                  className="text-xs sm:text-xs md:text-sm text-primary hover:underline"
                  data-testid="button-forgot-password"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              </>
              )}

              <div className="mt-3 sm:mt-4 md:mt-6 text-center">
                <p className="text-xs sm:text-xs md:text-sm text-muted-foreground">
                  ¿No tenés cuenta? Entrá con WhatsApp y se crea sola.{" "}
                  <Link href="/register" className="text-primary hover:underline font-medium">
                    Registro con correo
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {recoveryStep === 'email' && (
                <>
                  <div className="text-center mb-4">
                    <Mail className="w-12 h-12 text-primary mx-auto mb-2" />
                    <h3 className="text-lg font-semibold">Recuperar Contraseña</h3>
                    <p className="text-sm text-muted-foreground">
                      Ingresá tu email para recibir un código
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
                    
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isRecoveryLoading} data-testid="button-send-recovery-code">
                      <Mail className="w-4 h-4 mr-2" />
                      {isRecoveryLoading ? "Enviando..." : "Enviar Código"}
                    </Button>
                  </form>
                </>
              )}

              {recoveryStep === 'verify' && (
                <>
                  <div className="text-center mb-4">
                    <Mail className="w-12 h-12 text-primary mx-auto mb-2" />
                    <h3 className="text-lg font-semibold">Verificar Código</h3>
                    <p className="text-sm text-muted-foreground">
                      Ingresá el código de 6 dígitos que recibiste
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
                    
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90" data-testid="button-verify-recovery-code">
                      Verificar Código
                    </Button>
                  </form>

                  <div className="text-center">
                    <button 
                      type="button"
                      onClick={handleSendRecoveryCode}
                      className="text-sm text-primary hover:underline"
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
                    <p className="text-sm text-muted-foreground">
                      Creá una nueva contraseña para tu cuenta
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
                  className="text-sm text-muted-foreground hover:underline"
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
