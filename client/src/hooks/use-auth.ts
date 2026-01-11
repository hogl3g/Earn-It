import React, { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: Infinity,
  });

  const login = async (email: string, password: string) => {
    await apiRequest("POST", "/api/auth/login", { email, password });
    await refetch();
  };

  const logout = () => {
    queryClient.clear();
    window.location.reload();
  };

  const refreshAuth = async () => {
    await refetch();
  };

  const value: AuthContextType = {
    user: (user as User) || null,
    isLoading,
    login,
    logout,
    refreshAuth,
  };

  return React.createElement(
    AuthContext.Provider,
    { value: value },
    children
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default useAuth;