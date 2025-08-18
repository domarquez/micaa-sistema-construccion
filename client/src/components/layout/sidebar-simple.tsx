import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  PanelsTopLeft,
  Package,
  Combine,
  Calculator,
  Settings,
  Construction,
  DollarSign,
  MapPin,
  Store,
  Wrench,
  Users,
  Camera,
  Upload,
  Mail,
  Shield,
} from "lucide-react";

const menuItems = [
  {
    title: "Inicio",
    url: "/",
    icon: PanelsTopLeft,
  },
  {
    title: "Materiales",
    url: "/materials",
    icon: Package,
  },
  {
    title: "Actividades",
    url: "/activities",
    icon: Combine,
  },
  {
    title: "Presupuestos",
    url: "/budgets",
    icon: Calculator,
  },
  {
    title: "Marketplace",
    url: "/marketplace",
    icon: Store,
  },
];

const toolsItems = [
  {
    title: "Herramientas",
    url: "/tools",
    icon: Wrench,
  },
  {
    title: "Mano de Obra",
    url: "/labor",
    icon: Users,
  },
  {
    title: "Actividades Personalizadas",
    url: "/custom-activities",
    icon: Settings,
  },
];

const settingsItems = [
  {
    title: "Configuración de Precios",
    url: "/price-settings",
    icon: DollarSign,
  },
  {
    title: "Factores por Ciudad",
    url: "/city-factors",
    icon: MapPin,
  },
  {
    title: "Importar APU",
    url: "/apu-import",
    icon: Construction,
  },
];

const adminItems = [
  {
    title: "Gestión de Materiales",
    url: "/admin/materials",
    icon: Package,
  },
  {
    title: "Gestión de Precios",
    url: "/admin/prices",
    icon: DollarSign,
  },
  {
    title: "Gestión de Publicidades",
    url: "/admin/advertisements",
    icon: Camera,
  },
  {
    title: "Administrar Usuarios",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Administrar Empresas",
    url: "/admin/suppliers",
    icon: Store,
  },
  {
    title: "Organizar Actividades",
    url: "/admin/activities",
    icon: Settings,
  },
  {
    title: "Importar Empresas",
    url: "/import-companies",
    icon: Upload,
  },
  {
    title: "Envío Masivo",
    url: "/admin/bulk-email",
    icon: Mail,
  },
  {
    title: "Base de Datos",
    url: "/admin/database",
    icon: Shield,
  },
];

export default function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const isActive = (url: string) => {
    if (url === "/" && (location === "/" || location === "/dashboard")) {
      return true;
    }
    return location === url;
  };

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Construction className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-on-surface">MICAA</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className="w-full"
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Herramientas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className="w-full"
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(user as any)?.role === "supplier" && (
          <SidebarGroup>
            <SidebarGroupLabel>Mi Empresa</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/supplier-dashboard")}
                    className="w-full"
                  >
                    <Link href="/supplier-dashboard">
                      <Store className="w-4 h-4" />
                      <span>Panel de Empresa</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/supplier-pricing")}
                    className="w-full"
                  >
                    <Link href="/supplier-pricing">
                      <DollarSign className="w-4 h-4" />
                      <span>Mis Ofertas de Precios</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/company-advertising")}
                    className="w-full"
                  >
                    <Link href="/company-advertising">
                      <Camera className="w-4 h-4" />
                      <span>Publicidad</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {(user as any)?.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Configuración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settingsItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      className="w-full"
                    >
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {(user as any)?.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      className="w-full"
                    >
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      
      <SidebarFooter className="p-4 border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => window.open('mailto:contacto@micaa.store?subject=Consulta%20MICAA&body=Envianos%20un%20mensaje%20con%20tus%20consultas%20o%20sugerencias', '_blank')}
              className="w-full justify-center"
            >
              <Mail className="w-4 h-4" />
              <span className="text-xs">Envíanos un mensaje con tus consultas o sugerencias</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="text-xs text-muted-foreground text-center mt-2">
          MICAA v2.0 - Bolivia
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}