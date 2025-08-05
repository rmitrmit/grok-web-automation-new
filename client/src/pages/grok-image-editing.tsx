import { useState } from "react";
import { Camera, Upload, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { GrokEditor } from "@/components/grok-editor";

export default function GrokImageEditing() {
  const [, setLocation] = useLocation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showGrokEditor, setShowGrokEditor] = useState(false);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setSelectedImage(result);
        setShowGrokEditor(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageReplaced = (newImageUrl: string) => {
    setSelectedImage(newImageUrl);
    setShowGrokEditor(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">Grok Image Editing</h1>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {!selectedImage ? (
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-center">
                Upload Image for Grok Editing
              </h2>
              
              <div className="space-y-4">
                {/* Upload Button */}
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Button className="w-full flex items-center gap-2" size="lg">
                    <Upload className="h-5 w-5" />
                    Choose Image to Edit
                  </Button>
                </div>

                <div className="text-center text-sm text-gray-500">
                  Select a room photo to edit with Grok's AI
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Your Image</h2>
              
              <div className="mb-6">
                <img
                  src={selectedImage}
                  alt="Selected for editing"
                  className="w-full h-64 object-cover rounded-lg"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowGrokEditor(true)}
                  className="flex-1"
                >
                  Edit with Grok
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedImage(null)}
                >
                  Choose Different Image
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Grok Editor Modal */}
        {showGrokEditor && selectedImage && (
          <GrokEditor
            imageUrl={selectedImage}
            onClose={() => setShowGrokEditor(false)}
            onImageReplaced={handleImageReplaced}
          />
        )}
      </div>
    </div>
  );
}