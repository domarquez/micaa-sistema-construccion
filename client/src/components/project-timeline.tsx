import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  MoreHorizontal,
  Plus
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ProjectPhase {
  id: string;
  name: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "delayed";
  startDate: Date;
  endDate: Date;
  progress: number;
  budget: number;
  spent: number;
  activities: number;
  completedActivities: number;
}

export function ProjectTimeline() {
  const [phases] = useState<ProjectPhase[]>([
    {
      id: "1",
      name: "Trabajos Preliminares",
      description: "Limpieza, replanteo y excavaciones",
      status: "completed",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-01-15"),
      progress: 100,
      budget: 45000,
      spent: 43200,
      activities: 8,
      completedActivities: 8
    },
    {
      id: "2", 
      name: "Estructura",
      description: "Cimientos, columnas y vigas",
      status: "in-progress",
      startDate: new Date("2025-01-16"),
      endDate: new Date("2025-03-15"),
      progress: 65,
      budget: 280000,
      spent: 182000,
      activities: 15,
      completedActivities: 10
    },
    {
      id: "3",
      name: "Mampostería",
      description: "Muros y tabiques",
      status: "pending",
      startDate: new Date("2025-02-15"),
      endDate: new Date("2025-04-01"),
      progress: 0,
      budget: 120000,
      spent: 0,
      activities: 12,
      completedActivities: 0
    },
    {
      id: "4",
      name: "Instalaciones",
      description: "Eléctricas, sanitarias y gas",
      status: "pending",
      startDate: new Date("2025-03-01"),
      endDate: new Date("2025-04-30"),
      progress: 0,
      budget: 95000,
      spent: 0,
      activities: 20,
      completedActivities: 0
    },
    {
      id: "5",
      name: "Acabados",
      description: "Pisos, pinturas y detalles finales",
      status: "pending",
      startDate: new Date("2025-04-15"),
      endDate: new Date("2025-06-15"),
      progress: 0,
      budget: 160000,
      spent: 0,
      activities: 18,
      completedActivities: 0
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "in-progress": return "bg-blue-500";
      case "delayed": return "bg-red-500";
      default: return "bg-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "in-progress": return <Play className="w-4 h-4 text-blue-600" />;
      case "delayed": return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <Pause className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "default",
      "in-progress": "secondary", 
      delayed: "destructive",
      pending: "outline"
    } as const;

    const labels = {
      completed: "Completado",
      "in-progress": "En Progreso",
      delayed: "Retrasado", 
      pending: "Pendiente"
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const totalBudget = phases.reduce((sum, phase) => sum + phase.budget, 0);
  const totalSpent = phases.reduce((sum, phase) => sum + phase.spent, 0);
  const overallProgress = phases.reduce((sum, phase) => sum + phase.progress, 0) / phases.length;

  return (
    <div className="space-y-6">
      {/* Project Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Cronograma del Proyecto
            </span>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Fase
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{overallProgress.toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Progreso General</p>
              <Progress value={overallProgress} className="mt-2" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalSpent)}</p>
              <p className="text-sm text-gray-600">Ejecutado</p>
              <p className="text-xs text-gray-500">de {formatCurrency(totalBudget)}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {phases.filter(p => p.status === "completed").length}/{phases.length}
              </p>
              <p className="text-sm text-gray-600">Fases Completadas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Fases del Proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
            
            <div className="space-y-6">
              {phases.map((phase, index) => (
                <div key={phase.id} className="relative flex items-start gap-6">
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-4 border-white ${getStatusColor(phase.status)}`}>
                    <span className="text-white font-bold text-sm">{index + 1}</span>
                  </div>

                  {/* Phase content */}
                  <div className="flex-1 min-w-0">
                    <Card className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{phase.name}</h3>
                            {getStatusIcon(phase.status)}
                            {getStatusBadge(phase.status)}
                          </div>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>

                        <p className="text-gray-600 text-sm mb-4">{phase.description}</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Inicio</p>
                            <p className="text-sm font-medium">
                              {phase.startDate.toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Fin</p>
                            <p className="text-sm font-medium">
                              {phase.endDate.toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Presupuesto</p>
                            <p className="text-sm font-medium">{formatCurrency(phase.budget)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Ejecutado</p>
                            <p className="text-sm font-medium">{formatCurrency(phase.spent)}</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span>Progreso de la fase</span>
                              <span className="font-medium">{phase.progress}%</span>
                            </div>
                            <Progress value={phase.progress} className="h-2" />
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span>Actividades completadas</span>
                            <span className="font-medium">
                              {phase.completedActivities}/{phase.activities}
                            </span>
                          </div>
                        </div>

                        {phase.status === "in-progress" && (
                          <div className="mt-4 flex gap-2">
                            <Button size="sm" variant="outline">
                              <Clock className="w-3 h-3 mr-1" />
                              Ver Actividades
                            </Button>
                            <Button size="sm" variant="outline">
                              Actualizar Progreso
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}