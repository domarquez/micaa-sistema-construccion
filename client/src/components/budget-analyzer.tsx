import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Calculator,
  FileText,
  Download
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface BudgetAnalysis {
  totalBudget: number;
  totalExecuted: number;
  variance: number;
  efficiency: number;
  phases: Array<{
    name: string;
    budgeted: number;
    executed: number;
    variance: number;
  }>;
  categories: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  monthlyExecution: Array<{
    month: string;
    budgeted: number;
    executed: number;
  }>;
}

export function BudgetAnalyzer() {
  const [analysis] = useState<BudgetAnalysis>({
    totalBudget: 700000,
    totalExecuted: 225200,
    variance: -12500,
    efficiency: 87.5,
    phases: [
      { name: "Preliminares", budgeted: 45000, executed: 43200, variance: -1800 },
      { name: "Estructura", budgeted: 280000, executed: 182000, variance: -98000 },
      { name: "Mampostería", budgeted: 120000, executed: 0, variance: -120000 },
      { name: "Instalaciones", budgeted: 95000, executed: 0, variance: -95000 },
      { name: "Acabados", budgeted: 160000, executed: 0, variance: -160000 }
    ],
    categories: [
      { name: "Materiales", value: 135120, color: "#3B82F6" },
      { name: "Mano de Obra", value: 67560, color: "#10B981" },
      { name: "Equipos", value: 13560, color: "#F59E0B" },
      { name: "Administrativo", value: 8960, color: "#8B5CF6" }
    ],
    monthlyExecution: [
      { month: "Ene", budgeted: 45000, executed: 43200 },
      { month: "Feb", budgeted: 140000, executed: 127000 },
      { month: "Mar", budgeted: 95000, executed: 55000 },
      { month: "Abr", budgeted: 120000, executed: 0 },
      { month: "May", budgeted: 160000, executed: 0 },
      { month: "Jun", budgeted: 140000, executed: 0 }
    ]
  });

  const executionPercentage = (analysis.totalExecuted / analysis.totalBudget) * 100;
  const variancePercentage = (analysis.variance / analysis.totalBudget) * 100;

  const RADIAN = Math.PI / 180;
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return "text-green-600";
    if (variance < -5000) return "text-red-600";
    return "text-yellow-600";
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (variance < -5000) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Presupuesto Total</p>
                <p className="text-2xl font-bold">{formatCurrency(analysis.totalBudget)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ejecutado</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(analysis.totalExecuted)}</p>
                <p className="text-sm text-gray-500">{executionPercentage.toFixed(1)}% del total</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Variación</p>
                <p className={`text-2xl font-bold ${getVarianceColor(analysis.variance)}`}>
                  {formatCurrency(Math.abs(analysis.variance))}
                </p>
                <p className="text-sm text-gray-500">{variancePercentage.toFixed(1)}% del presupuesto</p>
              </div>
              {getVarianceIcon(analysis.variance)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Eficiencia</p>
                <p className="text-2xl font-bold text-blue-600">{analysis.efficiency}%</p>
                <Progress value={analysis.efficiency} className="mt-2" />
              </div>
              <Calculator className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Análisis Detallado del Presupuesto</CardTitle>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar Reporte
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="phases" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="phases">Por Fases</TabsTrigger>
              <TabsTrigger value="categories">Por Categorías</TabsTrigger>
              <TabsTrigger value="timeline">Cronograma</TabsTrigger>
            </TabsList>

            <TabsContent value="phases" className="space-y-4">
              <div className="space-y-4">
                {analysis.phases.map((phase, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">{phase.name}</h3>
                      <Badge variant={phase.variance < -5000 ? "destructive" : phase.variance < 0 ? "secondary" : "default"}>
                        {phase.variance > 0 ? "+" : ""}{formatCurrency(phase.variance)}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Presupuestado</p>
                        <p className="font-medium">{formatCurrency(phase.budgeted)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Ejecutado</p>
                        <p className="font-medium">{formatCurrency(phase.executed)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Progreso</p>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={phase.executed > 0 ? (phase.executed / phase.budgeted) * 100 : 0} 
                            className="flex-1" 
                          />
                          <span className="text-xs font-medium">
                            {phase.executed > 0 ? ((phase.executed / phase.budgeted) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analysis.categories}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomLabel}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {analysis.categories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-4">
                  {analysis.categories.map((category, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(category.value)}</p>
                        <p className="text-sm text-gray-500">
                          {((category.value / analysis.totalExecuted) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.monthlyExecution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="budgeted" fill="#3B82F6" name="Presupuestado" />
                    <Bar dataKey="executed" fill="#10B981" name="Ejecutado" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-yellow-800">Recomendaciones</h3>
                    <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                      <li>• El proyecto está retrasado en la ejecución presupuestaria</li>
                      <li>• Se recomienda acelerar las actividades de la fase de estructura</li>
                      <li>• Considerar renegociar precios con proveedores para optimizar costos</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}