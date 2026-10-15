/** Rutas que NO deben caer al index.html (escaneos, API huérfana, dotfiles). */
export function shouldSpaFallback(urlPath: string): boolean {
  const p = (urlPath || "/").split("?")[0].split("#")[0] || "/";
  if (p === "/api" || p.startsWith("/api/")) return false;
  if (/(^|\/)\./.test(p)) return false; // /.git/config, /.env, ...
  if (/\.(php|asp|aspx|cgi|env|sql|bak|git|py|rb|exe|dll|jsp)$/i.test(p)) return false;
  if (/^\/(wp-admin|wp-login|wordpress|phpmyadmin|administrator|xmlrpc\.php)/i.test(p)) return false;
  return true;
}
