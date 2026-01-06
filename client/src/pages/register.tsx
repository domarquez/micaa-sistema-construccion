import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Construction, User, Lock, UserPlus, Mail, CheckCircle } from "lucide-react";

type Step = 'email' | 'verify' | 'details';

export default function Register() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    userType: "architect",
  });
  const { toast } = useToast();

  const sendCodeMutation = useMutation({
    mutationFn: async (emailAddress: string) => {
      const response = await fetch('/api/auth/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddress, type: 'register' })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al enviar código');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Código enviado",
        description: "Revisa tu email para obtener el código de verificación",
      });
      setStep('verify');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const response = await fetch('/api/auth/email/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Código inválido');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email verificado",
        description: "Ahora completa tu información para crear la cuenta",
      });
      setStep('details');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userData, email })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error en el registro');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Registro exitoso",
        description: "Tu cuenta ha sido creada. Ya puedes iniciar sesión.",
      });
      window.location.href = "/login";
    },
    onError: (error: Error) => {
      toast({
        title: "Error en el registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      toast({
        title: "Email inválido",
        description: "Ingresa una dirección de email válida",
        variant: "destructive",
      });
      return;
    }

    sendCodeMutation.mutate(email);
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Código inválido",
        description: "El código debe tener 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    verifyCodeMutation.mutate({ email, code: verificationCode });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      toast({
        title: "Campos requeridos",
        description: "Por favor complete todos los campos obligatorios",
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Contraseñas no coinciden",
        description: "Por favor verifique que las contraseñas sean iguales",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    const { confirmPassword, ...userData } = formData;
    registerMutation.mutate(userData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100 px-2 sm:px-4 py-4 sm:py-8 safe-area-inset-top safe-area-inset-bottom overflow-x-hidden flex flex-col items-center justify-center">
      <Card className="auth-card w-full sm:max-w-xs md:max-w-md shadow-lg">
        <CardHeader className="text-center p-2 sm:p-4 md:p-6">
          <div className="mx-auto mb-2 sm:mb-3 md:mb-4 p-2 sm:p-3 bg-primary/10 rounded-full w-fit">
            <Construction className="w-4 h-4 sm:w-6 sm:h-6 md:w-8 md:h-8 text-primary" />
          </div>
          <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold">Crear Cuenta</CardTitle>
          <p className="text-[10px] sm:text-xs md:text-sm text-gray-600">Registro con Email</p>
          
          <div className="flex justify-center gap-2 mt-3">
            <div className={`flex items-center gap-1 text-xs ${step === 'email' ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 'email' ? 'bg-green-500 text-white' : 'bg-green-500 text-white'}`}>
                {step === 'email' ? '1' : <CheckCircle className="w-4 h-4" />}
              </div>
              <span className="hidden sm:inline">Email</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-200 self-center" />
            <div className={`flex items-center gap-1 text-xs ${step === 'verify' ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 'verify' ? 'bg-green-500 text-white' : step === 'details' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
                {step === 'details' ? <CheckCircle className="w-4 h-4" /> : '2'}
              </div>
              <span className="hidden sm:inline">Verificar</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-200 self-center" />
            <div className={`flex items-center gap-1 text-xs ${step === 'details' ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 'details' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
                3
              </div>
              <span className="hidden sm:inline">Datos</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-2 sm:p-4 md:p-6">
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="text-center mb-4">
                <Mail className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Ingresa tu email para recibir un código de verificación
                </p>
              </div>
              
              <div>
                <Label htmlFor="email" className="text-sm">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    placeholder="tu@email.com"
                    required
                    data-testid="input-email"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Recibirás un código de 6 dígitos
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={sendCodeMutation.isPending}
                data-testid="button-send-code"
              >
                {sendCodeMutation.isPending ? (
                  "Enviando..."
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Enviar Código
                  </>
                )}
              </Button>

              <div className="text-center text-xs sm:text-sm">
                <span className="text-gray-600">¿Ya tienes cuenta? </span>
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Iniciar sesión
                </Link>
              </div>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm text-gray-600">
                  Ingresa el código enviado a
                </p>
                <p className="font-medium text-blue-600 text-sm">{email}</p>
              </div>

              <div>
                <Label htmlFor="code" className="text-sm">Código de verificación *</Label>
                <Input
                  id="code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  required
                  data-testid="input-verification-code"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={verifyCodeMutation.isPending}
                data-testid="button-verify-code"
              >
                {verifyCodeMutation.isPending ? "Verificando..." : "Verificar Código"}
              </Button>

              <div className="flex justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Cambiar email
                </button>
                <button
                  type="button"
                  onClick={() => sendCodeMutation.mutate(email)}
                  className="text-blue-600 hover:underline"
                  disabled={sendCodeMutation.isPending}
                >
                  Reenviar código
                </button>
              </div>
            </form>
          )}

          {step === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="text-center mb-2">
                <div className="flex items-center justify-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>Email verificado: {email}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="firstName" className="text-xs sm:text-sm">Nombre</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className="text-sm"
                    placeholder="Juan"
                    data-testid="input-first-name"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-xs sm:text-sm">Apellido</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className="text-sm"
                    placeholder="Pérez"
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="username" className="text-xs sm:text-sm">Usuario *</Label>
                <div className="relative">
                  <User className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
                  <Input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    className="pl-7 sm:pl-10 text-sm"
                    placeholder="usuario"
                    required
                    data-testid="input-username"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-xs sm:text-sm">Contraseña *</Label>
                <div className="relative">
                  <Lock className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="pl-7 sm:pl-10 text-sm"
                    placeholder="••••••••"
                    required
                    data-testid="input-password"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-xs sm:text-sm">Confirmar Contraseña *</Label>
                <div className="relative">
                  <Lock className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    className="pl-7 sm:pl-10 text-sm"
                    placeholder="••••••••"
                    required
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="userType" className="text-xs sm:text-sm">Tipo de Usuario</Label>
                <Select
                  value={formData.userType}
                  onValueChange={(value) => handleChange('userType', value)}
                >
                  <SelectTrigger className="text-sm" data-testid="select-user-type">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="architect">Arquitecto</SelectItem>
                    <SelectItem value="engineer">Ingeniero</SelectItem>
                    <SelectItem value="contractor">Contratista</SelectItem>
                    <SelectItem value="supplier">Proveedor</SelectItem>
                    <SelectItem value="student">Estudiante</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full text-sm"
                disabled={registerMutation.isPending}
                data-testid="button-register"
              >
                {registerMutation.isPending ? (
                  "Creando cuenta..."
                ) : (
                  <>
                    <UserPlus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Crear Cuenta
                  </>
                )}
              </Button>

              <div className="text-center text-xs sm:text-sm">
                <span className="text-gray-600">¿Ya tienes cuenta? </span>
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Iniciar sesión
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-[10px] sm:text-xs text-gray-500 mt-4 px-4">
        Al registrarte, aceptas nuestros términos de servicio y política de privacidad
      </p>
    </div>
  );
}
