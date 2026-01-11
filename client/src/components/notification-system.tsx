import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle, AlertTriangle, Info, DollarSign, MessageCircle } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";

interface Notification {
  id: string;
  type: "success" | "warning" | "info" | "error" | "payment" | "message";
  title: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
}

export default function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { lastMessage } = useWebSocket();

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage);
        
        let notification: Notification | null = null;

        switch (data.type) {
          case "chore_created":
            notification = {
              id: Date.now().toString(),
              type: "info",
              title: "New Chore Created",
              message: `${data.data.title} has been added to the family chores.`,
              timestamp: new Date(),
              autoClose: true,
            };
            break;

          case "chore_completed":
            notification = {
              id: Date.now().toString(),
              type: "success",
              title: "Chore Completed",
              message: `${data.data.title} has been marked as complete!`,
              timestamp: new Date(),
              autoClose: true,
            };
            break;

          case "chore_approved":
            notification = {
              id: Date.now().toString(),
              type: "payment",
              title: "Payment Approved",
              message: `$${data.data.price} has been added to your account!`,
              timestamp: new Date(),
              autoClose: true,
            };
            break;

          case "negotiation_created":
            notification = {
              id: Date.now().toString(),
              type: "warning",
              title: "Price Negotiation",
              message: "A chore price is being negotiated.",
              timestamp: new Date(),
              autoClose: true,
            };
            break;

          case "new_message":
            notification = {
              id: Date.now().toString(),
              type: "message",
              title: "New Message",
              message: `You have a new family message.`,
              timestamp: new Date(),
              autoClose: true,
            };
            break;

          case "chore_updated":
            notification = {
              id: Date.now().toString(),
              type: "info",
              title: "Chore Updated",
              message: `${data.data.title} has been updated.`,
              timestamp: new Date(),
              autoClose: true,
            };
            break;
        }

        if (notification) {
          setNotifications(prev => [notification!, ...prev]);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    }
  }, [lastMessage]);

  // Auto-close notifications
  useEffect(() => {
    const timers = notifications
      .filter(notif => notif.autoClose)
      .map(notif => 
        setTimeout(() => {
          removeNotification(notif.id);
        }, 5000)
      );

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notifications]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "error":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "payment":
        return <DollarSign className="h-5 w-5 text-green-500" />;
      case "message":
        return <MessageCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getNotificationStyle = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return "border-green-200 bg-green-50";
      case "warning":
        return "border-yellow-200 bg-yellow-50";
      case "error":
        return "border-red-200 bg-red-50";
      case "payment":
        return "border-green-200 bg-green-50";
      case "message":
        return "border-blue-200 bg-blue-50";
      default:
        return "border-blue-200 bg-blue-50";
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-6 z-50 space-y-3 max-w-sm">
      {notifications.slice(0, 5).map((notification) => (
        <Card
          key={notification.id}
          className={`border-2 shadow-lg transition-all duration-300 transform ${
            getNotificationStyle(notification.type)
          } animate-in slide-in-from-right-full`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                {getNotificationIcon(notification.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {notification.title}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {formatTime(notification.timestamp)}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {notification.message}
                  </p>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeNotification(notification.id)}
                className="text-gray-400 hover:text-gray-600 p-1 h-auto ml-2 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Progress bar for auto-close */}
            {notification.autoClose && (
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div 
                    className="bg-gray-400 h-1 rounded-full animate-pulse"
                    style={{
                      animation: "shrink 5s linear forwards",
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Show count if more notifications */}
      {notifications.length > 5 && (
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="p-3 text-center">
            <p className="text-sm text-gray-600">
              {notifications.length - 5} more notifications...
            </p>
          </CardContent>
        </Card>
      )}

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
