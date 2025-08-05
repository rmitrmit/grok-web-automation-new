import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Undo2, Zap, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CircleSelectorProps {
  imageUrl: string;
  onObjectsDetected?: (objects: DetectedObject[]) => void;
}

interface DetectedObject {
  name: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CircleCoordinates {
  x: number;
  y: number;
  radius: number;
}

export function CircleSelector({ imageUrl, onObjectsDetected }: CircleSelectorProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [circle, setCircle] = useState<CircleCoordinates | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // AI Object Recognition mutation
  const recognitionMutation = useMutation({
    mutationFn: async (data: { imageUrl: string; circleCoordinates?: CircleCoordinates }) => {
      return apiRequest("POST", "/api/ai/recognize-objects", data);
    },
    onSuccess: (response) => {
      setDetectedObjects(response.objects);
      onObjectsDetected?.(response.objects);
      
      if (response.objects.length > 0) {
        toast({
          title: "Objects detected",
          description: `Found ${response.objects.length} object(s) in the selected area`
        });
      } else {
        toast({
          title: "No objects found",
          description: "Try selecting a different area or use a clearer image"
        });
      }
    },
    onError: () => {
      toast({
        title: "Recognition failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });

  const getCanvasCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current || !containerRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }, []);

  const drawCircle = useCallback((ctx: CanvasRenderingContext2D, center: { x: number; y: number }, radius: number) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw circle
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw center point
    ctx.setLineDash([]);
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(center.x, center.y, 4, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    setStartPoint(coords);
    setIsDrawing(true);
    setCircle(null);
  }, [getCanvasCoordinates]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !startPoint || !canvasRef.current) return;
    
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    const radius = Math.sqrt(
      Math.pow(coords.x - startPoint.x, 2) + Math.pow(coords.y - startPoint.y, 2)
    );
    
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      drawCircle(ctx, startPoint, radius);
    }
  }, [isDrawing, startPoint, getCanvasCoordinates, drawCircle]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !startPoint) return;
    
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    const radius = Math.sqrt(
      Math.pow(coords.x - startPoint.x, 2) + Math.pow(coords.y - startPoint.y, 2)
    );
    
    if (radius > 10) { // Minimum circle size
      const newCircle = { x: startPoint.x, y: startPoint.y, radius };
      setCircle(newCircle);
      
      // Trigger AI recognition
      recognitionMutation.mutate({
        imageUrl,
        circleCoordinates: newCircle
      });
    }
    
    setIsDrawing(false);
    setStartPoint(null);
  }, [isDrawing, startPoint, getCanvasCoordinates, imageUrl, recognitionMutation]);

  // Touch events for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
    setStartPoint(coords);
    setIsDrawing(true);
    setCircle(null);
  }, [getCanvasCoordinates]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !startPoint || !canvasRef.current) return;
    
    const touch = e.touches[0];
    const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
    const radius = Math.sqrt(
      Math.pow(coords.x - startPoint.x, 2) + Math.pow(coords.y - startPoint.y, 2)
    );
    
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      drawCircle(ctx, startPoint, radius);
    }
  }, [isDrawing, startPoint, getCanvasCoordinates, drawCircle]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !startPoint) return;
    
    const lastTouch = e.changedTouches[0];
    const coords = getCanvasCoordinates(lastTouch.clientX, lastTouch.clientY);
    const radius = Math.sqrt(
      Math.pow(coords.x - startPoint.x, 2) + Math.pow(coords.y - startPoint.y, 2)
    );
    
    if (radius > 10) {
      const newCircle = { x: startPoint.x, y: startPoint.y, radius };
      setCircle(newCircle);
      
      recognitionMutation.mutate({
        imageUrl,
        circleCoordinates: newCircle
      });
    }
    
    setIsDrawing(false);
    setStartPoint(null);
  }, [isDrawing, startPoint, getCanvasCoordinates, imageUrl, recognitionMutation]);

  const clearSelection = () => {
    setCircle(null);
    setDetectedObjects([]);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
    }
  };

  const analyzeFullImage = () => {
    recognitionMutation.mutate({ imageUrl });
  };

  useEffect(() => {
    if (imageRef.current && canvasRef.current) {
      const img = imageRef.current;
      const canvas = canvasRef.current;
      
      const updateCanvasSize = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      };
      
      if (img.complete) {
        updateCanvasSize();
      } else {
        img.onload = updateCanvasSize;
      }
    }
  }, [imageUrl]);

  const getObjectCategoryColor = (objectName: string): string => {
    const colors: Record<string, string> = {
      chair: '#3b82f6',
      table: '#10b981',
      wall: '#ef4444',
      floor: '#f59e0b',
      lamp: '#8b5cf6',
      sofa: '#06b6d4',
      bed: '#ec4899',
      window: '#84cc16',
      door: '#f97316'
    };
    return colors[objectName.toLowerCase()] || '#6b7280';
  };

  return (
    <div className="space-y-4">
      {/* Image with Canvas Overlay */}
      <div 
        ref={containerRef}
        className="relative bg-gray-100 rounded-xl overflow-hidden cursor-crosshair"
        style={{ aspectRatio: "16/12" }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Room to analyze"
          className="w-full h-full object-cover"
          draggable={false}
        />
        
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-auto"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Object Highlight Overlays */}
        {detectedObjects && detectedObjects.map((obj, index) => (
          <div
            key={index}
            className="absolute border-2 rounded transition-all"
            style={{
              borderColor: getObjectCategoryColor(obj.name),
              backgroundColor: `${getObjectCategoryColor(obj.name)}20`,
              left: `${(obj.x / (imageRef.current?.naturalWidth || 1)) * 100}%`,
              top: `${(obj.y / (imageRef.current?.naturalHeight || 1)) * 100}%`,
              width: `${(obj.width / (imageRef.current?.naturalWidth || 1)) * 100}%`,
              height: `${(obj.height / (imageRef.current?.naturalHeight || 1)) * 100}%`,
            }}
          >
            <Badge 
              className="absolute -top-6 left-0 text-xs"
              style={{ backgroundColor: getObjectCategoryColor(obj.name) }}
            >
              {obj.name} ({Math.round(obj.confidence * 100)}%)
            </Badge>
          </div>
        ))}

        {recognitionMutation.isPending && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <Card>
              <CardContent className="p-4 flex items-center space-x-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="text-sm font-medium">Analyzing objects...</span>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Instructions and Controls */}
      <div className="space-y-3">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">
            Drag to draw a circle around objects you want to identify
          </p>
          <div className="flex justify-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              disabled={!circle && detectedObjects.length === 0}
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button
              onClick={analyzeFullImage}
              disabled={recognitionMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-violet-500"
            >
              <Zap className="h-4 w-4 mr-2" />
              Analyze Full Image
            </Button>
          </div>
        </div>

        {/* Detected Objects List */}
        {detectedObjects.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3">Detected Objects</h3>
              <div className="grid grid-cols-2 gap-2">
                {detectedObjects.map((obj, index) => (
                  <div 
                    key={index} 
                    className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg"
                  >
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getObjectCategoryColor(obj.name) }}
                    />
                    <span className="text-sm font-medium capitalize">{obj.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {Math.round(obj.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}