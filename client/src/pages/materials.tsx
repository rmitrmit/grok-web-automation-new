import { MobileHeader } from "@/components/mobile-header";
import { BottomNavigation } from "@/components/bottom-navigation";
import { MaterialSelector } from "@/components/material-selector";

export default function Materials() {
  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader />
      
      <main className="px-4 py-6 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Material Library</h1>
          <p className="text-gray-600">Browse our extensive collection of interior design materials</p>
        </div>

        <MaterialSelector />
      </main>

      <BottomNavigation />
    </div>
  );
}
