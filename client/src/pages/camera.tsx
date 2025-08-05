import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MobileHeader } from "@/components/mobile-header";
import { BottomNavigation } from "@/components/bottom-navigation";
import { Camera, Upload, Image as ImageIcon, Zap } from "lucide-react";

export default function CameraPage() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const handleCapture = () => {
    // Mock image capture - in real app would use camera API
    setCapturedImage("https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600");
  };

  const handleUpload = () => {
    // Mock file upload - in real app would open file picker
    setCapturedImage("https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader />
      
      <main className="px-4 py-6 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Capture Room</h1>
          <p className="text-gray-600">Take a photo or upload an image to start designing</p>
        </div>

        {!capturedImage ? (
          <div className="space-y-4">
            {/* Camera Preview */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="aspect-video bg-gray-900 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm opacity-75">Camera preview would appear here</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Capture Controls */}
            <div className="flex space-x-4">
              <Button 
                onClick={handleCapture}
                className="flex-1 bg-gradient-to-r from-blue-500 to-violet-500 h-12"
              >
                <Camera className="h-5 w-5 mr-2" />
                Capture Photo
              </Button>
              <Button 
                onClick={handleUpload}
                variant="outline" 
                className="flex-1 h-12"
              >
                <Upload className="h-5 w-5 mr-2" />
                Upload Image
              </Button>
            </div>

            {/* Tips */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Photography Tips</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Ensure good lighting for best results</li>
                  <li>• Capture the entire room or area you want to redesign</li>
                  <li>• Hold the camera steady and level</li>
                  <li>• Include walls, furniture, and architectural details</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Captured Image */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <img 
                  src={capturedImage} 
                  alt="Captured room"
                  className="w-full aspect-video object-cover"
                />
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button className="w-full bg-gradient-to-r from-blue-500 to-violet-500 h-12">
                <Zap className="h-5 w-5 mr-2" />
                Start AI Design
              </Button>
              
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={handleCapture}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Retake
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={handleUpload}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Choose Different
                </Button>
              </div>
            </div>

            {/* Image Info */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Image Analysis</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Room Type:</span>
                    <span className="font-medium">Living Room</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Lighting:</span>
                    <span className="font-medium">Natural</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Style:</span>
                    <span className="font-medium">Modern</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Resolution:</span>
                    <span className="font-medium">1920x1080</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
