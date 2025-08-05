import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileHeader } from "@/components/mobile-header";
import { BottomNavigation } from "@/components/bottom-navigation";
import { Plus, Eye, Edit3, Share2, Calendar } from "lucide-react";
import type { Project } from "@shared/schema";

export default function Projects() {
  // Mock user ID for now
  const userId = 1;

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects", userId],
    queryFn: async () => {
      const response = await fetch(`/api/projects?userId=${userId}`);
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader />
        <main className="px-4 py-6 pb-20">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-200 rounded-xl h-32 animate-pulse" />
            ))}
          </div>
        </main>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader />
      
      <main className="px-4 py-6 pb-20">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <Button className="bg-gradient-to-r from-blue-500 to-violet-500">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Yet</h3>
            <p className="text-gray-600 mb-6">Start your first interior design project with AI assistance.</p>
            <Button className="bg-gradient-to-r from-blue-500 to-violet-500">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Project
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <Card key={project.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Project Thumbnail */}
                    <div className="w-24 h-24 bg-gray-200 flex-shrink-0">
                      {project.currentImageUrl ? (
                        <img 
                          src={project.currentImageUrl} 
                          alt={project.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                          <Eye className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    {/* Project Info */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{project.name}</h3>
                        <Button variant="ghost" size="sm" className="p-0 h-auto">
                          <Share2 className="h-4 w-4 text-gray-400" />
                        </Button>
                      </div>
                      
                      {project.description && (
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{project.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-2 mb-2">
                        {project.roomType && (
                          <Badge variant="secondary" className="text-xs">
                            {project.roomType.replace('_', ' ')}
                          </Badge>
                        )}
                        {project.style && (
                          <Badge variant="outline" className="text-xs">
                            {project.style}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-xs text-gray-500">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" className="text-xs">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button variant="default" size="sm" className="text-xs">
                            <Edit3 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
