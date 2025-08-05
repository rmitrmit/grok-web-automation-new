import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Heart, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Transformation } from "@shared/schema";

interface TransformationGalleryProps {
  userId?: number;
  projectId?: number;
}

export function TransformationGallery({ userId, projectId }: TransformationGalleryProps) {
  const { data: transformations = [], isLoading } = useQuery<Transformation[]>({
    queryKey: ["/api/transformations", projectId, userId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId.toString());
      if (userId) params.append('userId', userId.toString());
      
      const response = await fetch(`/api/transformations?${params}`);
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-gray-100 rounded-xl h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  if (transformations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No transformations yet. Create your first design!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transformations.map((transformation) => (
        <div key={transformation.id} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-900 line-clamp-1">
                {transformation.description}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(transformation.createdAt).toLocaleDateString()}
              </span>
            </div>
            
            {/* Before/After Images */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Badge className="absolute top-2 left-2 bg-red-500 text-white text-xs">
                  Before
                </Badge>
                <img 
                  src={transformation.beforeImageUrl} 
                  alt="Before transformation"
                  className="w-full h-24 object-cover rounded-lg"
                />
              </div>
              <div className="relative">
                <Badge className="absolute top-2 left-2 bg-green-500 text-white text-xs">
                  After
                </Badge>
                <img 
                  src={transformation.afterImageUrl} 
                  alt="After transformation"
                  className="w-full h-24 object-cover rounded-lg"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" className="p-0 h-auto">
                  <Heart className="h-4 w-4 text-gray-600 mr-1" />
                  <span className="text-xs">{transformation.likes}</span>
                </Button>
                <Button variant="ghost" size="sm" className="p-0 h-auto">
                  <Share2 className="h-4 w-4 text-gray-600 mr-1" />
                  <span className="text-xs">Share</span>
                </Button>
              </div>
              <Button variant="outline" size="sm" className="text-xs">
                Use This Style
              </Button>
            </div>

            {transformation.aiModel && (
              <div className="mt-2 text-xs text-gray-500">
                AI Model: {transformation.aiModel}
                {transformation.processingTime && (
                  <span className="ml-2">• {transformation.processingTime}ms</span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
