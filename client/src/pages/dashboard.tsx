import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Coins } from "lucide-react";
import KidInterface from "@/components/kid-interface";
import ParentInterface from "@/components/parent-interface";
import ChatWidget from "@/components/chat-widget";
import NotificationSystem from "@/components/notification-system";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [isParentView, setIsParentView] = useState(user?.role === "parent");
  const { isConnected } = useWebSocket();

  const { data: notifications = [] } = useQuery({
    queryKey: ["/api/messages/family"],
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  if (!user) return null;

  const handleToggleView = () => {
    if (user.role === "parent") {
      setIsParentView(!isParentView);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header Navigation */}
      <header className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="bg-earn-blue rounded-full p-2">
                <Coins className="text-white text-xl h-6 w-6" />
              </div>
              <span className="text-2xl font-bold earn-blue">EarnIt</span>
            </div>
            
            {/* Controls */}
            <div className="flex items-center space-x-4">
              {/* User Toggle - Only show for parents */}
              {user.role === "parent" && (
                <div className="flip-card" onClick={handleToggleView}>
                  <div className={`flip-card-inner relative w-32 h-10 cursor-pointer ${isParentView ? 'flipped' : ''}`}>
                    <div className="flip-card-front absolute inset-0 kid-gradient rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">Kid View</span>
                    </div>
                    <div className="flip-card-back absolute inset-0 parent-gradient rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">Parent View</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-500">{isConnected ? 'Connected' : 'Offline'}</span>
              </div>
              
              {/* Notifications */}
              <div className="relative">
                <Button variant="ghost" size="sm" className="relative p-2">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 text-xs w-5 h-5 p-0 flex items-center justify-center">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">
                  {user.username}
                </span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(user.role === "kid" || !isParentView) ? (
          <KidInterface user={user} />
        ) : (
          <ParentInterface user={user} />
        )}
      </div>

      {/* Chat Widget */}
      <ChatWidget />
      
      {/* Notification System */}
      <NotificationSystem />
    </div>
  );
}
