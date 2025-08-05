// Simple Grok Editor Interface
// Replaces the complex DALL-E workflow with direct Grok automation

import { GrokEditor } from './grok-editor';

interface ObjectModifierProps {
  object: {
    name: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
    segmentation?: number[];
    refinedPath?: string;
  };
  imageUrl: string;
  onClose: () => void;
  onObjectReplaced: (newImageUrl: string) => void;
}

export function ObjectModifier({ object, imageUrl, onClose, onObjectReplaced }: ObjectModifierProps) {
  // Convert object-specific props to GrokEditor props
  return (
    <GrokEditor
      imageUrl={imageUrl}
      onClose={onClose}
      onImageReplaced={onObjectReplaced}
    />
  );
}