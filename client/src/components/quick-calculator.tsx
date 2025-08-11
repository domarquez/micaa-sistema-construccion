import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Calculator, Copy, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function QuickCalculator() {
  const [values, setValues] = useState({
    materials: 0,
    labor: 0,
    equipment: 5,
    administrative: 8,
    utility: 15,
    tax: 3.09,
    socialCharges: 71.18
  });

  const { toast } = useToast();

  const calculateTotals = () => {
    const materialsTotal = values.materials;
    const laborTotal = values.labor;
    const laborWithCharges = laborTotal * (1 + values.socialCharges / 100);
    const equipmentTotal = materialsTotal * (values.equipment / 100);
    const equipmentWithTools = equipmentTotal * 1.05; // 5% herramientas
    
    const subtotalDirect = materialsTotal + laborWithCharges + equipmentWithTools;
    const administrativeCost = subtotalDirect * (values.administrative / 100);
    const subtotalWithAdmin = subtotalDirect + administrativeCost;
    const utilityCost = subtotalWithAdmin * (values.utility / 100);
    const subtotalWithUtility = subtotalWithAdmin + utilityCost;
    const taxCost = subtotalWithUtility * (values.tax / 100);
    const totalUnitPrice = subtotalWithUtility + taxCost;

    return {
      materialsTotal,
      laborTotal,
      laborWithCharges,
      equipmentTotal,
      equipmentWithTools,
      subtotalDirect,
      administrativeCost,
      subtotalWithAdmin,
      utilityCost,
      subtotalWithUtility,
      taxCost,
      totalUnitPrice
    };
  };

  const totals = calculateTotals();

  const copyResult = () => {
    const text = `Cálculo APU:
Materiales: ${formatCurrency(totals.materialsTotal)}
Mano de Obra: ${formatCurrency(totals.laborWithCharges)}
Equipos: ${formatCurrency(totals.equipmentWithTools)}
Administrativo: ${formatCurrency(totals.administrativeCost)}
Utilidad: ${formatCurrency(totals.utilityCost)}
Impuestos: ${formatCurrency(totals.taxCost)}
TOTAL: ${formatCurrency(totals.totalUnitPrice)}`;

    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "Resultado copiado al portapapeles",
    });
  };

  const reset = () => {
    setValues({
      materials: 0,
      labor: 0,
      equipment: 5,
      administrative: 8,
      utility: 15,
      tax: 3.09,
      socialCharges: 71.18
    });
  };

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calculator className="w-4 h-4" />
          Calculadora APU Rápida
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="materials" className="text-xs">Materiales (Bs)</Label>
            <Input
              id="materials"
              type="number"
              value={values.materials}
              onChange={(e) => setValues(prev => ({ ...prev, materials: Number(e.target.value) }))}
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="labor" className="text-xs">Mano de Obra (Bs)</Label>
            <Input
              id="labor"
              type="number"
              value={values.labor}
              onChange={(e) => setValues(prev => ({ ...prev, labor: Number(e.target.value) }))}
              className="text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="equipment" className="text-xs">Equipos (%)</Label>
            <Input
              id="equipment"
              type="number"
              step="0.01"
              value={values.equipment}
              onChange={(e) => setValues(prev => ({ ...prev, equipment: Number(e.target.value) }))}
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="administrative" className="text-xs">Administrativo (%)</Label>
            <Input
              id="administrative"
              type="number"
              step="0.01"
              value={values.administrative}
              onChange={(e) => setValues(prev => ({ ...prev, administrative: Number(e.target.value) }))}
              className="text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="utility" className="text-xs">Utilidad (%)</Label>
            <Input
              id="utility"
              type="number"
              step="0.01"
              value={values.utility}
              onChange={(e) => setValues(prev => ({ ...prev, utility: Number(e.target.value) }))}
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="tax" className="text-xs">IT (%)</Label>
            <Input
              id="tax"
              type="number"
              step="0.01"
              value={values.tax}
              onChange={(e) => setValues(prev => ({ ...prev, tax: Number(e.target.value) }))}
              className="text-sm"
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Materiales:</span>
            <span>{formatCurrency(totals.materialsTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>M.O. + Cargas:</span>
            <span>{formatCurrency(totals.laborWithCharges)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Equipos + Herr.:</span>
            <span>{formatCurrency(totals.equipmentWithTools)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Administrativo:</span>
            <span>{formatCurrency(totals.administrativeCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Utilidad:</span>
            <span>{formatCurrency(totals.utilityCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>IT:</span>
            <span>{formatCurrency(totals.taxCost)}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between font-bold">
            <span>TOTAL:</span>
            <span className="text-primary">{formatCurrency(totals.totalUnitPrice)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyResult} className="flex-1">
            <Copy className="w-3 h-3 mr-1" />
            Copiar
          </Button>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}