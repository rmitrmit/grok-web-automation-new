import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Material, MaterialCategory } from "@shared/schema";

interface MaterialSelectorProps {
  onMaterialSelect?: (material: Material) => void;
  selectedMaterial?: Material | null;
}

export function MaterialSelector({ onMaterialSelect, selectedMaterial }: MaterialSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: categories = [] } = useQuery<MaterialCategory[]>({
    queryKey: ["/api/material-categories"],
  });

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ["/api/materials", selectedCategory, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('categoryId', selectedCategory.toString());
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await fetch(`/api/materials?${params}`);
      return response.json();
    }
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search materials..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>

      {/* Category Tabs */}
      <div className="flex space-x-3 overflow-x-auto scrollbar-hide">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
          className="whitespace-nowrap"
        >
          All
        </Button>
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category.id)}
            className="whitespace-nowrap"
          >
            {category.name}
          </Button>
        ))}
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-2 gap-3">
        {materials.map((material) => (
          <div
            key={material.id}
            className={cn(
              "bg-gray-50 rounded-lg overflow-hidden border transition-colors cursor-pointer",
              selectedMaterial?.id === material.id 
                ? "border-blue-500 bg-blue-50" 
                : "border-gray-200 hover:border-blue-300"
            )}
            onClick={() => onMaterialSelect?.(material)}
          >
            {material.imageUrl && (
              <img 
                src={material.imageUrl} 
                alt={material.name}
                className="w-full h-20 object-cover"
              />
            )}
            <div className="p-3">
              <h4 className="font-medium text-sm text-gray-900">{material.name}</h4>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{material.description}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-green-600 font-medium">
                  ${material.pricePerSqFt}/sq ft
                </span>
                <Button variant="ghost" size="sm" className="p-0 h-auto">
                  <Heart className="h-4 w-4 text-gray-400 hover:text-red-500" />
                </Button>
              </div>
              {material.tags && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {material.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {materials.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No materials found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
