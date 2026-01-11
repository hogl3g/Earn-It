import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  Send, 
  Lightbulb, 
  ShoppingCart, 
  Star, 
  ExternalLink,
  Loader2,
  Sparkles 
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AIResponse {
  tips?: string[];
  products?: Array<{
    name: string;
    description: string;
    category: string;
  }>;
}

interface ConversationItem {
  id: string;
  type: "user" | "ai" | "tips" | "products";
  content: string;
  data?: AIResponse;
  timestamp: Date;
}

export default function AIAssistant() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<ConversationItem[]>([
    {
      id: "welcome",
      type: "ai",
      content: "Hi! I'm your EarnIt AI assistant! 🤖 I can help you with chore tips, suggest tools to make tasks easier, or answer questions about completing chores efficiently. What chore would you like help with?",
      timestamp: new Date(),
    }
  ]);

  const getTipsMutation = useMutation({
    mutationFn: ({ title, description }: { title: string; description: string }) =>
      apiRequest("POST", "/api/ai/tips", { choreTitle: title, choreDescription: description }),
    onSuccess: (response, variables) => {
      response.json().then((data: AIResponse) => {
        const newItem: ConversationItem = {
          id: Date.now().toString(),
          type: "tips",
          content: `Here are some helpful tips for "${variables.title}":`,
          data: data,
          timestamp: new Date(),
        };
        setConversation(prev => [...prev, newItem]);
      });
    },
    onError: (error: any) => {
      toast({
        title: "AI Assistant Unavailable",
        description: "I'm having trouble connecting right now. Please try again later!",
        variant: "destructive",
      });
    },
  });

  const getProductsMutation = useMutation({
    mutationFn: ({ title, description }: { title: string; description: string }) =>
      apiRequest("POST", "/api/ai/products", { choreTitle: title, choreDescription: description }),
    onSuccess: (response, variables) => {
      response.json().then((data: AIResponse) => {
        const newItem: ConversationItem = {
          id: Date.now().toString(),
          type: "products",
          content: `Here are some tools that might help with "${variables.title}":`,
          data: data,
          timestamp: new Date(),
        };
        setConversation(prev => [...prev, newItem]);
      });
    },
    onError: (error: any) => {
      toast({
        title: "AI Assistant Unavailable",
        description: "I'm having trouble connecting right now. Please try again later!",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const userMessage: ConversationItem = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };
    setConversation(prev => [...prev, userMessage]);

    // Parse the message to determine what to do
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes("tip") || lowerInput.includes("help") || lowerInput.includes("how")) {
      // Extract chore name (basic parsing)
      const choreTitle = input.replace(/how|to|tips|for|help|with|me|please|\?/gi, "").trim();
      if (choreTitle) {
        getTipsMutation.mutate({ 
          title: choreTitle, 
          description: `Help with ${choreTitle}` 
        });
      } else {
        const aiResponse: ConversationItem = {
          id: Date.now().toString() + "_ai",
          type: "ai",
          content: "I'd love to help! Can you tell me specifically which chore you need tips for? For example: 'tips for cleaning my room' or 'how to wash dishes quickly'.",
          timestamp: new Date(),
        };
        setConversation(prev => [...prev, aiResponse]);
      }
    } else if (lowerInput.includes("tool") || lowerInput.includes("product") || lowerInput.includes("equipment")) {
      // Extract chore name
      const choreTitle = input.replace(/tool|product|equipment|for|what|need|\?/gi, "").trim();
      if (choreTitle) {
        getProductsMutation.mutate({ 
          title: choreTitle, 
          description: `Tools and products for ${choreTitle}` 
        });
      } else {
        const aiResponse: ConversationItem = {
          id: Date.now().toString() + "_ai",
          type: "ai",
          content: "I can suggest helpful tools! What chore do you need equipment recommendations for? For example: 'tools for cleaning windows' or 'products for organizing my room'.",
          timestamp: new Date(),
        };
        setConversation(prev => [...prev, aiResponse]);
      }
    } else {
      // General AI response
      const responses = [
        "That's a great question! I can help you with chore tips and tool recommendations. Try asking me something like 'tips for cleaning my room' or 'tools for doing laundry'.",
        "I'm here to make chores easier! Ask me for tips about specific chores or what tools might help you work more efficiently.",
        "I love helping with chores! You can ask me for step-by-step tips or product recommendations for any household task.",
        "Great to chat with you! I specialize in chore advice. What specific task would you like help with today?",
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      const aiResponse: ConversationItem = {
        id: Date.now().toString() + "_ai",
        type: "ai",
        content: randomResponse,
        timestamp: new Date(),
      };
      setConversation(prev => [...prev, aiResponse]);
    }

    setInput("");
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isLoading = getTipsMutation.isPending || getProductsMutation.isPending;

  return (
    <div className="h-full flex flex-col">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {conversation.map((item) => (
            <div key={item.id} className="space-y-2">
              {item.type === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-earn-blue text-white rounded-lg px-3 py-2">
                    <p className="text-sm">{item.content}</p>
                    <p className="text-xs text-blue-100 mt-1">{formatTime(item.timestamp)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-[90%]">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-xs text-gray-500">EarnIt AI Assistant</span>
                    </div>
                    
                    <div className="bg-gray-100 rounded-lg px-3 py-2 mb-2">
                      <p className="text-sm text-gray-900">{item.content}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatTime(item.timestamp)}</p>
                    </div>

                    {/* Tips Display */}
                    {item.type === "tips" && item.data?.tips && (
                      <Card className="border-l-4 border-yellow-400 bg-yellow-50">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <Lightbulb className="h-5 w-5 text-yellow-600" />
                            <span className="font-semibold text-yellow-800">Smart Tips</span>
                          </div>
                          <ul className="space-y-2">
                            {item.data.tips.map((tip, index) => (
                              <li key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                                <Star className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {/* Products Display */}
                    {item.type === "products" && item.data?.products && (
                      <Card className="border-l-4 border-green-400 bg-green-50">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <ShoppingCart className="h-5 w-5 text-green-600" />
                            <span className="font-semibold text-green-800">Helpful Tools</span>
                          </div>
                          <div className="space-y-3">
                            {item.data.products.map((product, index) => (
                              <div key={index} className="bg-white rounded-lg p-3 border border-green-200">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                      {product.name}
                                    </h4>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {product.description}
                                    </p>
                                    <Badge variant="outline" className="mt-2 text-xs">
                                      {product.category}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                <span className="text-sm text-gray-600">AI is thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t">
        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInput("tips for cleaning my room")}
            className="text-xs"
          >
            <Lightbulb className="h-3 w-3 mr-1" />
            Room cleaning tips
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInput("tools for doing dishes")}
            className="text-xs"
          >
            <ShoppingCart className="h-3 w-3 mr-1" />
            Dish tools
          </Button>
        </div>

        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me about chore tips or tools..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="sm"
            disabled={!input.trim() || isLoading}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>

        <p className="text-xs text-gray-500 mt-2 text-center">
          💡 Try: "tips for [chore name]" or "tools for [task]"
        </p>
      </div>
    </div>
  );
}
