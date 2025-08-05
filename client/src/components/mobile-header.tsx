import { Menu, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileHeader() {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm">
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">
            Object Recognition
          </h1>
        </div>
        
        <Button variant="ghost" size="sm">
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}