import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import UnifiedHome from "@/pages/unified-home";
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
import AdminMaterialsCRUD from "@/pages/admin-materials-crud";
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
import { PWAInstallBanner } from "@/components/pwa-install-button";
import { useAuth } from "@/hooks/useAuth";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Check if on login or register page - render without sidebar
  const path = window.location.pathname;
  if (path === '/login' || path === '/register') {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
      </Switch>
    );
  }

  // Always show the full authenticated layout, but with anonymous mode
  // Users can access everything without being logged in
  return <AuthenticatedLayout />;
}

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-surface flex">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <AppHeader />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Switch>
              <Route path="/" component={UnifiedHome} />
              <Route path="/dashboard" component={UnifiedHome} />
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
              <Route path="/login" component={Login} />
              <Route path="/register" component={Register} />
              <Route path="/account-settings" component={AccountSettings} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <AppFooter />
        </div>
      </div>
      <PWAInstallBanner />
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-surface">
          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
