import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MobileHeader } from "@/components/mobile-header";
import { BottomNavigation } from "@/components/bottom-navigation";
import { 
  User, 
  Settings, 
  Heart, 
  History, 
  Download, 
  Bell, 
  CreditCard, 
  HelpCircle,
  Star,
  Palette,
  Image,
  Zap
} from "lucide-react";

export default function Profile() {
  const user = {
    name: "Alex Designer",
    email: "alex@example.com",
    memberSince: "January 2024",
    subscription: "Pro Plan"
  };

  const stats = [
    { label: "Projects", value: "12", icon: Image },
    { label: "Transformations", value: "45", icon: Zap },
    { label: "Materials Used", value: "23", icon: Palette },
    { label: "Favorites", value: "18", icon: Heart }
  ];

  const menuItems = [
    { icon: Settings, label: "Account Settings", description: "Manage your account preferences" },
    { icon: Heart, label: "Favorites", description: "Your saved materials and designs" },
    { icon: History, label: "Design History", description: "View all your past projects" },
    { icon: Download, label: "Downloads", description: "Access your exported designs" },
    { icon: Bell, label: "Notifications", description: "Manage notification preferences" },
    { icon: CreditCard, label: "Subscription", description: "Manage your Pro subscription" },
    { icon: HelpCircle, label: "Help & Support", description: "Get help with the app" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader />
      
      <main className="px-4 py-6 pb-20">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
                <p className="text-gray-600">{user.email}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge className="bg-gradient-to-r from-blue-500 to-violet-500 text-white">
                    <Star className="h-3 w-3 mr-1" />
                    {user.subscription}
                  </Badge>
                  <span className="text-xs text-gray-500">Member since {user.memberSince}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Your Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <stat.icon className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <Card>
          <CardContent className="p-0">
            {menuItems.map((item, index) => (
              <div key={item.label}>
                <Button 
                  variant="ghost" 
                  className="w-full h-auto p-4 justify-start space-x-4"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900">{item.label}</div>
                    <div className="text-sm text-gray-500">{item.description}</div>
                  </div>
                </Button>
                {index < menuItems.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sign Out */}
        <div className="mt-6">
          <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50">
            Sign Out
          </Button>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}
