import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Undo2, Zap, Loader2, Pen, Bot, Check, Wand2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { yolo11RealDetector } from "@/lib/yolo11-real";
import { yolo11APIDetector, wallsFloorsYOLODetector } from "@/lib/yolo11-api";
import { ObjectModifier } from "./object-modifier";
import { GrokEditor } from "./grok-editor";
import { GrokObjectReplacer } from "./grok-object-replacer";

interface PenSelectorProps {
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
  refinedPath?: string; // SVG path for precise object outline
  segmentation?: number[]; // Segmentation coordinates for Grok replacement
  source?: string; // Detection source ('YOLO11' or 'Google Vision')
  canSegment?: boolean; // Whether object supports pixel-perfect segmentation
}

interface DrawingPath {
  points: { x: number; y: number }[];
  isComplete: boolean;
}

export function PenSelector({ imageUrl, onObjectsDetected }: PenSelectorProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawingPath>({ points: [], isComplete: false });
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [showRefinedOutlines, setShowRefinedOutlines] = useState(false);
  const [useAdvancedDetection, setUseAdvancedDetection] = useState(true);
  const [useAPIDetection, setUseAPIDetection] = useState(true); // Always use API for best results
  const [yoloModelLoaded, setYoloModelLoaded] = useState(false);
  const [selectedObjectForModification, setSelectedObjectForModification] = useState<DetectedObject | null>(null);
  const [selectedObjectForGrokReplacement, setSelectedObjectForGrokReplacement] = useState<DetectedObject | null>(null);
  const [showGrokEditor, setShowGrokEditor] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string>(imageUrl);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load YOLO11 model on component mount
  useEffect(() => {
    if (useAdvancedDetection) {
      yolo11RealDetector.loadModel()
        .then(() => {
          setYoloModelLoaded(true);
          toast({
            title: "High-Accuracy Detection Ready",
            description: "YOLO11 Segmentation model loaded for precise object detection.",
          });
        })
        .catch((error) => {
          console.warn('YOLO11 failed to load, will use Google Vision API:', error);
          setUseAdvancedDetection(false);
        });
    }
  }, [useAdvancedDetection, toast]);

  // Helper function to check if two objects overlap significantly
  const objectsOverlap = (obj1: DetectedObject, obj2: DetectedObject, threshold: number): boolean => {
    const obj1Right = obj1.x + obj1.width;
    const obj1Bottom = obj1.y + obj1.height;
    const obj2Right = obj2.x + obj2.width;
    const obj2Bottom = obj2.y + obj2.height;
    
    const overlapX = Math.max(0, Math.min(obj1Right, obj2Right) - Math.max(obj1.x, obj2.x));
    const overlapY = Math.max(0, Math.min(obj1Bottom, obj2Bottom) - Math.max(obj1.y, obj2.y));
    const overlapArea = overlapX * overlapY;
    
    const obj1Area = obj1.width * obj1.height;
    const obj2Area = obj2.width * obj2.height;
    const unionArea = obj1Area + obj2Area - overlapArea;
    
    return (overlapArea / unionArea) > threshold;
  };

  // Advanced YOLO11 detection function
  const runYOLO11Detection = async (drawingPath?: { x: number; y: number }[]) => {
    if (!imageRef.current) {
      throw new Error('Image not ready');
    }

    let objects;
    let method;

    if (useAPIDetection) {
      // Use backend API
      objects = await yolo11APIDetector.detectObjects(imageRef.current, drawingPath);
      method = 'YOLO11 API (Backend)';
    } else {
      // Use client-side detection
      objects = await yolo11RealDetector.detectObjects(imageRef.current, drawingPath);
      method = 'YOLO11 Client-side';
    }

    return {
      success: true,
      objects: objects,
      detectionMethod: method
    };
  };

  // Hybrid AI Detection: Combines YOLO11 and Google Vision for best results
  const recognitionMutation = useMutation({
    mutationFn: async (data: { imageUrl: string; drawingPath: { x: number; y: number }[] }) => {
      let yoloObjects = [];
      let googleObjects = [];
      
      // Step 1: Try YOLO11 detection first
      if (useAdvancedDetection) {
        try {
          console.log('Running YOLO11 detection...');
          const yoloResult = await runYOLO11Detection(data.drawingPath);
          yoloObjects = yoloResult.objects || [];
          console.log(`YOLO11 found ${yoloObjects.length} objects`);
        } catch (yoloError) {
          console.warn('YOLO11 detection failed:', yoloError);
        }
      }

      // Step 2: Run Google Vision API for comparison
      try {
        console.log('Running Google Vision detection...');
        const response = await apiRequest("POST", "/api/ai/recognize-and-refine", data);
        const googleResult = await response.json();
        googleObjects = googleResult.objects || [];
        console.log(`Google Vision found ${googleObjects.length} objects`);
      } catch (googleError) {
        console.warn('Google Vision detection failed:', googleError);
      }

      // Step 3: Intelligent hybrid detection with segmentation priority
      const hybridObjects = [];
      const CONFIDENCE_THRESHOLD = 0.35; // Lowered threshold for more YOLO coverage
      
      // Import YOLO capabilities for checking segmentation support
      const { yolo11APIDetector } = await import('@/lib/yolo11-api');
      
      // Add high-confidence YOLO objects first (they take priority for segmentation)
      const highConfidenceYolo = yoloObjects.filter(obj => obj.confidence >= CONFIDENCE_THRESHOLD);
      hybridObjects.push(...highConfidenceYolo.map(obj => ({ 
        ...obj, 
        source: 'YOLO11',
        canSegment: true // YOLO objects always support segmentation
      })));
      console.log(`Added ${highConfidenceYolo.length} high-confidence YOLO objects`);
      
      // Process Google objects strategically
      for (const googleObj of googleObjects) {
        const hasOverlapWithYolo = yoloObjects.some(yoloObj => 
          objectsOverlap(googleObj, yoloObj, 0.3) || // Spatial overlap
          (googleObj.name.toLowerCase() === yoloObj.name.toLowerCase() && // Same object type
           objectsOverlap(googleObj, yoloObj, 0.1)) // Even minimal overlap for same type
        );
        
        if (!hasOverlapWithYolo) {
          // Check if this object type can be segmented by YOLO
          const canSegment = yolo11APIDetector.canSegment(googleObj.name);
          const yoloMappedClass = yolo11APIDetector.mapToYOLOClass(googleObj.name);
          
          hybridObjects.push({
            ...googleObj,
            confidence: googleObj.confidence || 0.6,
            source: 'Google Vision',
            canSegment: canSegment,
            yoloEquivalent: yoloMappedClass,
            segmentationNote: canSegment 
              ? `Can be re-detected with YOLO as '${yoloMappedClass}' for segmentation`
              : 'No YOLO equivalent - bounding box only'
          });
          
          if (canSegment && yoloMappedClass) {
            console.log(`Google ${googleObj.name} → YOLO ${yoloMappedClass} (segmentation possible)`);
          } else {
            console.log(`Google ${googleObj.name} → No YOLO equivalent (bounding box only)`);
          }
        } else {
          console.log(`Skipped Google ${googleObj.name} - conflicts with YOLO detection`);
        }
      }
      
      console.log(`Final hybrid result: ${hybridObjects.length} objects (${highConfidenceYolo.length} from YOLO, ${hybridObjects.length - highConfidenceYolo.length} from Google)`);
      
      return {
        success: true,
        objects: hybridObjects,
        detectionMethod: 'Hybrid (YOLO + Google Vision)',
        yoloCount: highConfidenceYolo.length,
        googleCount: hybridObjects.length - highConfidenceYolo.length
      };
    },
    onSuccess: (response) => {
      console.log('Recognition response:', response);
      const allObjects = response.objects || [];
      console.log('Detected objects:', allObjects);
      
      // Apply intention detection if user drew a path
      const filteredObjects = analyzeUserIntention(
        recognitionMutation.variables?.drawingPath || [], 
        allObjects
      );
      
      console.log(`Intention analysis: ${allObjects.length} detected → ${filteredObjects.length} selected`);
      
      setDetectedObjects(filteredObjects);
      setShowRefinedOutlines(true);
      onObjectsDetected?.(filteredObjects);
      
      const detectionMethod = response.detectionMethod || 'Google Vision API';
      if (filteredObjects.length > 0) {
        const hasPath = recognitionMutation.variables?.drawingPath?.length > 0;
        toast({
          title: hasPath ? "Smart selection complete!" : "Objects detected and refined!",
          description: hasPath 
            ? `Found ${filteredObjects.length} object(s) matching your drawing: ${filteredObjects.map(o => o.name).join(', ')}`
            : `${detectionMethod} found ${filteredObjects.length} object(s): ${filteredObjects.map(o => o.name).join(', ')}`
        });
      } else {
        toast({
          title: "No objects found",
          description: "Try drawing around a different area or use a clearer image"
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

  const drawPath = useCallback((ctx: CanvasRenderingContext2D, path: DrawingPath) => {
    if (path.points.length < 2) return;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw the freehand path
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    
    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x, path.points[i].y);
    }
    
    // Close the path if drawing is complete
    if (path.isComplete && path.points.length > 2) {
      ctx.closePath();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fill();
    }
    
    ctx.stroke();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    setIsDrawing(true);
    setCurrentPath({ points: [coords], isComplete: false });
    setDetectedObjects([]);
    setShowRefinedOutlines(false);
  }, [getCanvasCoordinates]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    
    setCurrentPath(prev => {
      const newPath = { ...prev, points: [...prev.points, coords] };
      
      const ctx = canvasRef.current!.getContext('2d');
      if (ctx) {
        drawPath(ctx, newPath);
      }
      
      return newPath;
    });
  }, [isDrawing, getCanvasCoordinates, drawPath]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    setCurrentPath(prev => {
      const completedPath = { ...prev, isComplete: true };
      
      // Trigger AI recognition and edge refinement
      if (completedPath.points.length > 3) {
        // Get actual image dimensions
        const img = new Image();
        img.onload = () => {
          recognitionMutation.mutate({
            imageUrl,
            drawingPath: completedPath.points,
            imageWidth: img.naturalWidth,
            imageHeight: img.naturalHeight
          });
        };
        img.src = imageUrl;
      }
      
      return completedPath;
    });
  }, [isDrawing, imageUrl, recognitionMutation]);

  // Touch events for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
    setIsDrawing(true);
    setCurrentPath({ points: [coords], isComplete: false });
    setDetectedObjects([]);
    setShowRefinedOutlines(false);
  }, [getCanvasCoordinates]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !canvasRef.current) return;
    
    const touch = e.touches[0];
    const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
    
    setCurrentPath(prev => {
      const newPath = { ...prev, points: [...prev.points, coords] };
      
      const ctx = canvasRef.current!.getContext('2d');
      if (ctx) {
        drawPath(ctx, newPath);
      }
      
      return newPath;
    });
  }, [isDrawing, getCanvasCoordinates, drawPath]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    setIsDrawing(false);
    setCurrentPath(prev => {
      const completedPath = { ...prev, isComplete: true };
      
      if (completedPath.points.length > 3) {
        // Get actual image dimensions for touch end
        const img = new Image();
        img.onload = () => {
          recognitionMutation.mutate({
            imageUrl,
            drawingPath: completedPath.points,
            imageWidth: img.naturalWidth,
            imageHeight: img.naturalHeight
          });
        };
        img.src = imageUrl;
      }
      
      return completedPath;
    });
  }, [isDrawing, imageUrl, recognitionMutation]);

  const clearSelection = () => {
    setCurrentPath({ points: [], isComplete: false });
    setDetectedObjects([]);
    setShowRefinedOutlines(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
    }
  };

  // Advanced intention detection system
  const analyzeUserIntention = useCallback((path: { x: number; y: number }[], objects: DetectedObject[]) => {
    if (!path || path.length === 0) return objects; // Return all if no path

    // Calculate drawing path properties
    const pathBounds = getPathBounds(path);
    const pathCenter = {
      x: pathBounds.x + pathBounds.width / 2,
      y: pathBounds.y + pathBounds.height / 2
    };
    
    const pathArea = pathBounds.width * pathBounds.height;

    // Score each object based on multiple factors
    const scoredObjects = objects.map(obj => {
      const objCenter = { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 };
      const objArea = obj.width * obj.height;
      
      // Factor 1: How much of the object is enclosed by the drawing path
      const enclosureScore = calculateEnclosureScore(path, obj);
      
      // Factor 2: Distance from drawing center to object center (closer = better)
      const distance = Math.sqrt(
        Math.pow(pathCenter.x - objCenter.x, 2) + 
        Math.pow(pathCenter.y - objCenter.y, 2)
      );
      const maxDistance = Math.sqrt(Math.pow(pathBounds.width, 2) + Math.pow(pathBounds.height, 2));
      const distanceScore = 1 - (distance / Math.max(maxDistance, 1));
      
      // Factor 3: Size similarity (drawing should roughly match object size)
      const sizeRatio = Math.min(pathArea, objArea) / Math.max(pathArea, objArea);
      const sizeScore = sizeRatio;
      
      // Factor 4: AI confidence boost
      const confidenceScore = obj.confidence;
      
      // Factor 5: Path containment - does the drawing path surround the object?
      const containmentScore = calculateContainmentScore(path, obj);
      
      // Weighted total score
      const totalScore = (
        enclosureScore * 0.3 +      // 30% - how much object is enclosed
        distanceScore * 0.2 +       // 20% - proximity to drawing center  
        sizeScore * 0.15 +          // 15% - size similarity
        confidenceScore * 0.15 +    // 15% - AI confidence
        containmentScore * 0.2      // 20% - path containment
      );

      return {
        object: obj,
        score: totalScore,
        factors: {
          enclosure: enclosureScore,
          distance: distanceScore,
          size: sizeScore,
          confidence: confidenceScore,
          containment: containmentScore
        }
      };
    });

    // Sort by score and apply thresholds
    scoredObjects.sort((a, b) => b.score - a.score);
    
    console.log('Intention analysis scores:', scoredObjects.map(s => 
      `${s.object.name}: ${s.score.toFixed(2)} (enc:${s.factors.enclosure.toFixed(2)}, dist:${s.factors.distance.toFixed(2)}, size:${s.factors.size.toFixed(2)}, conf:${s.factors.confidence.toFixed(2)}, cont:${s.factors.containment.toFixed(2)})`
    ));
    
    // Only return objects with meaningful scores (> 0.3) and prioritize the top candidate
    const meaningfulObjects = scoredObjects.filter(item => item.score > 0.3);
    
    if (meaningfulObjects.length === 0) return [];
    
    // If the top candidate has a significantly higher score, return only that one
    const topScore = meaningfulObjects[0].score;
    const secondScore = meaningfulObjects[1]?.score || 0;
    
    if (topScore - secondScore > 0.2) {
      console.log(`High confidence selection: ${meaningfulObjects[0].object.name} (score: ${topScore.toFixed(2)})`);
      return [meaningfulObjects[0].object];
    }
    
    // Otherwise return top 2-3 candidates with similar scores
    const results = meaningfulObjects.slice(0, Math.min(3, meaningfulObjects.length)).map(item => item.object);
    console.log(`Multiple candidates selected: ${results.map(r => r.name).join(', ')}`);
    return results;
  }, []);

  // Calculate how much of the object is enclosed by the drawing path
  const calculateEnclosureScore = useCallback((path: { x: number; y: number }[], obj: DetectedObject): number => {
    const samplePoints = 15; // Sample points across the object
    let enclosedPoints = 0;
    
    for (let i = 0; i < samplePoints; i++) {
      for (let j = 0; j < samplePoints; j++) {
        const testX = obj.x + (obj.width * i) / (samplePoints - 1);
        const testY = obj.y + (obj.height * j) / (samplePoints - 1);
        
        if (isPointInPath(testX, testY, path)) {
          enclosedPoints++;
        }
      }
    }
    
    return enclosedPoints / (samplePoints * samplePoints);
  }, []);

  // Calculate how well the path contains/surrounds the object
  const calculateContainmentScore = useCallback((path: { x: number; y: number }[], obj: DetectedObject): number => {
    const objCorners = [
      { x: obj.x, y: obj.y },
      { x: obj.x + obj.width, y: obj.y },
      { x: obj.x + obj.width, y: obj.y + obj.height },
      { x: obj.x, y: obj.y + obj.height }
    ];
    
    const containedCorners = objCorners.filter(corner => isPointInPath(corner.x, corner.y, path));
    return containedCorners.length / objCorners.length;
  }, []);

  // Point-in-polygon test using ray casting
  const isPointInPath = useCallback((x: number, y: number, path: { x: number; y: number }[]): boolean => {
    if (path.length < 3) return false;
    let inside = false;
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
      if (((path[i].y > y) !== (path[j].y > y)) &&
          (x < (path[j].x - path[i].x) * (y - path[i].y) / (path[j].y - path[i].y) + path[i].x)) {
        inside = !inside;
      }
    }
    return inside;
  }, []);

  // Helper to calculate bounding box of drawing path
  const getPathBounds = useCallback((path: { x: number; y: number }[]) => {
    if (path.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    const xs = path.map(p => p.x);
    const ys = path.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }, []);

  const analyzeFullImage = () => {
    // Get actual image dimensions
    const img = new Image();
    img.onload = () => {
      recognitionMutation.mutate({ 
        imageUrl, 
        drawingPath: [], // Empty path means analyze full image
        imageWidth: img.naturalWidth,
        imageHeight: img.naturalHeight
      });
    };
    img.src = imageUrl;
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
        className="relative bg-gray-100 rounded-xl overflow-hidden cursor-crosshair max-w-2xl mx-auto"
        style={{ 
          aspectRatio: "16/12",
          maxHeight: "50vh" // Limit to 50% of viewport height
        }}
      >
        <img
          ref={imageRef}
          src={processedImageUrl}
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

        {/* Refined Object Outlines */}
        {showRefinedOutlines && detectedObjects && detectedObjects.map((obj, index) => {
          // Use canvas dimensions instead of natural image dimensions for scaling
          const canvasWidth = canvasRef.current?.width || 600;
          const canvasHeight = canvasRef.current?.height || 450;
          
          console.log(`Rendering object ${obj.name} at (${obj.x},${obj.y}) size ${obj.width}x${obj.height}`);
          console.log(`Canvas size: ${canvasWidth}x${canvasHeight}`);
          
          return (
            <div key={index}>
              {/* Bounding box fallback */}
              <div
                className="absolute border-2 transition-all cursor-pointer hover:scale-105 hover:shadow-lg"
                style={{
                  borderColor: getObjectCategoryColor(obj.name),
                  backgroundColor: `${getObjectCategoryColor(obj.name)}20`,
                  left: `${(obj.x / canvasWidth) * 100}%`,
                  top: `${(obj.y / canvasHeight) * 100}%`,
                  width: `${(obj.width / canvasWidth) * 100}%`,
                  height: `${(obj.height / canvasHeight) * 100}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedObjectForModification(obj);
                }}
              />
              
              {/* Refined SVG outline if available */}
              {obj.refinedPath && (
                <svg 
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                >
                  <path
                    d={obj.refinedPath}
                    stroke={getObjectCategoryColor(obj.name)}
                    strokeWidth="3"
                    fill={`${getObjectCategoryColor(obj.name)}40`}
                    className="animate-pulse"
                  />
                </svg>
              )}
              
              <Badge 
                className="absolute text-xs z-10 cursor-pointer hover:scale-110 transition-transform flex items-center gap-1"
                style={{ 
                  backgroundColor: getObjectCategoryColor(obj.name),
                  left: `${(obj.x / canvasWidth) * 100}%`,
                  top: `${Math.max(0, (obj.y / canvasHeight) * 100 - 8)}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedObjectForModification(obj);
                }}
              >
                {obj.name} ({Math.round(obj.confidence * 100)}%)
                {obj.source && (
                  <span className="text-xs opacity-75">
                    {obj.source === 'YOLO11' ? '🎯' : '👁️'}
                  </span>
                )}
                {obj.canSegment && (
                  <span className="text-xs opacity-75" title="Supports pixel-perfect segmentation">
                    ✂️
                  </span>
                )}
                <Wand2 className="h-3 w-3 opacity-75" />
              </Badge>
            </div>
          );
        })}

        {recognitionMutation.isPending && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <Card>
              <CardContent className="p-4 flex items-center space-x-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="text-sm font-medium">
                  {currentPath.points.length > 0 ? "Refining object edges..." : "Analyzing objects..."}
                </span>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Instructions and Controls */}
      <div className="space-y-3">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Pen className="h-4 w-4 text-blue-500" />
            <p className="text-sm text-gray-600">
              Draw around an object to identify it and replace it with Grok AI
            </p>
          </div>
          
          {/* Hybrid Detection Status & Legend */}
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg mb-3">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">Hybrid AI Detection</span>
              {yoloModelLoaded && <Check className="w-4 h-4 text-green-500" />}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center mb-2">
              Combines YOLO11 (high confidence) + Google Vision (comprehensive coverage)
            </p>
            <div className="flex justify-center gap-4 text-xs text-gray-500">
              <span>🎯 YOLO11</span>
              <span>👁️ Google Vision</span>
              <span>✂️ Segmentation</span>
            </div>
          </div>
          
          <div className="flex justify-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              disabled={currentPath.points.length === 0 && detectedObjects.length === 0}
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button
              onClick={analyzeFullImage}
              disabled={recognitionMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-violet-500"
            >
              {useAdvancedDetection ? (
                <Bot className="h-4 w-4 mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Analyze Full Image
            </Button>
            <Button
              onClick={() => setShowGrokEditor(true)}
              disabled={recognitionMutation.isPending}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Edit with Grok
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
                    className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      // Check if we have drawing path for Grok replacement
                      if (currentPath.points.length > 0) {
                        const segmentation = currentPath.points.flatMap(p => [p.x, p.y]);
                        setSelectedObjectForGrokReplacement({ ...obj, segmentation });
                      } else {
                        setSelectedObjectForModification(obj);
                      }
                    }}
                  >
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getObjectCategoryColor(obj.name) }}
                    />
                    <span className="text-sm font-medium capitalize">{obj.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {Math.round(obj.confidence * 100)}%
                    </span>
                    {obj.refinedPath && (
                      <Badge variant="secondary" className="text-xs">
                        Refined
                      </Badge>
                    )}
                    {currentPath.points.length > 0 && (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                        Grok AI
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Object Replacement Interface */}
        {selectedObjectForModification && (
          <ObjectModifier
            object={selectedObjectForModification}
            imageUrl={processedImageUrl}
            onClose={() => setSelectedObjectForModification(null)}
            onObjectReplaced={(newImageUrl) => {
              console.log('Object replaced, updated image URL:', newImageUrl);
              setProcessedImageUrl(newImageUrl);
              setSelectedObjectForModification(null);
              // Clear the drawing path after successful replacement
              setCurrentPath({ points: [], isComplete: false });
              // Clear detected objects since the image has changed
              setDetectedObjects([]);
            }}
          />
        )}

        {/* Grok Object Replacement Interface */}
        {selectedObjectForGrokReplacement && (
          <GrokObjectReplacer
            selectedObject={selectedObjectForGrokReplacement}
            imageUrl={processedImageUrl}
            onReplacementComplete={(result) => {
              if (result.success && result.finalImageBase64) {
                console.log('Grok replacement completed successfully!');
                // Update the image with the new result
                const dataUrl = `data:image/png;base64,${result.finalImageBase64}`;
                setProcessedImageUrl(dataUrl);
                setSelectedObjectForGrokReplacement(null);
                // Clear the drawing path after successful replacement
                setCurrentPath({ points: [], isComplete: false });
                // Clear detected objects since the image has changed
                setDetectedObjects([]);
                toast({
                  title: "Object Replaced Successfully!",
                  description: `${selectedObjectForGrokReplacement.name} has been replaced with Grok AI`,
                });
              }
            }}
            onClose={() => setSelectedObjectForGrokReplacement(null)}
          />
        )}

        {/* Grok Editor (Simple Direct Interface) */}
        {showGrokEditor && (
          <GrokEditor
            imageUrl={processedImageUrl}
            onClose={() => setShowGrokEditor(false)}
            onImageReplaced={(newImageUrl) => {
              setProcessedImageUrl(newImageUrl);
              setShowGrokEditor(false);
              toast({
                title: "Image Edited with Grok!",
                description: "Your image has been successfully edited using Grok AI.",
              });
            }}
          />
        )}
      </div>
    </div>
  );
}