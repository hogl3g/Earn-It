import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  Send, 
  X, 
  Bot, 
  Users, 
  Lightbulb, 
  ShoppingCart,
  Minimize2,
  Maximize2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import AIAssistant from "./ai-assistant";

interface Message {
  id: number;
  fromUserId: number;
  toUserId?: number;
  choreId?: number;
  content: string;
  type: "chat" | "negotiation" | "system" | "ai";
  createdAt: string;
  fromUser?: {
    id: number;
    username: string;
    role: string;
  };
}

export default function ChatWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState("family");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["/api/messages/family"],
    enabled: isOpen && !!user,
  });

  const { data: familyMembers = [] } = useQuery({
    queryKey: ["/api/users/family"],
    enabled: isOpen && !!user,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (messageData: any) => apiRequest("POST", "/api/messages", messageData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/family"] });
      setNewMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageData = {
      content: newMessage,
      type: "chat" as const,
      toUserId: null, // Family broadcast
    };

    sendMessageMutation.mutate(messageData);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const dateKey = formatDate(message.createdAt);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });
    
    return groups;
  };

  const unreadCount = messages.filter((m: Message) => 
    m.fromUserId !== user?.id && m.type !== "system"
  ).length;

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-white rounded-full shadow-2xl p-4 hover:shadow-3xl transition-shadow relative"
          size="lg"
        >
          <div className="relative">
            <MessageCircle className="h-6 w-6 text-earn-blue" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 text-xs w-5 h-5 p-0 flex items-center justify-center"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-earn-green rounded-full animate-pulse"></div>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
      isMinimized ? "w-80 h-16" : "w-96 h-[600px]"
    }`}>
      <Card className="h-full shadow-2xl">
        <CardHeader className="pb-3 bg-gradient-to-r from-earn-blue to-kid-purple text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center space-x-2">
              <MessageCircle className="h-5 w-5" />
              <span>EarnIt Chat</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-white hover:bg-white/20 p-1 h-8 w-8"
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 p-1 h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="p-0 flex flex-col h-[calc(100%-80px)]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 rounded-none border-b">
                <TabsTrigger value="family" className="flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span>Family</span>
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex items-center space-x-1">
                  <Bot className="h-4 w-4" />
                  <span>AI Helper</span>
                </TabsTrigger>
                <TabsTrigger value="tips" className="flex items-center space-x-1">
                  <Lightbulb className="h-4 w-4" />
                  <span>Tips</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="family" className="flex-1 flex flex-col p-0 m-0">
                {/* Messages Area */}
                <ScrollArea className="flex-1 p-4">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500">Loading messages...</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 mb-2">No messages yet</p>
                      <p className="text-xs text-gray-400">Start a family conversation!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(groupMessagesByDate(messages)).map(([date, dateMessages]) => (
                        <div key={date}>
                          <div className="text-center mb-3">
                            <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                              {date}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {dateMessages.map((message: Message) => {
                              const isOwn = message.fromUserId === user?.id;
                              const sender = familyMembers.find((m: any) => m.id === message.fromUserId);
                              
                              return (
                                <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[80%] ${isOwn ? "order-2" : "order-1"}`}>
                                    {!isOwn && (
                                      <div className="flex items-center space-x-2 mb-1">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                          sender?.role === "parent" ? "bg-parent-gray" : "bg-kid-pink"
                                        }`}>
                                          {sender?.username?.[0]?.toUpperCase()}
                                        </div>
                                        <span className="text-xs text-gray-500">{sender?.username}</span>
                                      </div>
                                    )}
                                    <div className={`rounded-lg px-3 py-2 ${
                                      isOwn 
                                        ? "bg-earn-blue text-white" 
                                        : message.type === "system" 
                                        ? "bg-gray-100 text-gray-700 italic"
                                        : "bg-gray-100 text-gray-900"
                                    }`}>
                                      <p className="text-sm">{message.content}</p>
                                      <p className={`text-xs mt-1 ${
                                        isOwn ? "text-blue-100" : "text-gray-500"
                                      }`}>
                                        {formatTime(message.createdAt)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Message Input */}
                <div className="p-4 border-t">
                  <form onSubmit={handleSendMessage} className="flex space-x-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                      disabled={sendMessageMutation.isPending}
                    />
                    <Button 
                      type="submit" 
                      size="sm"
                      disabled={!newMessage.trim() || sendMessageMutation.isPending}
                      className="bg-earn-blue hover:bg-blue-600"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="flex-1 p-0 m-0">
                <AIAssistant />
              </TabsContent>

              <TabsContent value="tips" className="flex-1 p-4 m-0">
                <ScrollArea className="h-full">
                  <div className="space-y-4">
                    <div className="text-center mb-6">
                      <Lightbulb className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                      <h3 className="font-bold text-lg">Chore Tips & Tricks</h3>
                      <p className="text-sm text-gray-600">Quick tips to earn more and work smarter!</p>
                    </div>

                    <div className="space-y-3">
                      <Card className="border-l-4 border-yellow-400">
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-yellow-700 mb-2">💡 Pricing Tips</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Price fairly - parents can negotiate</li>
                            <li>• Consider time and effort needed</li>
                            <li>• Look at what siblings charge</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-green-400">
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-green-700 mb-2">⭐ Quality Work</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Do your best work every time</li>
                            <li>• Ask questions if you're unsure</li>
                            <li>• Take before/after photos</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-blue-400">
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-blue-700 mb-2">📅 Time Management</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Schedule chores when you have energy</li>
                            <li>• Break big tasks into smaller ones</li>
                            <li>• Use timers to stay focused</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-purple-400">
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-purple-700 mb-2">🎯 Negotiation</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Explain why your price is fair</li>
                            <li>• Be open to parent feedback</li>
                            <li>• Suggest alternatives if needed</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
