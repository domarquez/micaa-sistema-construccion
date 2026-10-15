import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-start">
            <AlertCircle className="h-8 w-8 text-red-500 shrink-0" />
            <h1 className="text-2xl font-bold text-gray-900">404 — Página no encontrada</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            No existe esa dirección en MICAA. Revisa el enlace o vuelve al inicio.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-primary hover:underline">
            Ir al inicio
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
