import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Bell, User, Construction, LogOut, Mail, Shield, MapPin, Calendar, AlertTriangle, UserPlus, Menu, X, Package, Store, Calculator } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ContactForm } from "@/components/contact-form";
import { MicaaLogo } from "@/components/micaa-logo";
import { NotificationsPanel, NotificationsBadge } from "@/components/notifications-panel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export default function AppHeader() {
  const { user, logout, isAnonymous } = useAuth();
  const { toggleSidebar } = useSidebar();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getUserInitials = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const getUserTypeLabel = (userType: string) => {
    switch (userType) {
      case 'architect': return 'Arquitecto';
      case 'constructor': return 'Constructor';
      case 'supplier': return 'Proveedor';
      default: return 'Usuario';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'user': return 'Usuario';
      default: return role;
    }
  };

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
              <p className="text-xs text-gray-600">Sistema de Cómputos y Presupuestos</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 flex-shrink-0">
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
          
          {isAnonymous ? (
            /* Anonymous User Header - Mobile Optimized */
            <div className="flex items-center gap-1 min-w-0">
              <Badge variant="outline" className="text-orange-600 border-orange-600 text-[10px] py-0 px-1 hidden md:flex items-center flex-shrink-0">
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                <span>Anónimo</span>
              </Badge>
              
              {/* Mobile optimized buttons */}
              <div className="flex items-center gap-0.5 min-w-0">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => window.location.href = "/login"}
                  className="text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-1.5 md:px-2 py-0.5 h-6 sm:h-7 md:h-8 flex-shrink-0"
                >
                  <User className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:mr-0.5" />
                  <span className="hidden md:inline">Login</span>
                </Button>
                <Button 
                  size="sm"
                  onClick={() => window.location.href = "/register"}
                  className="text-[9px] sm:text-[10px] md:text-xs px-1 sm:px-1.5 md:px-2 py-0.5 h-6 sm:h-7 md:h-8 bg-orange-600 hover:bg-orange-700 flex-shrink-0"
                >
                  <UserPlus className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:mr-0.5" />
                  <span className="hidden md:inline">Sign Up</span>
                </Button>
              </div>
            </div>
          ) : (
            /* Authenticated User Dropdown */
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 md:h-10 md:w-10 rounded-full">
                  <Avatar className="h-7 w-7 md:h-8 md:w-8">
                    <AvatarImage src="" alt={user?.username || "Usuario"} />
                    <AvatarFallback className="bg-primary text-white text-xs md:text-sm">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium leading-none">
                      {user?.firstName && user?.lastName 
                        ? `${user.firstName} ${user.lastName}`
                        : user?.username
                      }
                    </p>
                    <div className="flex gap-1">
                      {user?.role === 'admin' && (
                        <Badge variant="destructive" className="text-xs">
                          <Shield className="w-3 h-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      {user?.email}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      {getUserTypeLabel((user as any)?.userType || '')} • {getRoleLabel(user?.role || '')}
                    </div>
                    
                    {(user as any)?.city && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {(user as any).city}, {(user as any)?.country || 'Bolivia'}
                      </div>
                    )}
                    
                    {user?.lastLogin && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        Último acceso: {new Date(user.lastLogin).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-2">
                    <div className="text-xs font-medium text-green-600 mb-1">
                      Opciones disponibles:
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                      <span>• Crear presupuestos</span>
                      <span>• Ver materiales</span>
                      <span>• Calcular APUs</span>
                      <span>• Gestionar proyectos</span>
                      {user?.role === 'admin' && (
                        <>
                          <span>• Panel administrativo</span>
                          <span>• Gestión de usuarios</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
      </div>
      
      {/* Mobile Menu Overlay for All Users */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg z-40">
          <div className="px-3 sm:px-4 py-3">
            {/* Auth Actions - Only for Anonymous Users */}
            {isAnonymous && (
              <div className="flex items-center space-x-2 py-2 border-b border-gray-100">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    window.location.href = "/login";
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 text-sm"
                >
                  <User className="w-3 h-3 mr-2" />
                  Iniciar Sesión
                </Button>
                <Button 
                  size="sm"
                  onClick={() => {
                    window.location.href = "/register";
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 text-sm bg-orange-600 hover:bg-orange-700"
                >
                  <UserPlus className="w-3 h-3 mr-2" />
                  Registro Gratis
                </Button>
              </div>
            )}
            
            {/* Navigation Menu */}
            <div className="space-y-3 pt-3">
              {/* Main Navigation */}
              <div className="grid grid-cols-2 gap-3">
                <div 
                  className="flex items-center text-gray-600 hover:text-orange-600 cursor-pointer text-sm py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    window.location.href = "/";
                    setMobileMenuOpen(false);
                  }}
                >
                  <Construction className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Inicio</span>
                </div>
                <div 
                  className="flex items-center text-gray-600 hover:text-orange-600 cursor-pointer text-sm py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    window.location.href = "/materials";
                    setMobileMenuOpen(false);
                  }}
                >
                  <Package className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Materiales</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div 
                  className="flex items-center text-gray-600 hover:text-orange-600 cursor-pointer text-sm py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    window.location.href = "/activities";
                    setMobileMenuOpen(false);
                  }}
                >
                  <Construction className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Actividades</span>
                </div>
                <div 
                  className="flex items-center text-gray-600 hover:text-orange-600 cursor-pointer text-sm py-2 px-2 rounded hover:bg-gray-50 transition-colors"
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
                  className="flex items-center text-gray-600 hover:text-orange-600 cursor-pointer text-sm py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    window.location.href = "/marketplace";
                    setMobileMenuOpen(false);
                  }}
                >
                  <Store className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Marketplace</span>
                </div>
                <div 
                  className="flex items-center text-gray-600 hover:text-orange-600 cursor-pointer text-sm py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    window.location.href = "/tools";
                    setMobileMenuOpen(false);
                  }}
                >
                  <Package className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Herramientas</span>
                </div>
              </div>

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
                  className="justify-start p-2 text-left text-gray-600 hover:text-orange-600 text-sm rounded hover:bg-gray-50 transition-colors"
                />
                <div className="flex items-center text-gray-600 text-sm py-2 px-2">
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
