import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GrokEditorProps {
  imageUrl: string;
  onClose: () => void;
  onImageReplaced: (newImageUrl: string) => void;
}

export function GrokEditor({ imageUrl, onClose, onImageReplaced }: GrokEditorProps) {
  const [grokPrompt, setGrokPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGrokEdit = async () => {
    if (!grokPrompt.trim()) {
      toast({
        title: "Please enter a prompt",
        description: "Describe what you want to change in the image",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setCurrentStep("Uploading image to Grok...");

    try {
      // Use smart Grok editing with automatic fallback
      const response = await fetch('/api/grok/smart-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: grokPrompt
        })
      });

      const result = await response.json();

      if (result.success && result.editedImageUrl) {
        setCurrentStep("Smart editing completed!");
        setEditedImageUrl(result.editedImageUrl);
        
        // Replace the entire original image with Grok's output
        onImageReplaced(result.editedImageUrl);
        
        toast({
          title: "Image Edited Successfully!",
          description: `AI has applied your changes: "${grokPrompt}"`,
        });
        onClose();
      } else {
        throw new Error(result.error || "Grok editing failed");
      }

    } catch (error) {
      console.error('Grok editing error:', error);
      setCurrentStep(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      toast({
        title: "Grok Editing Failed", 
        description: error instanceof Error ? error.message : "Failed to edit image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isProcessing) {
      handleGrokEdit();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Edit with Grok AI
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            disabled={isProcessing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-blue-700 font-medium">{currentStep}</span>
            </div>
          </div>
        )}

        {/* Grok Prompt Input */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Describe what you want to change:
            </label>
            <Input
              value={grokPrompt}
              onChange={(e) => setGrokPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., change the chair to red, make the room brighter, add plants"
              disabled={isProcessing}
              className="w-full"
            />
          </div>

          {/* Send Button */}
          <Button
            onClick={handleGrokEdit}
            disabled={!grokPrompt.trim() || isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send to Grok
              </>
            )}
          </Button>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Smart editing: Tries Grok web automation first, falls back to API generation.
          Deploy to production for full web automation capabilities.
          {editedImageUrl && <div className="mt-2 text-green-600">✅ Editing completed successfully</div>}
        </div>
      </div>
    </div>
  );
}