import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle, MessageCircle, DollarSign, Calendar, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Chore } from "@shared/schema";

interface ChoreCardProps {
  chore: Chore;
  userRole: string;
}

export default function ChoreCard({ chore, userRole }: ChoreCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCompleting, setIsCompleting] = useState(false);

  const completeChoreMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/chores/${chore.id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      toast({
        title: "Chore Completed!",
        description: "Waiting for parent approval.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete chore",
        variant: "destructive",
      });
    },
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
      case "approved":
        return {
          bg: "border-yellow-200 bg-yellow-50",
          badge: "bg-yellow-400 text-yellow-800",
          label: "Pending",
        };
      case "negotiating":
        return {
          bg: "border-orange-200 bg-orange-50",
          badge: "bg-orange-400 text-orange-800",
          label: "Negotiating",
        };
      case "completed":
        return {
          bg: "border-blue-200 bg-blue-50",
          badge: "bg-blue-400 text-blue-800",
          label: "Awaiting Approval",
        };
      case "approved_payment":
      case "paid":
        return {
          bg: "border-green-200 bg-green-50",
          badge: "bg-earn-green text-white",
          label: "Completed",
        };
      case "in_progress":
        return {
          bg: "border-purple-200 bg-purple-50",
          badge: "bg-purple-400 text-purple-800",
          label: "In Progress",
        };
      default:
        return {
          bg: "border-gray-200 bg-gray-50",
          badge: "bg-gray-400 text-gray-800",
          label: status,
        };
    }
  };

  const handleCompleteChore = async () => {
    if (chore.status !== "pending" && chore.status !== "approved") return;
    
    setIsCompleting(true);
    try {
      await completeChoreMutation.mutateAsync();
    } finally {
      setIsCompleting(false);
    }
  };

  const statusConfig = getStatusConfig(chore.status);
  const canComplete = userRole === "kid" && (chore.status === "pending" || chore.status === "approved");
  const isCompleted = chore.status === "completed" || chore.status === "approved_payment" || chore.status === "paid";

  return (
    <Card className={`border-2 ${statusConfig.bg} relative`}>
      <CardContent className="p-4">
        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <Badge className={`${statusConfig.badge} text-xs font-bold`}>
            {statusConfig.label}
          </Badge>
        </div>

        {/* Chore Info */}
        <div className="mb-3 pr-20">
          <h4 className="font-bold text-gray-800 mb-1">{chore.title}</h4>
          <p className="text-sm text-gray-600 line-clamp-2">{chore.description}</p>
        </div>

        {/* Price and Action */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center">
            {chore.originalPrice && chore.originalPrice !== chore.price && (
              <span className="text-lg line-through text-gray-400 mr-2">
                ${chore.originalPrice}
              </span>
            )}
            <span className="text-2xl font-bold earn-green">
              ${chore.price}
            </span>
          </div>

          {/* Action Button */}
          {canComplete && (
            <Button 
              size="sm"
              className="bg-earn-blue hover:bg-blue-600 text-white"
              onClick={handleCompleteChore}
              disabled={isCompleting || completeChoreMutation.isPending}
            >
              {isCompleting ? "Completing..." : "Complete"}
            </Button>
          )}

          {chore.status === "negotiating" && (
            <Button size="sm" variant="outline" className="border-orange-400 text-orange-600">
              <MessageCircle className="h-4 w-4 mr-1" />
              Chat
            </Button>
          )}

          {isCompleted && (
            <div className="text-earn-green">
              <CheckCircle className="h-6 w-6" />
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="space-y-1">
          {chore.scheduledDate && (
            <div className="flex items-center text-xs text-gray-500">
              <Calendar className="h-3 w-3 mr-1" />
              Due: {new Date(chore.scheduledDate).toLocaleDateString()} at{" "}
              {new Date(chore.scheduledDate).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          )}

          {chore.completedAt && (
            <div className="flex items-center text-xs text-gray-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed {new Date(chore.completedAt).toLocaleDateString()}
            </div>
          )}

          {chore.status === "negotiating" && chore.originalPrice && (
            <div className="text-xs text-orange-600">
              Price negotiation in progress
            </div>
          )}

          {chore.assignedBy === "parent" && (
            <div className="flex items-center text-xs text-gray-500">
              <User className="h-3 w-3 mr-1" />
              Assigned by parent
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
