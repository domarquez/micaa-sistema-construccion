import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Construction, LogOut, Mail, Menu, X, Package, Store, Calculator } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDisclosureLevel } from "@/hooks/useDisclosureLevel";
import { ContactForm } from "@/components/contact-form";
import { MicaaLogo } from "@/components/micaa-logo";
import { NotificationsPanel, NotificationsBadge } from "@/components/notifications-panel";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AuthEntryControl } from "@/components/AuthEntryControl";

export default function AppHeader() {
  const { logout, isAnonymous } = useAuth();
  const { can, nextStep } = useDisclosureLevel();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow-material sticky top-0 z-50 border-b">
      <div className="flex h-10 sm:h-11 md:h-12 lg:h-14 xl:h-16 items-center justify-between px-1 sm:px-2 md:px-4 lg:px-6 max-w-full">
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 min-w-0 flex-shrink">
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9"
            onClick={() => {
              console.log('🍔 Menu click - isAnonymous:', isAnonymous, 'mobileMenuOpen:', mobileMenuOpen);
              setMobileMenuOpen(!mobileMenuOpen);
            }}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span className="sr-only">Abrir menú</span>
          </Button>
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-shrink">
            <MicaaLogo size="sm" showText={false} className="md:hidden scale-75 sm:scale-90 flex-shrink-0" />
            <MicaaLogo size="md" showText={true} className="hidden md:block flex-shrink-0" />
            <div className="hidden lg:block">
              <p className="text-xs text-muted-foreground">Sistema de Cómputos y Presupuestos</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 flex-shrink-0">
          <PWAInstallButton className="hidden sm:flex" />
          
          <ContactForm 
            triggerText="Contacto"
            triggerVariant="outline"
            className="hidden lg:flex text-xs"
          />
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10">
                <Bell className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                <NotificationsBadge />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 sm:w-80 p-0" align="end">
              <NotificationsPanel />
            </PopoverContent>
          </Popover>
          
          {/* Un solo control: Ingresar/Inscribite o avatar */}
          <AuthEntryControl />
        </div>
      </div>
      
      {/* Mobile Menu Overlay for All Users */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden bg-white border-b shadow-lg"
          style={{
            position: 'fixed',
            top: '40px',
            left: 0,
            right: 0,
            zIndex: 9999,
          }}
        >
          <div className="px-3 sm:px-4 py-3">
            {/* Auth Actions - Only for Anonymous Users */}
            <div className="flex items-center space-x-2 py-2 border-b border-gray-100">
              <Button
                size="sm"
                onClick={() => {
                  window.location.href = "/anunciar";
                  setMobileMenuOpen(false);
                }}
                className="flex-1 text-sm bg-[var(--micaa-accent)] hover:bg-[var(--micaa-accent)]/90"
                data-testid="mobile-registra-empresa"
              >
                Registrá tu empresa gratis
              </Button>
            </div>
            
            {/* Navigation Menu */}
            <div className="space-y-3 pt-3">
              {/* Main Navigation */}
              <div className="grid grid-cols-2 gap-3">
                <div 
                  className="flex items-center text-muted-foreground hover:text-orange-600 cursor-pointer text-sm py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    window.location.href = "/";
                    setMobileMenuOpen(false);
                  }}
                >
                  <Construction className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Inicio</span>
                </div>
                <div 
                  className="flex items-center text-muted-foreground hover:text-orange-600 cursor-pointer text-sm py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    window.location.href = "/materials";
                    setMobileMenuOpen(false);
                  }}
                >
                  <Package className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Materiales</span>
                </div>
              </div>

              {can("catalog") ? (
              <>
              <div className="grid grid-cols-2 gap-3">
                <div 
                  className="flex items-center text-muted-foreground hover:text-orange-600 cursor-pointer text-sm py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    window.location.href = "/activities";
                    setMobileMenuOpen(false);
                  }}
                >
                  <Construction className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Actividades</span>
                </div>
                <div 
                  className="flex items-center text-muted-foreground hover:text-orange-600 cursor-pointer text-sm py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    window.location.href = "/budgets";
                    setMobileMenuOpen(false);
                  }}
                >
                  <Calculator className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Presupuestos</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div 
                  className="flex items-center text-muted-foreground hover:text-orange-600 cursor-pointer text-sm py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    window.location.href = "/marketplace";
                    setMobileMenuOpen(false);
                  }}
                >
                  <Store className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Marketplace</span>
                </div>
                <div 
                  className="flex items-center text-muted-foreground hover:text-orange-600 cursor-pointer text-sm py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    window.location.href = "/tools";
                    setMobileMenuOpen(false);
                  }}
                >
                  <Package className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Herramientas</span>
                </div>
              </div>
              </>
              ) : nextStep ? (
                <div
                  className="flex items-center justify-center rounded bg-[var(--micaa-accent-soft)] px-2 py-2 text-sm font-medium text-[var(--micaa-accent)] cursor-pointer"
                  onClick={() => {
                    window.location.href = "/anunciar";
                    setMobileMenuOpen(false);
                  }}
                >
                  Registrá tu empresa gratis
                </div>
              ) : null}

              {/* Logout for authenticated users */}
              {!isAnonymous && (
                <div className="border-t border-gray-100 pt-3">
                  <div 
                    className="flex items-center text-red-600 hover:text-red-800 cursor-pointer text-sm py-2 px-2 rounded hover:bg-red-50 transition-colors"
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>Cerrar Sesión</span>
                  </div>
                </div>
              )}

              {/* Information & Support */}
              <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                <ContactForm 
                  triggerText="Contacto"
                  triggerVariant="ghost"
                  className="justify-start p-2 text-left text-muted-foreground hover:text-orange-600 text-sm rounded hover:bg-gray-50 transition-colors"
                />
                <div className="flex items-center text-muted-foreground text-sm py-2 px-2">
                  <Mail className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Ayuda</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
