import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CreditCard, CheckCircle, DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { stripePromise } from "@/lib/stripe";

function CheckoutForm({ amount, choreTitle, kidName, onSuccess }: {
  amount: string;
  choreTitle: string;
  kidName: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: `$${amount} sent to ${kidName}!`,
      });
      onSuccess();
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">Payment Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Chore:</span>
              <span className="font-medium">{choreTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Paying:</span>
              <span className="font-medium">{kidName}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span className="earn-green">${amount}</span>
            </div>
          </div>
        </div>

        <PaymentElement />
      </div>

      <Button 
        type="submit" 
        className="w-full bg-earn-green hover:bg-green-600"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? "Processing..." : `Pay $${amount}`}
      </Button>
    </form>
  );
}

export default function Payment() {
  const { choreId } = useParams();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch chore details if choreId provided
  const { data: chore } = useQuery({
    queryKey: [`/api/chores/${choreId}`],
    enabled: !!choreId,
  });

  // Fetch family members to get kid details
  const { data: familyMembers = [] } = useQuery({
    queryKey: ["/api/users/family"],
    enabled: !!user,
  });

  useEffect(() => {
    if (chore && user?.role === "parent") {
      createPaymentIntent();
    } else if (!choreId) {
      setIsLoading(false);
    }
  }, [chore, user]);

  const createPaymentIntent = async () => {
    try {
      const response = await apiRequest("POST", "/api/create-payment-intent", {
        amount: chore.price,
        choreId: chore.id,
        toUserId: chore.kidId,
      });
      
      const data = await response.json();
      setClientSecret(data.clientSecret);
    } catch (error: any) {
      toast({
        title: "Payment Setup Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    navigate("/");
  };

  const handleBack = () => {
    navigate("/");
  };

  if (user?.role !== "parent") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 text-4xl mb-4">
              <CreditCard />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">Only parents can access the payment page.</p>
            <Button onClick={handleBack}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up payment...</p>
        </div>
      </div>
    );
  }

  if (!chore && choreId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Chore Not Found</h2>
            <p className="text-gray-600 mb-4">The chore you're trying to pay for doesn't exist.</p>
            <Button onClick={handleBack}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const kid = familyMembers.find((member: any) => member.id === chore?.kidId);

  if (!clientSecret && choreId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Setup Error</h2>
            <p className="text-gray-600 mb-4">Unable to setup payment. Please try again.</p>
            <Button onClick={handleBack}>Go Back</Button>
          </CardContent>
        </Card>
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
          <h1 className="text-2xl font-bold text-gray-900">Payment Center</h1>
        </div>

        <div className="grid gap-6">
          
          {/* Chore Details */}
          {chore && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Paying for Completed Chore</span>
                </CardTitle>
                <CardDescription>
                  {kid?.username} has completed this chore and is waiting for payment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{chore.title}</h3>
                    <p className="text-gray-600">{chore.description}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Completed {chore.completedAt && new Date(chore.completedAt).toLocaleDateString()}
                    </Badge>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Payment Amount</div>
                      <div className="text-2xl font-bold earn-green">${chore.price}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <span>Complete Payment</span>
              </CardTitle>
              <CardDescription>
                Enter your payment information to send money to {kid?.username}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientSecret && (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CheckoutForm
                    amount={chore.price}
                    choreTitle={chore.title}
                    kidName={kid?.username || "Child"}
                    onSuccess={handlePaymentSuccess}
                  />
                </Elements>
              )}
            </CardContent>
          </Card>

          {/* Security Notice */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <div className="bg-blue-500 rounded-full p-1">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900">Secure Payment</h4>
                  <p className="text-sm text-blue-700">
                    Your payment is processed securely through Stripe. Your card information is never stored on our servers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
