import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Zap, Upload } from "lucide-react";
import { MobileHeader } from "@/components/mobile-header";
import { BottomNavigation } from "@/components/bottom-navigation";
import { ImageUpload } from "@/components/image-upload";
import { PenSelector } from "@/components/pen-selector";

interface DetectedObject {
  name: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function Home() {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);

  const handleImageUpload = (imageUrl: string) => {
    setCurrentImage(imageUrl);
    setDetectedObjects([]);
  };

  const handleObjectsDetected = (objects: DetectedObject[]) => {
    setDetectedObjects(objects);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader />
      
      <main className="pb-20 px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">
            Draw to Identify Objects
          </h1>
          <p className="text-gray-600">
            Upload a room image and draw around objects for AI identification
          </p>
        </div>

        {/* Upload or Canvas */}
        {!currentImage ? (
          <ImageUpload onImageUploaded={handleImageUpload} />
        ) : (
          <div className="space-y-4">
            <PenSelector 
              imageUrl={currentImage}
              onObjectsDetected={handleObjectsDetected}
            />
            
            {/* Start Over Button */}
            <div className="text-center">
              <button
                onClick={() => setCurrentImage(null)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                ← Upload different image
              </button>
            </div>
          </div>
        )}

        {/* Quick Access to Grok Image Editing */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-blue-600" />
              <span>Grok Image Editing</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-3">
              Upload an image and edit it directly with Grok's AI technology
            </p>
            <a 
              href="/grok-image-editing"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="h-4 w-4 mr-2" />
              Try Grok Editing
            </a>
          </CardContent>
        </Card>

        {/* How it Works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lightbulb className="h-5 w-5 text-blue-500" />
              <span>How it Works</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Upload Image</h4>
                <p className="text-sm text-gray-600">
                  Take or upload a photo of any room
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Draw Around Objects</h4>
                <p className="text-sm text-gray-600">
                  Use your finger or mouse to draw around objects
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Get Refined Results</h4>
                <p className="text-sm text-gray-600">
                  AI identifies objects and refines the edges automatically
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center space-x-3">
              <Zap className="h-8 w-8 text-blue-500" />
              <div>
                <h3 className="font-semibold text-gray-900">Smart Recognition</h3>
                <p className="text-sm text-gray-600">
                  Identifies furniture, walls, floors, and decor items
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center space-x-3">
              <Upload className="h-8 w-8 text-green-500" />
              <div>
                <h3 className="font-semibold text-gray-900">Easy Upload</h3>
                <p className="text-sm text-gray-600">
                  Drag & drop or take photos directly from camera
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}