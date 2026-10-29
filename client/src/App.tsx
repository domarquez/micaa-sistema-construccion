import { useEffect } from "react";
import { SiteFooter } from "@/components/layout/site-footer";
import { ListSkeleton } from "@/components/ui/states";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import UnifiedHome from "@/pages/unified-home";
import PriceHome from "@/pages/price-home";
import MaterialesPage from "@/pages/materiales";
import MaterialDetail from "@/pages/material-detail";
import ListaPage from "@/pages/lista";
import PublicarPrecioPage from "@/pages/publicar-precio";
import Materials from "@/pages/materials";
import Activities from "@/pages/activities";
import Budgets from "@/pages/budgets";
import BudgetDetails from "@/pages/budget-details";
import PriceSettings from "@/pages/price-settings";
import APUImport from "@/pages/apu-import";
import CityFactors from "@/pages/city-factors";
import Suppliers from "@/pages/suppliers";
import SupplierRegistration from "@/pages/supplier-registration";
import Tools from "@/pages/tools";
import Labor from "@/pages/labor";
import ActivityManager from "@/pages/admin-activities";
import SupplierPricing from "@/pages/supplier-pricing";
import SupplierDashboard from "@/pages/supplier-dashboard";
import ImportCompanies from "@/pages/import-companies";
import ReviewCompanies from "@/pages/review-companies";
import SimpleImport from "@/pages/simple-import";
import AdminMaterials from "@/pages/admin-materials";
import AdminUsers from "@/pages/admin-users";
import AdminSuppliers from "@/pages/admin-suppliers";
import AdminPendingClaims from "@/pages/admin-pending-claims";
import AdminCompanies from "@/pages/admin-companies";
import AdminAdvertisements from "@/pages/admin-advertisements";
import AdminBulkEmail from "@/pages/admin-bulk-email";
import AdminDatabase from "@/pages/admin-database";
import AdminEstadisticas from "@/pages/admin-estadisticas";
import Marketplace from "@/pages/marketplace";
import Login from "@/pages/login";
import Register from "@/pages/register";
import CustomActivities from "@/pages/custom-activities";
import ProjectTemplates from "@/pages/project-templates";
import AccountSettings from "@/pages/account-settings";
import NotFound from "@/pages/not-found";
import AnunciarPage from "@/pages/anunciar";
import ContactoPage from "@/pages/contacto";
import { MicaaWhatsAppFab } from "@/components/MicaaWhatsAppFab";
import { AnalyticsProvider, setAnalyticsUser } from "@/lib/analytics";
import { PublicAdSense } from "@/components/ads/AdSenseSlot";
import AppSidebar from "@/components/layout/sidebar-simple";
import AppHeader from "@/components/layout/header";
import { AppFooter } from "@/components/layout/app-footer";
import { GuestHeader } from "@/components/guest-header";
import { useAuth } from "@/hooks/useAuth";
import { useDisclosureLevel } from "@/hooks/useDisclosureLevel";
import { DisclosureGate, WhatsAppSignupCta } from "@/components/DisclosureGate";
import { featureForPath } from "@/lib/disclosure";
import { MemberProjects, ProjectsPage, StartProjectCard } from "@/components/MemberProjects";

/** Inicio: materiales siempre; con nivel ≥1 (WhatsApp verificado o admin) además "Empezá un proyecto" + mis proyectos. */
function HomePage() {
  const { can } = useDisclosureLevel();
  return (
    <>
      <PriceHome afterSearch={can("projects") ? <StartProjectCard /> : undefined} />
      {can("projects") && <MemberProjects limit={5} showCard={false} />}
    </>
  );
}

function ProjectsRoute() {
  const { can } = useDisclosureLevel();
  return can("projects") ? <ProjectsPage /> : <WhatsAppSignupCta />;
}

/** /inscribete: CTA de WhatsApp; si ya alcanzó el nivel 1, lo manda a su inicio con proyectos. */
function InscribetePage() {
  const { nextStep } = useDisclosureLevel();
  if (!nextStep) return <Redirect to="/" />;
  return <WhatsAppSignupCta />;
}

/** Visitante que entra por URL a una ruta de nivel superior: CTA en vez de 404. */
function GuestFallback() {
  const [location] = useLocation();
  return featureForPath(location) ? <WhatsAppSignupCta /> : <NotFound />;
}

function usePriceSurface(path: string) {
  return (
    path === "/" ||
    path === "/lista" ||
    path === "/publicar-precio" ||
    path === "/proyectos" ||
    path === "/plantillas" ||
    path === "/materiales" ||
    path.startsWith("/materiales/") ||
    path === "/empresas" ||
    path === "/anunciar" ||
    path === "/contacto" ||
    path === "/account-settings"
  );
}

function PriceRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/proyectos" component={ProjectsRoute} />
      <Route path="/plantillas">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <DisclosureGate feature="templates"><ProjectTemplates /></DisclosureGate>
        </div>
      </Route>
      <Route path="/materiales" component={MaterialesPage} />
      <Route path="/materiales/:id" component={MaterialDetail} />
      <Route path="/lista" component={ListaPage} />
      <Route path="/empresas" component={Suppliers} />
      <Route path="/publicar-precio" component={PublicarPrecioPage} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/inscribete" component={InscribetePage} />
      <Route path="/anunciar" component={AnunciarPage} />
      <Route path="/contacto" component={ContactoPage} />
      <Route path="/account-settings" component={AccountSettings} />
      <Route component={GuestFallback} />
    </Switch>
  );
}

function GuestLayout() {
  return (
    <div className="min-h-screen bg-[var(--micaa-bg)] text-[var(--micaa-fg)]">
      <GuestHeader />
      <main>
        <PriceRoutes />
      </main>
      <SiteFooter />
    </div>
  );
}

function AuthenticatedLayout() {
  const [location] = useLocation();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-surface">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <DisclosureGate feature={featureForPath(location)}>
            <Switch>
              <Route path="/inscribete" component={InscribetePage} />
              <Route path="/" component={HomePage} />
              <Route path="/dashboard" component={UnifiedHome} />
              <Route path="/materiales" component={MaterialesPage} />
              <Route path="/materiales/:id" component={MaterialDetail} />
              <Route path="/lista" component={ListaPage} />
              <Route path="/publicar-precio" component={PublicarPrecioPage} />
              <Route path="/materials" component={Materials} />
              <Route path="/activities" component={Activities} />
              <Route path="/custom-activities" component={CustomActivities} />
              <Route path="/admin/activities" component={ActivityManager} />
              <Route path="/tools" component={Tools} />
              <Route path="/labor" component={Labor} />
              <Route path="/budgets" component={Budgets} />
              <Route path="/budgets/new" component={Budgets} />
              <Route path="/plantillas" component={ProjectTemplates} />
              <Route path="/budgets/:id" component={BudgetDetails} />
              <Route path="/price-settings" component={PriceSettings} />
              <Route path="/apu-import" component={APUImport} />
              <Route path="/city-factors" component={CityFactors} />
              <Route path="/suppliers" component={Suppliers} />
              <Route path="/empresas" component={Suppliers} />
              <Route path="/anunciar" component={AnunciarPage} />
              <Route path="/contacto" component={ContactoPage} />
              <Route path="/supplier-registration" component={SupplierRegistration} />
              <Route path="/miempresa" component={SupplierRegistration} />
              <Route path="/supplier-dashboard" component={SupplierDashboard} />
              <Route path="/supplier-pricing" component={SupplierPricing} />
              <Route path="/company-advertising"><Redirect to="/anunciar" /></Route>
              <Route path="/import-companies" component={ImportCompanies} />
              <Route path="/review-companies" component={ReviewCompanies} />
              <Route path="/simple-import" component={SimpleImport} />
              <Route path="/admin/materials" component={AdminMaterials} />
              <Route path="/admin/prices" component={AdminMaterials} />
              <Route path="/admin/users" component={AdminUsers} />
              <Route path="/admin/suppliers" component={AdminSuppliers} />
              <Route path="/admin-materials" component={AdminMaterials} />
              <Route path="/admin-activities" component={ActivityManager} />
              <Route path="/admin/pending-claims" component={AdminPendingClaims} />
              <Route path="/admin/companies" component={AdminCompanies} />
              <Route path="/admin/advertisements" component={AdminAdvertisements} />
              <Route path="/admin/bulk-email" component={AdminBulkEmail} />
              <Route path="/admin/database" component={AdminDatabase} />
              <Route path="/admin/estadisticas" component={AdminEstadisticas} />
              <Route path="/marketplace" component={Marketplace} />
              <Route path="/account-settings" component={AccountSettings} />
              <Route component={NotFound} />
            </Switch>
            </DisclosureGate>
          </main>
          <AppFooter />
        </div>
      </div>
    </SidebarProvider>
  );
}


function AnalyticsUserSync() {
  const { user } = useAuth();
  useEffect(() => {
    setAnalyticsUser(user ? { id: (user as any).id, username: (user as any).username } : null);
  }, [user]);
  return null;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const priceSurface = usePriceSurface(location);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--micaa-bg)]">
        <div className="w-64"><ListSkeleton rows={3} /></div>
      </div>
    );
  }

  if (location === "/login" || location === "/register") {
    return (
      <div className="min-h-screen bg-[var(--micaa-bg)] text-[var(--micaa-fg)]">
        <GuestHeader />
        <main>
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
          </Switch>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // Invitado siempre sin sidebar. Logueado en superficie de precios también (briefing).
  if (!isAuthenticated || priceSurface) {
    return <GuestLayout />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AnalyticsProvider>
          <AnalyticsUserSync />
          <Router />
          <Toaster />
          <MicaaWhatsAppFab />
        </AnalyticsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
