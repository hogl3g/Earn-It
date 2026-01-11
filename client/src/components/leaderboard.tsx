import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Medal, Award, Star, TrendingUp } from "lucide-react";
import { User } from "@shared/schema";

interface LeaderboardProps {
  familyMembers: User[];
  currentUserId: number;
}

export default function Leaderboard({ familyMembers, currentUserId }: LeaderboardProps) {
  // Filter to only kids and sort by total earned
  const kids = familyMembers
    .filter((member) => member.role === "kid")
    .sort((a, b) => parseFloat(b.totalEarned) - parseFloat(a.totalEarned));

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <Star className="h-6 w-6 text-gray-300" />;
    }
  };

  const getPositionColor = (position: number) => {
    switch (position) {
      case 1:
        return "from-yellow-100 to-yellow-50 border-yellow-200";
      case 2:
        return "from-gray-100 to-gray-50 border-gray-200";
      case 3:
        return "from-amber-100 to-amber-50 border-amber-200";
      default:
        return "from-gray-50 to-white border-gray-100";
    }
  };

  const getRankBadge = (position: number) => {
    switch (position) {
      case 1:
        return "bg-yellow-500 text-white";
      case 2:
        return "bg-gray-400 text-white";
      case 3:
        return "bg-amber-600 text-white";
      default:
        return "bg-gray-300 text-gray-700";
    }
  };

  if (kids.length === 0) {
    return (
      <div className="text-center py-8">
        <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No family members to display</p>
      </div>
    );
  }

  // Calculate max earnings for progress bars
  const maxEarnings = Math.max(...kids.map(kid => parseFloat(kid.totalEarned)));

  return (
    <div className="space-y-4">
      {kids.map((kid, index) => {
        const position = index + 1;
        const isCurrentUser = kid.id === currentUserId;
        const earningsPercent = maxEarnings > 0 ? (parseFloat(kid.totalEarned) / maxEarnings) * 100 : 0;
        
        return (
          <Card 
            key={kid.id} 
            className={`border-2 transition-all duration-200 ${
              isCurrentUser 
                ? "ring-2 ring-earn-blue ring-opacity-50 shadow-lg" 
                : "hover:shadow-md"
            } bg-gradient-to-r ${getPositionColor(position)}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                {/* Left side - Position and user info */}
                <div className="flex items-center space-x-4">
                  {/* Position badge */}
                  <div className={`rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg ${getRankBadge(position)}`}>
                    {position}
                  </div>

                  {/* User info */}
                  <div className="flex items-center space-x-3">
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-kid-pink rounded-full flex items-center justify-center relative">
                      <span className="text-white font-bold text-lg">
                        {kid.username[0].toUpperCase()}
                      </span>
                      {isCurrentUser && (
                        <div className="absolute -top-1 -right-1 bg-earn-blue rounded-full p-1">
                          <Star className="h-3 w-3 text-white fill-current" />
                        </div>
                      )}
                    </div>

                    {/* Name and stats */}
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-gray-800 text-lg">
                          {kid.username}
                          {isCurrentUser && (
                            <span className="text-earn-blue ml-2">(You!)</span>
                          )}
                        </h4>
                        {position <= 3 && getPositionIcon(position)}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>{kid.choreCount} chores completed</span>
                        <Badge variant="outline" className="text-xs">
                          Level {kid.level}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side - Earnings and progress */}
                <div className="text-right min-w-[120px]">
                  <div className="text-2xl font-bold earn-green mb-1">
                    ${kid.totalEarned}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">Total Earned</div>
                  
                  {/* Progress bar */}
                  <div className="w-24 ml-auto">
                    <Progress 
                      value={earningsPercent} 
                      className="h-2"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      {Math.round(earningsPercent)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Achievement indicators */}
              {(position === 1 || kid.choreCount >= 10 || parseFloat(kid.totalEarned) >= 50) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-600">
                      {position === 1 && "🏆 Top Earner"}
                      {kid.choreCount >= 10 && position !== 1 && "⭐ Hard Worker"}
                      {parseFloat(kid.totalEarned) >= 50 && position !== 1 && kid.choreCount < 10 && "💰 Big Earner"}
                    </span>
                  </div>
                </div>
              )}

              {/* Special highlight for current user in first place */}
              {isCurrentUser && position === 1 && (
                <div className="mt-3 pt-3 border-t border-yellow-200">
                  <div className="flex items-center justify-center space-x-2 text-yellow-700">
                    <Trophy className="h-5 w-5" />
                    <span className="font-semibold text-sm">
                      🎉 You're #1! Keep up the amazing work!
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Leaderboard footer with family stats */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4 text-center">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-bold text-lg text-earn-blue">
                ${kids.reduce((sum, kid) => sum + parseFloat(kid.totalEarned), 0).toFixed(2)}
              </div>
              <div className="text-gray-600">Family Total</div>
            </div>
            <div>
              <div className="font-bold text-lg text-earn-blue">
                {kids.reduce((sum, kid) => sum + kid.choreCount, 0)}
              </div>
              <div className="text-gray-600">Total Chores</div>
            </div>
            <div>
              <div className="font-bold text-lg text-earn-blue">
                {Math.round(kids.reduce((sum, kid) => sum + kid.level, 0) / kids.length) || 0}
              </div>
              <div className="text-gray-600">Avg Level</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
