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
import { Construction, User, Lock, UserPlus, Phone, CheckCircle, MessageCircle } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

type Step = 'phone' | 'verify' | 'details';

export default function Register() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState("");
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
    mutationFn: async (phoneNumber: string) => {
      const response = await fetch('/api/auth/whatsapp/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, type: 'register' })
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
        description: "Revisa tu WhatsApp para obtener el código de verificación",
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
    mutationFn: async ({ phone, code }: { phone: string; code: string }) => {
      const response = await fetch('/api/auth/whatsapp/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Código inválido');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Número verificado",
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
        body: JSON.stringify({ ...userData, phone })
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
        description: "Tu cuenta ha sido creada. Recibirás un mensaje de bienvenida en WhatsApp.",
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
    
    if (!phone || phone.length < 8) {
      toast({
        title: "Número inválido",
        description: "Ingresa un número de teléfono válido",
        variant: "destructive",
      });
      return;
    }

    sendCodeMutation.mutate(phone);
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

    verifyCodeMutation.mutate({ phone, code: verificationCode });
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
          <p className="text-[10px] sm:text-xs md:text-sm text-gray-600">Registro con WhatsApp</p>
          
          <div className="flex justify-center gap-2 mt-3">
            <div className={`flex items-center gap-1 text-xs ${step === 'phone' ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 'phone' ? 'bg-green-500 text-white' : 'bg-green-500 text-white'}`}>
                {step === 'phone' ? '1' : <CheckCircle className="w-4 h-4" />}
              </div>
              <span className="hidden sm:inline">Teléfono</span>
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
          {step === 'phone' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="text-center mb-4">
                <SiWhatsapp className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Ingresa tu número de WhatsApp para recibir un código de verificación
                </p>
              </div>
              
              <div>
                <Label htmlFor="phone" className="text-sm">Número de WhatsApp *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="pl-10"
                    placeholder="70012345"
                    required
                    data-testid="input-phone"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Ingresa solo los números sin el código de país
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={sendCodeMutation.isPending}
                data-testid="button-send-code"
              >
                <SiWhatsapp className="w-4 h-4 mr-2" />
                {sendCodeMutation.isPending ? 'Enviando...' : 'Enviar Código por WhatsApp'}
              </Button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center mb-4">
                <MessageCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Ingresa el código de 6 dígitos que recibiste en WhatsApp
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Enviado a: {phone}
                </p>
              </div>
              
              <div>
                <Label htmlFor="code" className="text-sm">Código de Verificación *</Label>
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
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={verifyCodeMutation.isPending}
                data-testid="button-verify-code"
              >
                {verifyCodeMutation.isPending ? 'Verificando...' : 'Verificar Código'}
              </Button>

              <div className="text-center">
                <button 
                  type="button"
                  onClick={() => sendCodeMutation.mutate(phone)}
                  className="text-sm text-green-600 hover:underline"
                  disabled={sendCodeMutation.isPending}
                >
                  ¿No recibiste el código? Reenviar
                </button>
              </div>
            </form>
          )}

          {step === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-700">WhatsApp verificado: {phone}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="firstName" className="text-xs">Nombre</Label>
                  <div className="relative">
                    <User className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                    <Input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      className="pl-7 text-sm h-8"
                      placeholder="Nombre"
                      data-testid="input-first-name"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="lastName" className="text-xs">Apellido</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className="text-sm h-8"
                    placeholder="Apellido"
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="userType" className="text-xs">Tipo de Usuario *</Label>
                <Select value={formData.userType} onValueChange={(value) => handleChange('userType', value)}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-user-type">
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="architect">Arquitecto/Diseñador</SelectItem>
                    <SelectItem value="constructor">Constructor/Contratista</SelectItem>
                    <SelectItem value="supplier">Empresa Proveedora</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="username" className="text-xs">Usuario *</Label>
                <div className="relative">
                  <UserPlus className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                  <Input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    className="pl-7 text-sm h-8"
                    placeholder="Nombre de usuario"
                    required
                    data-testid="input-username"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-xs">Contraseña *</Label>
                <div className="relative">
                  <Lock className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="pl-7 text-sm h-8"
                    placeholder="Mínimo 6 caracteres"
                    required
                    data-testid="input-password"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-xs">Confirmar Contraseña *</Label>
                <div className="relative">
                  <Lock className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    className="pl-7 text-sm h-8"
                    placeholder="Confirmar contraseña"
                    required
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary-variant"
                disabled={registerMutation.isPending}
                data-testid="button-register"
              >
                {registerMutation.isPending ? 'Creando cuenta...' : 'Crear Cuenta'}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-600">
              ¿Ya tienes una cuenta?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
