import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Clock, Upload, CheckCircle, Play, Pause } from "lucide-react";
import DuckLogo from "@/components/duck-logo";

interface DemoChore {
  id: number;
  title: string;
  description: string;
  price: string;
  status: "pending" | "in_progress" | "completed";
  startedAt: Date | null;
  completedAt: Date | null;
  completionTimeMinutes: number | null;
  beforePhoto: string | null;
  afterPhoto: string | null;
}

export default function TimePhotoDemo() {
  const [chore, setChore] = useState<DemoChore>({
    id: 1,
    title: "Clean Living Room",
    description: "Vacuum, dust furniture, organize magazines",
    price: "12.00",
    status: "pending",
    startedAt: null,
    completedAt: null,
    completionTimeMinutes: null,
    beforePhoto: null,
    afterPhoto: null,
  });

  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [beforePhoto, setBeforePhoto] = useState<string>("");
  const [afterPhoto, setAfterPhoto] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [currentPhotoType, setCurrentPhotoType] = useState<"before" | "after">("before");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer effect for tracking elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (chore.status === "in_progress" && chore.startedAt) {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const start = new Date(chore.startedAt!).getTime();
        setElapsedTime(Math.floor((now - start) / (1000 * 60)));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [chore.status, chore.startedAt]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        if (currentPhotoType === "before") {
          setBeforePhoto(base64);
          setChore(prev => ({ ...prev, beforePhoto: base64 }));
        } else {
          setAfterPhoto(base64);
          setChore(prev => ({ ...prev, afterPhoto: base64 }));
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartChore = () => {
    setChore(prev => ({
      ...prev,
      status: "in_progress",
      startedAt: new Date()
    }));
  };

  const handleCompleteChore = () => {
    const completionTime = chore.startedAt 
      ? Math.floor((new Date().getTime() - new Date(chore.startedAt).getTime()) / (1000 * 60))
      : 0;

    setChore(prev => ({
      ...prev,
      status: "completed",
      completedAt: new Date(),
      completionTimeMinutes: completionTime,
      beforePhoto: beforePhoto || null,
      afterPhoto: afterPhoto || null
    }));
  };

  const resetDemo = () => {
    setChore({
      id: 1,
      title: "Clean Living Room",
      description: "Vacuum, dust furniture, organize magazines",
      price: "12.00",
      status: "pending",
      startedAt: null,
      completedAt: null,
      completionTimeMinutes: null,
      beforePhoto: null,
      afterPhoto: null,
    });
    setElapsedTime(0);
    setBeforePhoto("");
    setAfterPhoto("");
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
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      default:
        return <Badge variant="secondary">{chore.status}</Badge>;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-6 text-center">
          <img 
            src="/attached_assets/IMG_2181.png" 
            alt="Earn It Logo - Cartoon Duck with Cleaning Supplies"
            className="mx-auto mb-4 h-32 w-auto rounded-lg"
          />
          <h1 className="text-4xl font-bold text-orange-500 mb-2">Earn It!</h1>
        </div>
        <h2 className="text-2xl font-bold mb-2">Before & After Photo Demo</h2>
        <p className="text-gray-600">See how kids can document their work from start to finish</p>
      </div>

      <Card className="w-full">
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
                className="w-full"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Chore
              </Button>
            )}
            
            {chore.status === "in_progress" && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800">Time Elapsed:</p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatTime(elapsedTime)}
                </p>
                <p className="text-xs text-blue-600 mt-1">Timer started automatically</p>
              </div>
            )}
            
            {chore.status === "completed" && chore.completionTimeMinutes && (
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-800">Total Completion Time:</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatTime(chore.completionTimeMinutes)}
                </p>
                <p className="text-xs text-green-600 mt-1">Automatically calculated</p>
              </div>
            )}
          </div>

          {/* Before Photo Section */}
          {chore.status === "pending" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Before Photo (Optional)
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
                onClick={() => {
                  setCurrentPhotoType("before");
                  fileInputRef.current?.click();
                }}
                disabled={isUploading}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {beforePhoto ? "Change Before Photo" : "Take Before Photo"}
              </Button>
              
              {(beforePhoto || chore.beforePhoto) && (
                <div className="mt-2">
                  <img
                    src={beforePhoto || chore.beforePhoto!}
                    alt="Before starting"
                    className="w-full h-40 object-cover rounded-lg border"
                  />
                  <p className="text-xs text-gray-500 mt-1">Before photo taken</p>
                </div>
              )}
            </div>
          )}

          {/* After Photo Section */}
          {chore.status === "in_progress" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                After Photo (Optional)
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
                onClick={() => {
                  setCurrentPhotoType("after");
                  fileInputRef.current?.click();
                }}
                disabled={isUploading}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {afterPhoto ? "Change After Photo" : "Take After Photo"}
              </Button>
              
              {(afterPhoto || chore.afterPhoto) && (
                <div className="mt-2">
                  <img
                    src={afterPhoto || chore.afterPhoto!}
                    alt="After completion"
                    className="w-full h-40 object-cover rounded-lg border"
                  />
                  <p className="text-xs text-gray-500 mt-1">After photo will be submitted with completion</p>
                </div>
              )}
            </div>
          )}

          {/* Display before and after photos for completed chores */}
          {chore.status === "completed" && (chore.beforePhoto || chore.afterPhoto) && (
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Before & After Photos
              </Label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chore.beforePhoto && (
                  <div>
                    <p className="text-sm font-medium mb-2">Before</p>
                    <img
                      src={chore.beforePhoto}
                      alt="Before starting"
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                  </div>
                )}
                {chore.afterPhoto && (
                  <div>
                    <p className="text-sm font-medium mb-2">After</p>
                    <img
                      src={chore.afterPhoto}
                      alt="After completion"
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-green-600">Photos submitted with completion</p>
            </div>
          )}

          {/* Complete Chore Button */}
          {chore.status === "in_progress" && (
            <Button
              onClick={handleCompleteChore}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Chore
            </Button>
          )}

          {/* Reset Demo Button */}
          {chore.status === "completed" && (
            <Button
              onClick={resetDemo}
              variant="outline"
              className="w-full mt-4"
            >
              Reset Demo
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Feature Explanation */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">How These Features Work:</h3>
        <ul className="text-sm space-y-1 text-gray-600">
          <li>• <strong>Before Photo:</strong> Kids take a photo showing the initial state of the area</li>
          <li>• <strong>Time Tracking:</strong> Automatically starts when kids begin the chore</li>
          <li>• <strong>Real-time Timer:</strong> Shows elapsed time while working</li>
          <li>• <strong>After Photo:</strong> Kids document their completed work with a final photo</li>
          <li>• <strong>Before & After Comparison:</strong> Parents can see the transformation</li>
          <li>• <strong>Automatic Calculation:</strong> Completion time is calculated automatically</li>
        </ul>
        <p className="text-xs text-gray-500 mt-3">
          This helps parents verify work quality and gives kids pride in showing their accomplishments.
        </p>
      </div>
    </div>
  );
}