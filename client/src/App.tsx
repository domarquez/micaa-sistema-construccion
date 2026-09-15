import { Switch, Route, useLocation } from "wouter";
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
import CompanyAdvertising from "@/pages/company-advertising";
import ImportCompanies from "@/pages/import-companies";
import ReviewCompanies from "@/pages/review-companies";
import SimpleImport from "@/pages/simple-import";
import AdminMaterials from "@/pages/admin-materials";
import AdminUsers from "@/pages/admin-users";
import AdminSuppliers from "@/pages/admin-suppliers";
import AdminCompanies from "@/pages/admin-companies";
import AdminAdvertisements from "@/pages/admin-advertisements";
import AdminBulkEmail from "@/pages/admin-bulk-email";
import AdminDatabase from "@/pages/admin-database";
import Marketplace from "@/pages/marketplace";
import Login from "@/pages/login";
import Register from "@/pages/register";
import CustomActivities from "@/pages/custom-activities";
import AccountSettings from "@/pages/account-settings";
import NotFound from "@/pages/not-found";
import AppSidebar from "@/components/layout/sidebar-simple";
import AppHeader from "@/components/layout/header";
import { AppFooter } from "@/components/layout/app-footer";
import { GuestHeader } from "@/components/guest-header";
import { useAuth } from "@/hooks/useAuth";

function usePriceSurface(path: string) {
  return (
    path === "/" ||
    path === "/lista" ||
    path === "/publicar-precio" ||
    path === "/materiales" ||
    path.startsWith("/materiales/")
  );
}

function PriceRoutes() {
  return (
    <Switch>
      <Route path="/" component={PriceHome} />
      <Route path="/materiales" component={MaterialesPage} />
      <Route path="/materiales/:id" component={MaterialDetail} />
      <Route path="/lista" component={ListaPage} />
      <Route path="/publicar-precio" component={PublicarPrecioPage} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route component={NotFound} />
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
    </div>
  );
}

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-surface">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Switch>
              <Route path="/" component={PriceHome} />
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
              <Route path="/budgets/:id" component={BudgetDetails} />
              <Route path="/price-settings" component={PriceSettings} />
              <Route path="/apu-import" component={APUImport} />
              <Route path="/city-factors" component={CityFactors} />
              <Route path="/suppliers" component={Suppliers} />
              <Route path="/supplier-registration" component={SupplierRegistration} />
              <Route path="/supplier-dashboard" component={SupplierDashboard} />
              <Route path="/supplier-pricing" component={SupplierPricing} />
              <Route path="/company-advertising" component={CompanyAdvertising} />
              <Route path="/import-companies" component={ImportCompanies} />
              <Route path="/review-companies" component={ReviewCompanies} />
              <Route path="/simple-import" component={SimpleImport} />
              <Route path="/admin/materials" component={AdminMaterials} />
              <Route path="/admin/prices" component={AdminMaterials} />
              <Route path="/admin/users" component={AdminUsers} />
              <Route path="/admin/suppliers" component={AdminSuppliers} />
              <Route path="/admin-materials" component={AdminMaterials} />
              <Route path="/admin-activities" component={ActivityManager} />
              <Route path="/admin/companies" component={AdminCompanies} />
              <Route path="/admin/advertisements" component={AdminAdvertisements} />
              <Route path="/admin/bulk-email" component={AdminBulkEmail} />
              <Route path="/admin/database" component={AdminDatabase} />
              <Route path="/marketplace" component={Marketplace} />
              <Route path="/account-settings" component={AccountSettings} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <AppFooter />
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const priceSurface = usePriceSurface(location);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--micaa-bg)]">
        <p className="text-[14px] text-[var(--micaa-muted)]">Cargando…</p>
      </div>
    );
  }

  if (location === "/login" || location === "/register") {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
      </Switch>
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
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
