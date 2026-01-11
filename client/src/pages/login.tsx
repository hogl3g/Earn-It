import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Coins, Heart, Star, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import duckLogo from "@/assets/duck-logo.jpeg";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { refreshAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const [registerData, setRegisterData] = useState({
    username: "",
    email: "",
    password: "",
    role: "kid" as "kid" | "parent",
    familyId: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/login", loginData);
      await refreshAuth();
      navigate("/");
      toast({
        title: "Welcome back!",
        description: "Successfully logged in to EarnIt.",
      });
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/register", registerData);
      await refreshAuth();
      navigate("/");
      toast({
        title: "Welcome to EarnIt!",
        description: "Account created successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Demo login buttons
  const demoLogin = async (role: string, username: string) => {
    setIsLoading(true);
    try {
      const email = `${username}@demo.com`;
      await apiRequest("POST", "/api/auth/login", { email, password: "password123" });
      await refreshAuth();
      navigate("/");
      toast({
        title: `Welcome ${username}!`,
        description: `Logged in as ${role}`,
      });
    } catch (error: any) {
      toast({
        title: "Demo Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        
        {/* Hero Section */}
        <div className="text-center lg:text-left space-y-6">
          <div className="flex items-center justify-center lg:justify-start space-x-4 mb-6">
            <img 
              src={duckLogo} 
              alt="EarnIt Duck Logo"
              className="h-24 w-24 rounded-full object-cover shadow-lg"
            />
            <span className="text-5xl font-black earn-blue uppercase tracking-wider" style={{ fontFamily: '"Arial Black", "Helvetica", sans-serif', fontWeight: '900', letterSpacing: '0.1em' }}>EARN•IT</span>
          </div>
          
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
            Turn Chores Into 
            <span className="kid-gradient bg-clip-text text-transparent"> Adventures</span>
          </h1>
          
          <p className="text-lg text-gray-600 max-w-md mx-auto lg:mx-0">
            Kids create chores, parents approve them, and everyone wins! 
            Real payments, family fun, and life skills all in one app.
          </p>
          
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto lg:mx-0">
            <div className="flex items-center space-x-2 text-sm text-gray-700">
              <Heart className="h-4 w-4 text-red-500" />
              <span>Family First</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-700">
              <Star className="h-4 w-4 text-yellow-500" />
              <span>Real Rewards</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-700">
              <Users className="h-4 w-4 text-blue-500" />
              <span>Together</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-700">
              <Coins className="h-4 w-4 text-green-500" />
              <span>Earn & Learn</span>
            </div>
          </div>

          {/* Demo Login Buttons */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Try the demo:</p>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => demoLogin("parent", "parent")}
                disabled={isLoading}
                className="bg-white hover:bg-gray-50"
              >
                Demo Parent
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => demoLogin("kid", "emma")}
                disabled={isLoading}
                className="bg-white hover:bg-gray-50"
              >
                Demo Kid (Emma)
              </Button>
            </div>
          </div>
        </div>

        {/* Login/Register Form */}
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Get Started</CardTitle>
            <CardDescription className="text-center">
              Join your family on EarnIt today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4 mt-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Logging in..." : "Login"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register" className="space-y-4 mt-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Username</Label>
                    <Input
                      id="register-username"
                      type="text"
                      value={registerData.username}
                      onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-role">I am a...</Label>
                    <Select
                      value={registerData.role}
                      onValueChange={(value: "kid" | "parent") => setRegisterData({ ...registerData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kid">Kid</SelectItem>
                        <SelectItem value="parent">Parent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-family">Family Code</Label>
                    <Input
                      id="register-family"
                      type="text"
                      placeholder="Create or join a family"
                      value={registerData.familyId}
                      onChange={(e) => setRegisterData({ ...registerData, familyId: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
