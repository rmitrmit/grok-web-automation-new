import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wand2, Image as ImageIcon, Sparkles } from 'lucide-react';
import { grokReplacementService, type CompleteReplacementResult } from '@/lib/grok-replacement';

interface GrokObjectReplacerProps {
  selectedObject: {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    segmentation?: number[];
    confidence: number;
  } | null;
  imageUrl: string;
  onReplacementComplete: (result: CompleteReplacementResult) => void;
  onClose: () => void;
}

export function GrokObjectReplacer({ 
  selectedObject, 
  imageUrl, 
  onReplacementComplete, 
  onClose 
}: GrokObjectReplacerProps) {
  const [replacementPrompt, setReplacementPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [previewImages, setPreviewImages] = useState<{
    cropped?: string;
    generated?: string;
    final?: string;
  }>({});
  const [revisedPrompt, setRevisedPrompt] = useState<string>('');

  if (!selectedObject) {
    return null;
  }

  const handleReplace = async () => {
    if (!replacementPrompt.trim() || !selectedObject.segmentation) {
      return;
    }

    setIsProcessing(true);
    setCurrentStep('Starting replacement...');
    setPreviewImages({});
    setRevisedPrompt('');

    try {
      // Use step-by-step workflow for better user experience
      const result = await grokReplacementService.replaceObjectStepByStep(
        imageUrl,
        selectedObject.segmentation,
        replacementPrompt,
        (step, data) => {
          switch (step) {
            case 'cropping':
              setCurrentStep('Extracting object from image...');
              break;
            case 'cropped':
              setCurrentStep('Object extracted! Generating replacement...');
              setPreviewImages(prev => ({ ...prev, cropped: data.croppedImage }));
              break;
            case 'generating':
              setCurrentStep('Creating new object with Grok AI...');
              break;
            case 'generated':
              setCurrentStep('New object created! Finalizing...');
              setPreviewImages(prev => ({ 
                ...prev, 
                generated: data.generatedImage 
              }));
              if (data.revisedPrompt) {
                setRevisedPrompt(data.revisedPrompt);
              }
              break;
            case 'placing':
              setCurrentStep('Placing new object in image...');
              break;
          }
        }
      );

      if (result.success) {
        setCurrentStep('Replacement completed successfully!');
        onReplacementComplete(result);
      } else {
        setCurrentStep(`Error: ${result.error}`);
      }

    } catch (error) {
      console.error('Replacement error:', error);
      setCurrentStep(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getSuggestionPrompts = () => {
    const objectName = selectedObject.name.toLowerCase();
    const suggestions = {
      chair: ['modern ergonomic office chair', 'vintage leather armchair', 'minimalist wooden chair'],
      table: ['glass dining table', 'rustic wooden coffee table', 'modern marble table'],
      lamp: ['industrial floor lamp', 'modern LED pendant light', 'vintage brass table lamp'],
      couch: ['modern sectional sofa', 'vintage leather couch', 'minimalist fabric sofa'],
      default: ['modern style', 'vintage design', 'minimalist approach']
    };
    
    return suggestions[objectName] || suggestions.default;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Replace {selectedObject.name} with Grok AI
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Current object info */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              Selected: <strong>{selectedObject.name}</strong> (confidence: {(selectedObject.confidence * 100).toFixed(1)}%)
            </p>
            <p className="text-xs text-gray-500">
              Position: {selectedObject.x.toFixed(0)}, {selectedObject.y.toFixed(0)} • 
              Size: {selectedObject.width.toFixed(0)} × {selectedObject.height.toFixed(0)}
            </p>
          </div>

          {/* Prompt input */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Describe what you want to replace it with:
            </label>
            <Input
              value={replacementPrompt}
              onChange={(e) => setReplacementPrompt(e.target.value)}
              placeholder={`e.g., a modern leather chair, a glass table, etc.`}
              disabled={isProcessing}
              className="w-full"
            />
            
            {/* Suggestion buttons */}
            <div className="flex flex-wrap gap-2">
              {getSuggestionPrompts().map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setReplacementPrompt(suggestion)}
                  disabled={isProcessing}
                  className="text-xs"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>

          {/* Processing status */}
          {isProcessing && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-medium">Processing...</span>
              </div>
              <p className="text-sm text-gray-600">{currentStep}</p>
            </div>
          )}

          {/* Preview images */}
          {(previewImages.cropped || previewImages.generated) && (
            <div className="space-y-3">
              <h4 className="font-medium">Preview</h4>
              <div className="grid grid-cols-2 gap-4">
                {previewImages.cropped && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 text-center">Original Object</p>
                    <div className="border rounded-lg p-2 bg-gray-50">
                      <img
                        src={`data:image/png;base64,${previewImages.cropped}`}
                        alt="Cropped object"
                        className="w-full h-24 object-contain"
                      />
                    </div>
                  </div>
                )}
                {previewImages.generated && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 text-center">Generated Replacement</p>
                    <div className="border rounded-lg p-2 bg-gray-50">
                      <img
                        src={`data:image/jpg;base64,${previewImages.generated}`}
                        alt="Generated replacement"
                        className="w-full h-24 object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Revised prompt */}
          {revisedPrompt && (
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Grok enhanced your prompt:</strong>
              </p>
              <p className="text-xs text-green-600 mt-1">
                "{revisedPrompt}"
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleReplace}
              disabled={!replacementPrompt.trim() || isProcessing || !selectedObject.segmentation}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Replace with Grok AI
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Be specific about materials, colors, and style</p>
            <p>• Grok AI will enhance your prompt for better results</p>
            <p>• The new object will be placed exactly where the old one was</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}