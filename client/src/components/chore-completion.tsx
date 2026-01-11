import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Chore } from "@shared/schema";
import { Camera, Clock, Upload, CheckCircle, Play } from "lucide-react";

interface ChoreCompletionProps {
  chore: Chore;
  onUpdate?: () => void;
}

export default function ChoreCompletion({ chore, onUpdate }: ChoreCompletionProps) {
  const [proofPhoto, setProofPhoto] = useState<string>("");
  const [completionTime, setCompletionTime] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Timer effect for tracking elapsed time
  useState(() => {
    if (chore.status === "in_progress" && chore.startedAt) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const start = new Date(chore.startedAt!).getTime();
        setElapsedTime(Math.floor((now - start) / (1000 * 60)));
      }, 1000);
      return () => clearInterval(interval);
    }
  });

  const startChoreMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/chores/${chore.id}/start`),
    onSuccess: () => {
      toast({
        title: "Chore Started!",
        description: "Time tracking has begun. Good luck!",
      });
      setStartTime(new Date());
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      onUpdate?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start chore",
        variant: "destructive",
      });
    },
  });

  const completeChoreMutation = useMutation({
    mutationFn: (data: { completionTimeMinutes?: number; proofPhoto?: string }) =>
      apiRequest("POST", `/api/chores/${chore.id}/complete`, data),
    onSuccess: () => {
      toast({
        title: "Chore Completed!",
        description: "Great job! Your completion has been submitted for approval.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chores"] });
      onUpdate?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete chore",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setProofPhoto(base64);
        setIsUploading(false);
        toast({
          title: "Photo Uploaded",
          description: "Proof photo has been attached to your chore completion.",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartChore = () => {
    startChoreMutation.mutate();
  };

  const handleCompleteChore = () => {
    const data: { completionTimeMinutes?: number; proofPhoto?: string } = {};
    
    if (completionTime > 0) {
      data.completionTimeMinutes = completionTime;
    }
    
    if (proofPhoto) {
      data.proofPhoto = proofPhoto;
    }
    
    completeChoreMutation.mutate(data);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getStatusBadge = () => {
    switch (chore.status) {
      case "pending":
        return <Badge variant="secondary">Ready to Start</Badge>;
      case "in_progress":
        return <Badge variant="default">In Progress</Badge>;
      case "completed":
        return <Badge variant="outline">Awaiting Approval</Badge>;
      case "approved_payment":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      default:
        return <Badge variant="secondary">{chore.status}</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{chore.title}</span>
          {getStatusBadge()}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{chore.description}</p>
        <p className="text-lg font-semibold text-green-600">${chore.price}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Time Tracking Section */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Time Tracking
          </Label>
          
          {chore.status === "pending" && (
            <Button 
              onClick={handleStartChore}
              disabled={startChoreMutation.isPending}
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Chore
            </Button>
          )}
          
          {chore.status === "in_progress" && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium">Time Elapsed:</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatTime(elapsedTime)}
              </p>
            </div>
          )}
          
          {(chore.status === "completed" || chore.status === "approved_payment") && chore.completionTimeMinutes && (
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm font-medium">Completion Time:</p>
              <p className="text-xl font-bold text-green-600">
                {formatTime(chore.completionTimeMinutes)}
              </p>
            </div>
          )}
          
          {chore.status === "in_progress" && (
            <div className="space-y-2">
              <Label htmlFor="manual-time">Manual Time Entry (minutes):</Label>
              <Input
                id="manual-time"
                type="number"
                value={completionTime}
                onChange={(e) => setCompletionTime(Number(e.target.value))}
                placeholder="Enter completion time..."
              />
            </div>
          )}
        </div>

        {/* Photo Upload Section */}
        {chore.status === "in_progress" && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Proof Photo (Optional)
            </Label>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {proofPhoto ? "Change Photo" : "Upload Photo"}
            </Button>
            
            {proofPhoto && (
              <div className="mt-2">
                <img
                  src={proofPhoto}
                  alt="Proof of completion"
                  className="w-full h-32 object-cover rounded-lg border"
                />
              </div>
            )}
          </div>
        )}

        {/* Display uploaded photo for completed chores */}
        {chore.proofPhoto && (chore.status === "completed" || chore.status === "approved_payment") && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Proof Photo
            </Label>
            <img
              src={chore.proofPhoto}
              alt="Proof of completion"
              className="w-full h-32 object-cover rounded-lg border"
            />
          </div>
        )}

        {/* Complete Chore Button */}
        {chore.status === "in_progress" && (
          <Button
            onClick={handleCompleteChore}
            disabled={completeChoreMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Complete Chore
          </Button>
        )}
      </CardContent>
    </Card>
  );
}