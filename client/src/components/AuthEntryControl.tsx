import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Building2, FolderKanban, LogOut, Smartphone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { track, setAnalyticsUser } from "@/lib/analytics";
import WhatsAppCodeFlow from "@/components/WhatsAppCodeFlow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Company = {
  id: number;
  companyName: string;
  logoUrl?: string | null;
};

function initialsFromUser(user: any): string {
  if (user?.firstName && user?.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user?.firstName) return user.firstName.slice(0, 2).toUpperCase();
  if (user?.username) return user.username.slice(0, 2).toUpperCase();
  return "M";
}

function displayName(user: any): string {
  if (user?.firstName && user?.lastName) return `${user.firstName} ${user.lastName}`;
  if (user?.firstName) return user.firstName;
  return user?.username || "Cuenta MICAA";
}

/**
 * Un solo control en el header:
 * - Sin sesión: «Ingresar / Inscribite» abre el flujo WhatsApp (crea cuenta si el número es nuevo).
 * - Con sesión: avatar (inicial o logo de empresa) con menú.
 */
export function AuthEntryControl() {
  const { user, isAuthenticated, logout } = useAuth();
  const [openLogin, setOpenLogin] = useState(false);
  const [pendingName, setPendingName] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const { data: company } = useQuery<Company | null>({
    queryKey: ["/api/my-supplier-company"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/my-supplier-company", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!openLogin) {
      setPendingName(false);
      setFirstName("");
    }
  }, [openLogin]);

  const finishLogin = () => {
    setOpenLogin(false);
    window.location.href = "/";
  };

  const saveName = async () => {
    const name = firstName.trim();
    if (!name) {
      finishLogin();
      return;
    }
    setSavingName(true);
    try {
      const token = localStorage.getItem("auth_token");
      await fetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ firstName: name }),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch {
      // El nombre es opcional; seguimos igual.
    } finally {
      setSavingName(false);
      finishLogin();
    }
  };

  if (isAuthenticated && user) {
    const logo = company?.logoUrl || "";
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[var(--micaa-line)] bg-[var(--micaa-accent-soft)] text-sm font-semibold text-[var(--micaa-accent)] outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-[var(--micaa-accent)]"
            aria-label="Menú de cuenta"
            data-testid="button-account-avatar"
          >
            <Avatar className="h-9 w-9">
              {logo ? <AvatarImage src={logo} alt={company?.companyName || "Empresa"} /> : null}
              <AvatarFallback className="bg-[var(--micaa-accent)] text-white text-xs">
                {initialsFromUser(user)}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="truncate text-sm font-medium text-[var(--micaa-fg)]">{displayName(user)}</div>
            {company?.companyName ? (
              <div className="truncate text-xs text-[var(--micaa-muted)]">{company.companyName}</div>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/proyectos" className="flex cursor-pointer items-center gap-2" data-testid="menu-mis-proyectos">
              <FolderKanban className="h-4 w-4" /> Mis proyectos
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/anunciar" className="flex cursor-pointer items-center gap-2" data-testid="menu-mi-empresa">
              <Building2 className="h-4 w-4" />
              {company ? "Mi empresa" : "Registrá tu empresa gratis"}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/account-settings" className="flex cursor-pointer items-center gap-2" data-testid="menu-mis-dispositivos">
              <Smartphone className="h-4 w-4" /> Mis dispositivos
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => logout()}
            data-testid="menu-salir"
          >
            <LogOut className="mr-2 h-4 w-4" /> Salir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenLogin(true)}
        className="inline-flex flex-col items-end leading-tight"
        data-testid="button-ingresar-inscribite"
      >
        <span className="rounded-full bg-[var(--micaa-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--micaa-accent)]/90">
          <span className="sm:hidden">Ingresar</span>
          <span className="hidden sm:inline">Ingresar / Inscribite</span>
        </span>
        <span className="mt-0.5 text-[10px] font-medium text-[var(--micaa-accent)] sm:hidden">
          Inscribite
        </span>
      </button>

      <Dialog open={openLogin} onOpenChange={setOpenLogin}>
        <DialogContent className="max-w-[min(24rem,calc(100vw-1.5rem))] border-[var(--micaa-line)] bg-[var(--micaa-bg)] sm:rounded-[var(--micaa-radius)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--micaa-fg)]">
              {pendingName ? "¿Cómo te llamás?" : "Ingresar / Inscribite"}
            </DialogTitle>
            <DialogDescription className="text-[var(--micaa-muted)]">
              {pendingName
                ? "Solo el nombre. Lo usamos en tus proyectos."
                : "Con tu WhatsApp. Si tu número aún no tiene cuenta, la creamos en el mismo paso."}
            </DialogDescription>
          </DialogHeader>

          {pendingName ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="new-user-name">Nombre</Label>
                <Input
                  id="new-user-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ej. Diego"
                  autoFocus
                  data-testid="input-new-user-name"
                />
              </div>
              <Button
                type="button"
                className="w-full bg-[var(--micaa-accent)] hover:bg-[var(--micaa-accent)]/90"
                disabled={savingName}
                onClick={saveName}
                data-testid="button-save-new-user-name"
              >
                {savingName ? "Guardando…" : firstName.trim() ? "Continuar" : "Saltar"}
              </Button>
            </div>
          ) : (
            <WhatsAppCodeFlow
              mode="login"
              onSuccess={(data) => {
                if (data?.token) localStorage.setItem("auth_token", data.token);
                track(data?.isNewUser ? "registration" : "login", { method: "whatsapp" });
                if (data?.user) setAnalyticsUser(data.user);
                queryClient.setQueryData(["/api/auth/me"], data?.user);
                queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
                if (data?.isNewUser && !data?.user?.firstName) {
                  setPendingName(true);
                  return;
                }
                finishLogin();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
