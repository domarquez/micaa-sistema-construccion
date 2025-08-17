import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, User, Construction, LogOut, Mail, Shield, MapPin, Calendar, AlertTriangle, UserPlus } from "lucide-react";
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
      <div className="flex h-12 sm:h-14 md:h-16 items-center justify-between px-2 sm:px-3 md:px-6">
        <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4 min-w-0">
          <SidebarTrigger className="md:hidden flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8" />
          <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
            <MicaaLogo size="sm" showText={false} className="md:hidden scale-75 sm:scale-90" />
            <MicaaLogo size="md" showText={true} className="hidden md:block" />
            <div className="hidden lg:block">
              <p className="text-xs text-gray-600">Sistema de Cómputos y Presupuestos</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4">
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
            <div className="flex items-center space-x-1">
              <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs py-0 px-1 sm:px-2">
                <AlertTriangle className="w-2 h-2 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                <span className="hidden sm:inline text-xs">Modo Anónimo</span>
                <span className="sm:hidden text-xs">Anónimo</span>
              </Badge>
              
              {/* Mobile dropdown for login/register */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="sm:hidden">
                  <Button size="sm" variant="outline" className="px-1.5 py-1 h-7 text-xs">
                    <User className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-sm">
                  <DropdownMenuItem onClick={() => window.location.href = "/login"} className="text-xs">
                    <User className="w-3 h-3 mr-2" />
                    Iniciar Sesión
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = "/register"} className="text-xs">
                    <UserPlus className="w-3 h-3 mr-2" />
                    Registro Gratis
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => window.location.href = "/login"}
                className="hidden sm:flex text-xs px-2 py-1 h-7"
              >
                <User className="w-3 h-3 mr-1" />
                Iniciar
              </Button>
              <Button 
                size="sm"
                onClick={() => window.location.href = "/register"}
                className="hidden sm:flex text-xs px-2 py-1 h-7 bg-orange-600 hover:bg-orange-700"
              >
                <UserPlus className="w-3 h-3 mr-1" />
                Registro
              </Button>
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
    </header>
  );
}
