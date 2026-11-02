import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useInstallPrompt } from '@/lib/pwa';

export function PWAInstallButton({ className = "" }: { className?: string }) {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;
  return (
    <Button
      onClick={() => { install().catch((e) => console.error('Error installing PWA:', e)); }}
      size="sm"
      variant="outline"
      className={`text-[9px] sm:text-xs md:text-xs px-1 sm:px-1.5 md:px-2 py-0.5 h-6 sm:h-7 md:h-8 bg-green-50 border-green-500 text-green-700 hover:bg-green-100 ${className}`}
      data-testid="button-install-pwa"
    >
      <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:mr-1" />
      <span className="hidden sm:inline">Instalar App</span>
    </Button>
  );
}
