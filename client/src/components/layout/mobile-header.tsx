import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, User, UserPlus, Package, Store, Construction, Calculator, Mail, Phone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ContactForm } from "@/components/contact-form";
import { MicaaLogo } from "@/components/micaa-logo";

export default function MobileHeader() {
  const { user, isAnonymous } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Compact Mobile Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="flex h-12 items-center justify-between px-3">
          {/* Left: Menu Button */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setMenuOpen(!menuOpen)}
            className="h-8 w-8 p-0"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>

          {/* Center: Logo */}
          <div className="flex-1 flex justify-center">
            <MicaaLogo size="sm" showText={false} className="h-8" />
          </div>

          {/* Right: Auth Buttons */}
          {isAnonymous && (
            <div className="flex space-x-1">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => window.location.href = "/login"}
                className="h-7 px-2 text-xs"
              >
                <User className="w-3 h-3" />
              </Button>
              <Button 
                size="sm"
                onClick={() => window.location.href = "/register"}
                className="h-7 px-2 text-xs bg-orange-600 hover:bg-orange-700"
              >
                <UserPlus className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Full Screen Mobile Menu */}
      {menuOpen && (
        <div className="fixed inset-0 bg-white z-40 pt-12">
          <div className="p-4 space-y-6">
            {/* Anonymous Banner */}
            {isAnonymous && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800 text-center">
                  Navegando como invitado
                </p>
                <div className="flex space-x-2 mt-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      window.location.href = "/login";
                      setMenuOpen(false);
                    }}
                    className="flex-1"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Iniciar Sesión
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => {
                      window.location.href = "/register";
                      setMenuOpen(false);
                    }}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Registro Gratis
                  </Button>
                </div>
              </div>
            )}

            {/* Main Navigation */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Explorar</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    const materialsSection = document.querySelector('[data-tab="materials"]');
                    if (materialsSection) {
                      materialsSection.scrollIntoView({ behavior: 'smooth' });
                    }
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Package className="w-5 h-5 mr-3 text-orange-600" />
                  <div className="text-left">
                    <div className="font-medium">Materiales</div>
                    <div className="text-sm text-gray-500">Catálogo completo</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    const suppliersSection = document.querySelector('[data-tab="suppliers"]');
                    if (suppliersSection) {
                      suppliersSection.scrollIntoView({ behavior: 'smooth' });
                    }
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Store className="w-5 h-5 mr-3 text-orange-600" />
                  <div className="text-left">
                    <div className="font-medium">Proveedores</div>
                    <div className="text-sm text-gray-500">Empresas verificadas</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    window.location.href = "/login?redirect=activities";
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Construction className="w-5 h-5 mr-3 text-orange-600" />
                  <div className="text-left">
                    <div className="font-medium">Actividades</div>
                    <div className="text-sm text-gray-500">APU y composiciones</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    window.location.href = "/login?redirect=budgets";
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Calculator className="w-5 h-5 mr-3 text-orange-600" />
                  <div className="text-left">
                    <div className="font-medium">Presupuestos</div>
                    <div className="text-sm text-gray-500">Crear y gestionar</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Support Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Soporte</h3>
              
              <div className="space-y-3">
                <button className="w-full flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors justify-start">
                  <Mail className="w-5 h-5 mr-3 text-orange-600" />
                  <div className="text-left">
                    <div className="font-medium">Contacto</div>
                    <div className="text-sm text-gray-500">Enviar mensaje</div>
                  </div>
                </button>

                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <Phone className="w-5 h-5 mr-3 text-orange-600" />
                  <div className="text-left">
                    <div className="font-medium">Ayuda</div>
                    <div className="text-sm text-gray-500">Soporte técnico</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="pt-6">
              <Button 
                variant="outline" 
                onClick={() => setMenuOpen(false)}
                className="w-full"
              >
                Cerrar Menú
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}