import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Plus, ClipboardCheck, CreditCard, BarChart3, Users, Check, X, MessageCircle, DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ChoreCard from "./chore-card";
import { User } from "@shared/schema";

interface ParentInterfaceProps {
  user: User;
}

export default function ParentInterface({ user }: ParentInterfaceProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: chores = [], isLoading: choresLoading } = useQuery({
    queryKey: ["/api/chores"],
  });

  const { data: familyMembers = [] } = useQuery({
    queryKey: ["/api/users/family"],
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/analytics/family"],
  });

  const approveChoreMutation = useMutation({
    mutationFn: (choreId: number) => apiRequest("POST", `/api/chores/${choreId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/family"] });
      toast({
        title: "Chore Approved!",
        description: "Payment has been added to the child's account.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve chore",
        variant: "destructive",
      });
    },
  });

  const rejectChoreMutation = useMutation({
    mutationFn: (choreId: number) => apiRequest("PUT", `/api/chores/${choreId}`, { status: "pending" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      toast({
        title: "Chore Rejected",
        description: "The child will need to redo this chore.",
        variant: "destructive",
      });
    },
  });

  const kids = familyMembers.filter((member: any) => member.role === "kid");
  const pendingApprovals = chores.filter((chore: any) => chore.status === "completed");
  const activeNegotiations = chores.filter((chore: any) => chore.status === "negotiating");
  const recentActivity = chores
    .filter((chore: any) => chore.completedAt || chore.createdAt)
    .sort((a: any, b: any) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
    .slice(0, 5);

  const handleApproveChore = (choreId: number) => {
    approveChoreMutation.mutate(choreId);
  };

  const handleRejectChore = (choreId: number) => {
    rejectChoreMutation.mutate(choreId);
  };

  if (choresLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-xl p-6 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Parent Dashboard Header */}
      <div className="bg-white rounded-2xl shadow-xl p-6 parent-gradient text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Parent Dashboard</h1>
            <p className="text-lg opacity-90">Managing family chores and payments</p>
          </div>
          <div className="text-right">
            <div className="bg-white/20 rounded-full p-4 mb-2">
              <Users className="text-yellow-300 h-8 w-8" />
            </div>
            <p className="text-sm opacity-90">{kids.length} Kids Active</p>
          </div>
        </div>
        
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold">${stats?.totalEarned || "0.00"}</div>
            <div className="text-sm opacity-80">Total Earned</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats?.completedChores || 0}</div>
            <div className="text-sm opacity-80">Chores Completed</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats?.pendingApprovals || 0}</div>
            <div className="text-sm opacity-80">Pending Approval</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats?.activeNegotiations || 0}</div>
            <div className="text-sm opacity-80">Negotiations</div>
          </div>
        </div>
      </div>

      {/* Parent Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Create Chore */}
        <Card 
          className="hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-earn-blue"
          onClick={() => navigate("/chore/new")}
        >
          <CardContent className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-earn-blue rounded-full p-3 mr-3">
                <Plus className="text-white h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Assign Chore</h3>
            </div>
            <p className="text-gray-600 text-sm">Create and assign chores to kids</p>
          </CardContent>
        </Card>

        {/* Review Requests */}
        <Card className="hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-orange-500">
          <CardContent className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-orange-500 rounded-full p-3 mr-3">
                <ClipboardCheck className="text-white h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Review Requests</h3>
            </div>
            <p className="text-gray-600 text-sm">Approve or negotiate chores</p>
          </CardContent>
        </Card>

        {/* Payment Center */}
        <Card 
          className="hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-earn-green"
          onClick={() => navigate("/payment")}
        >
          <CardContent className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-earn-green rounded-full p-3 mr-3">
                <CreditCard className="text-white h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Payment Center</h3>
            </div>
            <p className="text-gray-600 text-sm">Process payments to kids</p>
          </CardContent>
        </Card>

        {/* Analytics */}
        <Card className="hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-purple-500 rounded-full p-3 mr-3">
                <BarChart3 className="text-white h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Analytics</h3>
            </div>
            <p className="text-gray-600 text-sm">View family progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Pending Approvals</h2>
            
            <div className="space-y-4">
              {pendingApprovals.map((chore: any) => {
                const kid = kids.find((k: any) => k.id === chore.kidId);
                return (
                  <div key={chore.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-kid-pink rounded-full flex items-center justify-center mr-4">
                        <span className="text-white font-bold">{kid?.username?.[0]?.toUpperCase()}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800">
                          {kid?.username} completed "{chore.title}"
                        </h4>
                        <p className="text-sm text-gray-600">
                          Completed {chore.completedAt && new Date(chore.completedAt).toLocaleDateString()} • Earning: ${chore.price}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleRejectChore(chore.id)}
                        disabled={rejectChoreMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button 
                        className="bg-earn-green hover:bg-green-600"
                        size="sm"
                        onClick={() => handleApproveChore(chore.id)}
                        disabled={approveChoreMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Negotiations */}
      {activeNegotiations.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Active Negotiations</h2>
            
            <div className="space-y-4">
              {activeNegotiations.map((chore: any) => {
                const kid = kids.find((k: any) => k.id === chore.kidId);
                return (
                  <div key={chore.id} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-kid-pink rounded-full flex items-center justify-center mr-3">
                          <span className="text-white font-bold text-sm">{kid?.username?.[0]?.toUpperCase()}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">{kid?.username} wants to "{chore.title}"</h4>
                          <p className="text-sm text-gray-600">
                            {chore.originalPrice ? `Original: $${chore.originalPrice} → Current: $${chore.price}` : `Proposed price: $${chore.price}`}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800">
                        Negotiating
                      </Badge>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        className="bg-earn-green hover:bg-green-600"
                        size="sm"
                        onClick={() => {
                          // Accept current price
                          apiRequest("PUT", `/api/chores/${chore.id}`, { status: "approved" })
                            .then(() => {
                              queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
                              toast({ title: "Negotiation Accepted", description: `Approved chore for $${chore.price}` });
                            });
                        }}
                      >
                        Accept ${chore.price}
                      </Button>
                      <Button variant="outline" size="sm">
                        Counter Offer
                      </Button>
                      <Button variant="outline" size="sm">
                        <MessageCircle className="h-4 w-4 mr-1" />
                        Continue Chat
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Family Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Kids Performance */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Kids Performance</h3>
            
            <div className="space-y-4">
              {kids.map((kid: any) => {
                const kidChores = chores.filter((c: any) => c.kidId === kid.id);
                const completionRate = kidChores.length > 0 
                  ? Math.round((kidChores.filter((c: any) => c.status === "completed" || c.status === "approved_payment" || c.status === "paid").length / kidChores.length) * 100)
                  : 0;
                
                return (
                  <div key={kid.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-kid-pink/10 to-kid-pink/5 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-kid-pink rounded-full flex items-center justify-center mr-4">
                        <span className="text-white font-bold">{kid.username[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800">{kid.username}</h4>
                        <p className="text-sm text-gray-600">{kid.choreCount} chores • {completionRate}% completion rate</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold earn-green">${kid.totalEarned}</div>
                      <div className="text-xs text-gray-500">Total earned</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Recent Activity</h3>
            
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No recent activity</p>
              ) : (
                recentActivity.map((chore: any) => {
                  const kid = kids.find((k: any) => k.id === chore.kidId);
                  const isCompleted = chore.status === "completed" || chore.status === "approved_payment" || chore.status === "paid";
                  
                  return (
                    <div key={chore.id} className="flex items-start space-x-3">
                      <div className={`rounded-full p-2 mt-1 ${
                        isCompleted ? "bg-earn-green" : 
                        chore.status === "negotiating" ? "bg-orange-500" : "bg-earn-blue"
                      }`}>
                        {isCompleted ? (
                          <Check className="text-white h-3 w-3" />
                        ) : chore.status === "negotiating" ? (
                          <MessageCircle className="text-white h-3 w-3" />
                        ) : (
                          <Plus className="text-white h-3 w-3" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">
                          {kid?.username} {isCompleted ? "completed" : "created"} "{chore.title}"
                        </p>
                        <p className="text-xs text-gray-500">
                          {chore.completedAt ? new Date(chore.completedAt).toLocaleDateString() : new Date(chore.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
