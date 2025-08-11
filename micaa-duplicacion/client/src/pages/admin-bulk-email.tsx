import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Mail, Send, Clock, CheckCircle, XCircle, Users, AlertTriangle } from 'lucide-react';

interface BulkEmailJob {
  id: string;
  template: string;
  subject: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  sentCount: number;
  totalCount: number;
  createdAt: string;
  completedAt?: string;
  errors: string[];
}

interface CompanyPreview {
  totalCompanies: number;
  companies: Array<{
    to: string;
    companyName: string;
    contactName: string;
  }>;
  estimatedTime: string;
}

export default function AdminBulkEmail() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customSubject, setCustomSubject] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch jobs
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<BulkEmailJob[]>({
    queryKey: ['/api/admin/bulk-email'],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch companies preview
  const { data: preview } = useQuery<CompanyPreview>({
    queryKey: ['/api/admin/bulk-email-preview'],
  });

  // Create bulk email job mutation
  const createJobMutation = useMutation({
    mutationFn: async (data: { template: string; customSubject?: string }) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/bulk-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to create bulk email job');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bulk-email'] });
      toast({
        title: "Envío masivo iniciado",
        description: `Se enviaron emails de prueba y se comenzó el envío a ${preview?.totalCompanies || 0} empresas. Tiempo estimado: ${preview?.estimatedTime || ''}`,
      });
      setSelectedTemplate('');
      setCustomSubject('');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo iniciar el envío masivo.",
        variant: "destructive",
      });
    },
  });

  // Send test emails only mutation
  const sendTestMutation = useMutation({
    mutationFn: async (data: { template: string; customSubject?: string }) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/bulk-email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to send test emails');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Emails de prueba enviados",
        description: "Se enviaron emails de prueba a domarquez@yahoo.com y grupoeclipsew@gmail.com",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron enviar los emails de prueba.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      toast({
        title: "Error",
        description: "Selecciona un template de email.",
        variant: "destructive",
      });
      return;
    }

    createJobMutation.mutate({
      template: selectedTemplate,
      customSubject: customSubject || undefined
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
      case 'running':
        return <Badge variant="default"><Send className="h-3 w-3 mr-1" />Enviando</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="h-3 w-3 mr-1" />Completado</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTemplateDescription = (template: string) => {
    switch (template) {
      case 'password_update':
        return 'Notifica a las empresas sobre actualizaciones de seguridad y nuevas funcionalidades';
      case 'advertisement_reminder':
        return 'Invita a las empresas a usar el sistema de publicidad para promocionarse';
      case 'data_update':
        return 'Solicita a las empresas actualizar sus datos de contacto y información';
      default:
        return '';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-BO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Envío Masivo de Emails</h1>
          <p className="text-gray-600 mt-2">
            Envía emails a todas las empresas proveedoras del sistema
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Mail className="h-4 w-4 mr-2" />
          Administrador
        </Badge>
      </div>

      {/* Preview Card */}
      {preview && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-800">
              <Users className="h-5 w-5 mr-2" />
              Resumen de Empresas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{preview.totalCompanies}</div>
                <div className="text-sm text-gray-600">Empresas Activas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{preview.estimatedTime}</div>
                <div className="text-sm text-gray-600">Tiempo Estimado</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">5 min</div>
                <div className="text-sm text-gray-600">Pausa entre Emails</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning Card */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800">Importante sobre el Envío Masivo</h3>
              <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                <li>• Los emails se envían con pausas de 5 minutos entre cada uno</li>
                <li>• Se procesan en lotes de 5 emails con pausas de 30 minutos entre lotes</li>
                <li>• Esto evita problemas de spam y mantiene la reputación del servidor</li>
                <li>• El proceso puede tardar varias horas dependiendo del número de empresas</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Job Form */}
      <Card>
        <CardHeader>
          <CardTitle>Crear Nuevo Envío Masivo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="template">Tipo de Email</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo de email" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password_update">Actualización de Contraseña</SelectItem>
                  <SelectItem value="advertisement_reminder">Recordatorio de Publicidad</SelectItem>
                  <SelectItem value="data_update">Actualización de Datos</SelectItem>
                </SelectContent>
              </Select>
              {selectedTemplate && (
                <p className="text-sm text-gray-600 mt-1">
                  {getTemplateDescription(selectedTemplate)}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="customSubject">Asunto Personalizado (Opcional)</Label>
              <Input
                id="customSubject"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Deja vacío para usar el asunto por defecto"
              />
            </div>

            <div className="flex space-x-2">
              <Button 
                type="button" 
                disabled={!selectedTemplate || sendTestMutation.isPending}
                className="flex-1"
                variant="outline"
                onClick={() => {
                  if (!selectedTemplate) return;
                  sendTestMutation.mutate({
                    template: selectedTemplate,
                    customSubject: customSubject || undefined
                  });
                }}
              >
                {sendTestMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Enviando Prueba...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Solo Prueba
                  </>
                )}
              </Button>
              
              <Button 
                type="submit" 
                disabled={!selectedTemplate || createJobMutation.isPending}
                className="flex-1"
              >
                {createJobMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Iniciando Envío...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envío Masivo
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Jobs History */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Envíos</CardTitle>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="text-center py-8">
              <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Cargando trabajos...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No hay envíos masivos registrados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div key={job.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{job.subject}</h3>
                      <p className="text-sm text-gray-600">
                        Template: {job.template} | Creado: {formatDateTime(job.createdAt)}
                      </p>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                    <div>
                      <div className="text-sm text-gray-600">Enviados</div>
                      <div className="font-bold">{job.sentCount}/{job.totalCount}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Progreso</div>
                      <div className="font-bold">
                        {job.totalCount > 0 ? Math.round((job.sentCount / job.totalCount) * 100) : 0}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Errores</div>
                      <div className="font-bold text-red-600">{job.errors.length}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Estado</div>
                      <div className="font-bold">
                        {job.completedAt ? formatDateTime(job.completedAt) : 'En proceso'}
                      </div>
                    </div>
                  </div>

                  {job.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <h4 className="font-semibold text-red-800 mb-1">Errores:</h4>
                      <div className="text-sm text-red-700 space-y-1">
                        {job.errors.slice(0, 3).map((error, index) => (
                          <div key={index}>• {error}</div>
                        ))}
                        {job.errors.length > 3 && (
                          <div>• ... y {job.errors.length - 3} errores más</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}