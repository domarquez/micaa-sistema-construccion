import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, User, Construction, LogOut, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ContactForm } from "@/components/contact-form";
import { MicaaLogo } from "@/components/micaa-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
          
          <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-10 md:w-10">
            <Bell className="w-4 h-4 md:w-5 md:h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              3
            </span>
          </Button>
          
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
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user?.username
                    }
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  {user?.role === 'admin' && (
                    <p className="text-xs leading-none text-blue-600 font-medium">
                      Administrador
                    </p>
                  )}
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
