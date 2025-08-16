import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, Check, AlertTriangle, Info, CheckCircle, Settings, Users, TrendingUp } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface Notification {
  id: string;
  type: "info" | "warning" | "success" | "error" | "admin";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// Global notifications store (simplified for demo)
let globalNotifications: Notification[] = [
  {
    id: "1",
    type: "success",
    title: "Sistema de mano de obra actualizado",
    message: "Los precios de mano de obra se han actualizado correctamente. Todas las categorías están disponibles para edición.",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    read: false
  },
  {
    id: "2", 
    type: "info",
    title: "Panel administrativo disponible",
    message: "Accede a todas las funciones administrativas: gestión de usuarios, precios, materiales y herramientas",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1),
    read: false
  }
];

export function NotificationsBadge() {
  const unreadCount = globalNotifications.filter(n => !n.read).length;
  
  if (unreadCount === 0) return null;
  
  return (
    <span className="absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
      {unreadCount}
    </span>
  );
}

export function NotificationsPanel() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(globalNotifications);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    const updatedNotifications = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updatedNotifications);
    globalNotifications = updatedNotifications; // Update global store
  };

  const markAllAsRead = () => {
    const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updatedNotifications);
    globalNotifications = updatedNotifications; // Update global store
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case "error": return <X className="w-4 h-4 text-red-600" />;
      case "admin": return <Settings className="w-4 h-4 text-purple-600" />;
      default: return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  // Dynamic notification system based on user role
  useEffect(() => {
    if (user?.role === 'admin') {
      // Admin-specific notifications
      const hasAdminNotifications = globalNotifications.some(n => n.id === "admin-features");
      if (!hasAdminNotifications) {
        const newNotification = {
          id: "admin-features",
          type: "admin" as const,
          title: "Funciones administrativas activas",
          message: "Tienes acceso completo al panel de administración, gestión de usuarios, precios y configuraciones del sistema",
          timestamp: new Date(),
          read: false
        };
        globalNotifications = [newNotification, ...globalNotifications];
        setNotifications(globalNotifications);
      }
    }
  }, [user]);

  return (
    <Card className="w-80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Notificaciones
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount}
            </Badge>
          )}
        </CardTitle>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead}>
            <Check className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No hay notificaciones
          </p>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg border transition-colors ${
                notification.read 
                  ? "bg-gray-50 border-gray-200" 
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {getIcon(notification.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {formatRelativeTime(notification.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}