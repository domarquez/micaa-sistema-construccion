/** Utilidades de sesión del lado cliente (dispositivo recordado). */
export function hasSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith("micaa_has_session="));
}

export async function serverLogout(all = false): Promise<void> {
  const token = localStorage.getItem("auth_token");
  try {
    await fetch(all ? "/api/auth/logout-all" : "/api/auth/logout", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    // sin red: igual limpiamos localmente
  }
}
