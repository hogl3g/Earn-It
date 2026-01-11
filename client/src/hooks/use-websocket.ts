import { useEffect, useState, useRef } from "react";
import { useAuth } from "./use-auth";

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: string | null;
  sendMessage: (message: any) => void;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
}

export function useWebSocket(): UseWebSocketReturn {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = () => {
    if (!user) return;

    try {
      setConnectionStatus("connecting");
      
      // Determine WebSocket URL
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setConnectionStatus("connected");
        reconnectAttempts.current = 0;
        
        // Authenticate with server
        ws.send(JSON.stringify({
          type: "auth",
          userId: user.id
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "auth_success") {
            console.log("WebSocket authenticated successfully");
            return;
          }
          
          setLastMessage(event.data);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected", event.code, event.reason);
        setIsConnected(false);
        websocketRef.current = null;
        
        if (event.code !== 1000) { // Not a normal closure
          setConnectionStatus("error");
          attemptReconnect();
        } else {
          setConnectionStatus("disconnected");
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("error");
        setIsConnected(false);
      };

    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setConnectionStatus("error");
      attemptReconnect();
    }
  };

  const attemptReconnect = () => {
    if (reconnectAttempts.current >= 5) {
      console.log("Max reconnection attempts reached");
      setConnectionStatus("error");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Exponential backoff
    reconnectAttempts.current++;
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (user) {
        connect();
      }
    }, delay);
  };

  const sendMessage = (message: any) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected, cannot send message");
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (websocketRef.current) {
      websocketRef.current.close(1000, "Component unmounting");
      websocketRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus("disconnected");
    reconnectAttempts.current = 0;
  };

  // Connect when user is available
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  // Handle page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user && !isConnected) {
        console.log("Page became visible, attempting to reconnect WebSocket");
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, isConnected]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (isConnected && websocketRef.current) {
      const heartbeat = setInterval(() => {
        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
          websocketRef.current.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000); // Every 30 seconds

      return () => clearInterval(heartbeat);
    }
  }, [isConnected]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connectionStatus,
  };
}
