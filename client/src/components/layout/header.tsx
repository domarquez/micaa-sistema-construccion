import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, User, Construction, LogOut, Mail, Shield, MapPin, Calendar } from "lucide-react";
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
  const { user, logout } = useAuth();

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
      <div className="flex h-14 md:h-16 items-center justify-between px-3 sm:px-4 md:px-6">
        <div className="flex items-center space-x-2 md:space-x-4 min-w-0">
          <SidebarTrigger className="md:hidden flex-shrink-0" />
          <div className="flex items-center space-x-2 min-w-0">
            <MicaaLogo size="sm" showText={false} className="md:hidden" />
            <MicaaLogo size="md" showText={true} className="hidden md:block" />
            <div className="hidden lg:block">
              <p className="text-xs text-gray-600">Sistema de Cómputos y Presupuestos</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          <ContactForm 
            triggerText="Contacto"
            triggerVariant="outline"
            className="hidden lg:flex"
          />
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-10 md:w-10">
                <Bell className="w-4 h-4 md:w-5 md:h-5" />
                <NotificationsBadge />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <NotificationsPanel />
            </PopoverContent>
          </Popover>
          
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
        </div>
      </div>
    </header>
  );
}
