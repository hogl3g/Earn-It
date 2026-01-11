import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, DollarSign, FileText, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export default function ChoreForm() {
  const [, navigate] = useLocation();
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEditing = !!id;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    kidId: user?.role === "kid" ? user.id : "",
    scheduledDate: "",
  });

  // Fetch existing chore if editing
  const { data: chore, isLoading } = useQuery({
    queryKey: [`/api/chores/${id}`],
    enabled: isEditing,
  });

  // Fetch family members if parent
  const { data: familyMembers = [] } = useQuery({
    queryKey: ["/api/users/family"],
    enabled: user?.role === "parent",
  });

  const kids = familyMembers.filter((member: any) => member.role === "kid");

  useEffect(() => {
    if (chore) {
      setFormData({
        title: chore.title,
        description: chore.description,
        price: chore.price,
        kidId: chore.kidId,
        scheduledDate: chore.scheduledDate ? 
          new Date(chore.scheduledDate).toISOString().slice(0, 16) : "",
      });
    }
  }, [chore]);

  const createChoreMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/chores", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      toast({
        title: "Chore Created!",
        description: "Your chore has been submitted for review.",
      });
      navigate("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create chore",
        variant: "destructive",
      });
    },
  });

  const updateChoreMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/chores/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      toast({
        title: "Chore Updated!",
        description: "Your changes have been saved.",
      });
      navigate("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update chore",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const choreData = {
      ...formData,
      price: parseFloat(formData.price).toFixed(2),
      kidId: parseInt(formData.kidId),
      scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate) : null,
    };

    if (isEditing) {
      updateChoreMutation.mutate(choreData);
    } else {
      createChoreMutation.mutate(choreData);
    }
  };

  const handleBack = () => {
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chore...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={handleBack} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? "Edit Chore" : "Create New Chore"}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>{isEditing ? "Edit Your Chore" : "What needs to be done?"}</span>
            </CardTitle>
            <CardDescription>
              {user?.role === "kid" 
                ? "Describe the chore you want to do and set your price!"
                : "Create a chore for one of your kids."
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Kid Selection (for parents) */}
              {user?.role === "parent" && (
                <div className="space-y-2">
                  <Label htmlFor="kidId" className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>Assign to</span>
                  </Label>
                  <Select
                    value={formData.kidId.toString()}
                    onValueChange={(value) => setFormData({ ...formData, kidId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a child" />
                    </SelectTrigger>
                    <SelectContent>
                      {kids.map((kid: any) => (
                        <SelectItem key={kid.id} value={kid.id.toString()}>
                          {kid.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Chore Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="What needs to be done?"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the chore in detail..."
                  rows={4}
                  required
                />
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price" className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4" />
                  <span>{user?.role === "kid" ? "My Price" : "Payment Amount"}</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500">$</span>
                  <Input
                    id="price"
                    type="number"
                    step="0.50"
                    min="0.50"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="pl-8"
                    placeholder="0.00"
                    required
                  />
                </div>
                {user?.role === "kid" && (
                  <p className="text-xs text-gray-600">
                    💡 Tip: Price fairly! Parents can negotiate if needed.
                  </p>
                )}
              </div>

              {/* Scheduled Date */}
              <div className="space-y-2">
                <Label htmlFor="scheduledDate" className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>When do you want to do this? (Optional)</span>
                </Label>
                <Input
                  id="scheduledDate"
                  type="datetime-local"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className={`flex-1 ${user?.role === "kid" ? "kid-gradient" : "bg-primary"}`}
                  disabled={createChoreMutation.isPending || updateChoreMutation.isPending}
                >
                  {createChoreMutation.isPending || updateChoreMutation.isPending
                    ? (isEditing ? "Updating..." : "Creating...")
                    : (isEditing ? "Update Chore" : 
                        user?.role === "kid" ? "Submit to Parents" : "Create Chore")
                  }
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
