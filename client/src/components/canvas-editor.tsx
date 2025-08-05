import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Circle, Square, Pen, Undo, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasEditorProps {
  imageUrl: string;
  onSelectionChange?: (selection: any) => void;
}

export function CanvasEditor({ imageUrl, onSelectionChange }: CanvasEditorProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectionMode, setSelectionMode] = useState<'draw' | 'circle' | 'rectangle'>('draw');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selection, setSelection] = useState<any>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    // Add drawing logic here
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    // Add drawing logic here
  }, [isDrawing]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(false);
    // Finalize selection
  }, []);

  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 25, 200));
  };

  const zoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 25, 50));
  };

  const undoSelection = () => {
    setSelection(null);
    onSelectionChange?.(null);
  };

  return (
    <div className="relative bg-gray-100 rounded-xl overflow-hidden" style={{ aspectRatio: "16/12" }}>
      {/* Main Image */}
      <div 
        ref={canvasRef}
        className="w-full h-full relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center' }}
      >
        <img 
          src={imageUrl} 
          alt="Room interior" 
          className="w-full h-full object-cover"
          draggable={false}
        />
        
        {/* Selection Overlay */}
        {selection && (
          <div className="absolute inset-0 pointer-events-none">
            <div 
              className="absolute border-2 border-blue-500 border-dashed rounded-lg bg-blue-500 bg-opacity-10 animate-pulse"
              style={{
                top: '15%',
                left: '60%',
                width: '35%',
                height: '70%'
              }}
            />
            <div className="absolute -top-8 left-[60%] bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
              Wall Selected
            </div>
          </div>
        )}
      </div>

      {/* Floating Tools */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2">
        <Button
          variant={selectionMode === 'draw' ? 'default' : 'secondary'}
          size="sm"
          className="w-10 h-10 p-0"
          onClick={() => setSelectionMode('draw')}
        >
          <Pen className="h-4 w-4" />
        </Button>
        <Button
          variant={selectionMode === 'circle' ? 'default' : 'secondary'}
          size="sm"
          className="w-10 h-10 p-0"
          onClick={() => setSelectionMode('circle')}
        >
          <Circle className="h-4 w-4" />
        </Button>
        <Button
          variant={selectionMode === 'rectangle' ? 'default' : 'secondary'}
          size="sm"
          className="w-10 h-10 p-0"
          onClick={() => setSelectionMode('rectangle')}
        >
          <Square className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-10 h-10 p-0"
          onClick={undoSelection}
        >
          <Undo className="h-4 w-4" />
        </Button>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-white rounded-lg shadow-lg px-3 py-2">
        <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={zoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-gray-700 px-2">{zoomLevel}%</span>
        <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={zoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
