import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Plus, Calendar, PiggyBank, Star, Clock, MessageCircle, CheckCircle, Trophy } from "lucide-react";
import ChoreCard from "./chore-card";
import Leaderboard from "./leaderboard";
import { User } from "@shared/schema";

interface KidInterfaceProps {
  user: User;
}

export default function KidInterface({ user }: KidInterfaceProps) {
  const [, navigate] = useLocation();

  const { data: chores = [], isLoading } = useQuery({
    queryKey: [`/api/chores/kid/${user.id}`],
  });

  const { data: familyMembers = [] } = useQuery({
    queryKey: ["/api/users/family"],
  });

  const pendingChores = chores.filter((chore: any) => chore.status === "pending" || chore.status === "approved");
  const negotiatingChores = chores.filter((chore: any) => chore.status === "negotiating");
  const completedChores = chores.filter((chore: any) => 
    chore.status === "completed" || chore.status === "approved_payment" || chore.status === "paid"
  );

  const progressToNextLevel = Math.min((user.choreCount % 10) / 10 * 100, 100);
  const nextLevelChores = 10 - (user.choreCount % 10);

  if (isLoading) {
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
      
      {/* Kid Dashboard Header */}
      <div className="bg-white rounded-2xl shadow-xl p-6 kid-gradient text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Hey {user.username}! 👋</h1>
            <p className="text-lg opacity-90">
              You've earned <span className="font-bold text-yellow-300">${user.totalEarned}</span> this month!
            </p>
          </div>
          <div className="text-right">
            <div className="bg-white/20 rounded-full p-4 mb-2">
              <Star className="text-yellow-300 h-8 w-8" />
            </div>
            <p className="text-sm opacity-90">Level {user.level}</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Progress to Level {user.level + 1}</span>
            <span>{user.choreCount % 10}/10 chores</span>
          </div>
          <Progress value={progressToNextLevel} className="h-3 bg-white/20">
            <div className="h-full bg-yellow-300 rounded-full transition-all duration-500" 
                 style={{ width: `${progressToNextLevel}%` }} />
          </Progress>
          <p className="text-xs opacity-80 mt-1">
            {nextLevelChores} more chores to level up!
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Create New Chore */}
        <Card 
          className="hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-kid-pink"
          onClick={() => navigate("/chore/new")}
        >
          <CardContent className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-kid-pink rounded-full p-3 mr-4">
                <Plus className="text-white h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Create Chore</h3>
            </div>
            <p className="text-gray-600">Add a new chore and set your price!</p>
          </CardContent>
        </Card>

        {/* View Calendar */}
        <Card className="hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-kid-purple">
          <CardContent className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-kid-purple rounded-full p-3 mr-4">
                <Calendar className="text-white h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">My Calendar</h3>
            </div>
            <p className="text-gray-600">See your scheduled chores</p>
          </CardContent>
        </Card>

        {/* Check Bank */}
        <Card className="hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-kid-cyan">
          <CardContent className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-kid-cyan rounded-full p-3 mr-4">
                <PiggyBank className="text-white h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">My Bank</h3>
            </div>
            <p className="text-gray-600">Balance: <span className="font-bold earn-green">${user.balance}</span></p>
          </CardContent>
        </Card>
      </div>

      {/* My Chores */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">My Chores</h2>
            <div className="flex space-x-2">
              <Badge variant="default" className="bg-earn-blue">
                All ({chores.length})
              </Badge>
              <Badge variant="secondary">
                Pending ({pendingChores.length})
              </Badge>
              <Badge variant="secondary">
                Completed ({completedChores.length})
              </Badge>
            </div>
          </div>

          {chores.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Plus className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No chores yet!</h3>
              <p className="text-gray-500 mb-4">Create your first chore to start earning money.</p>
              <Button onClick={() => navigate("/chore/new")} className="kid-gradient">
                Create Your First Chore
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chores.map((chore: any) => (
                <ChoreCard key={chore.id} chore={chore} userRole={user.role} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Family Leaderboard */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <Trophy className="text-yellow-500 mr-3 h-6 w-6" />
            Family Leaderboard
          </h2>
          <Leaderboard familyMembers={familyMembers} currentUserId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}
