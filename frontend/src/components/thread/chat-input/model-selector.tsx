'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, AlertTriangle } from 'lucide-react';
import {
  ModelOption,
  SubscriptionStatus,
  STORAGE_KEY_MODEL,
  DEFAULT_FREE_MODEL_ID,
  DEFAULT_PREMIUM_MODEL_ID,
  formatModelName,
  MODELS // Import the centralized MODELS constant
} from './_use-model-selection';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { isLocalMode } from '@/lib/config';



interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  modelOptions: ModelOption[];
  canAccessModel: (modelId: string) => boolean;
  subscriptionStatus: SubscriptionStatus;
  refreshCustomModels?: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  modelOptions,
  canAccessModel,
  subscriptionStatus,
  refreshCustomModels,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const router = useRouter();



  // Enhance model options with capabilities - using a Map to ensure uniqueness
  const modelMap = new Map();

  // Add all standard models to the map
  modelOptions.forEach(model => {
    modelMap.set(model.id, {
      ...model,
      isCustom: false
    });
  });

  // Convert map back to array
  const enhancedModelOptions = Array.from(modelMap.values());

  // No filtering needed - show all models
  const sortedModels = enhancedModelOptions;

  // Make sure model IDs are unique for rendering
  const getUniqueModelKey = (model: any, index: number): string => {
    return `model-${model.id}-${index}`;
  };

  // Map models to ensure unique IDs for React keys
  const uniqueModels = sortedModels.map((model, index) => ({
    ...model,
    uniqueKey: getUniqueModelKey(model, index)
  }));

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  const selectedLabel =
    enhancedModelOptions.find((o) => o.id === selectedModel)?.label || 'Select model';

  const handleSelect = (id: string) => {
    // All models are now accessible without subscription restrictions
      onModelChange(id);
      setIsOpen(false);
  };


  const shouldDisplayAll = false; // Always show all models without premium restrictions



  const renderModelOption = (opt: any, index: number) => {
    const isHighlighted = index === highlightedIndex;
    const isLowQuality = MODELS[opt.id]?.lowQuality || false;
    const isRecommended = MODELS[opt.id]?.recommended || false;

    return (
      <TooltipProvider key={opt.uniqueKey || `model-${opt.id}-${index}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className='w-full'>
              <DropdownMenuItem
                className={cn(
                  "text-sm px-3 py-2 mx-2 my-0.5 flex items-center justify-between cursor-pointer",
                  isHighlighted && "bg-accent"
                )}
                onClick={() => handleSelect(opt.id)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex items-center">
                  <span className="font-medium">{opt.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Show capabilities */}
                  {isLowQuality && (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  {isRecommended && (
                    <span className="text-xs px-1.5 py-0.5 rounded-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-medium">
                      Recommended
                    </span>
                  )}
                  {selectedModel === opt.id && (
                    <Check className="h-4 w-4 text-blue-500" />
                  )}
                </div>
              </DropdownMenuItem>
            </div>
          </TooltipTrigger>
          {isLowQuality ? (
            <TooltipContent side="left" className="text-xs max-w-xs">
              <p>Not recommended for complex tasks</p>
            </TooltipContent>
          ) : isRecommended ? (
            <TooltipContent side="left" className="text-xs max-w-xs">
              <p>Recommended for optimal performance</p>
            </TooltipContent>
          ) : null}
        </Tooltip>
      </TooltipProvider>
    );
  };


  return (
    <div className="relative">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="default"
            className="h-8 rounded-lg text-muted-foreground shadow-none border-none focus:ring-0 px-3"
          >
            <div className="flex items-center gap-1 text-sm font-medium">
              {MODELS[selectedModel]?.lowQuality && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mr-1" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <p>Basic model with limited capabilities</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <span className="truncate max-w-[100px] sm:max-w-[160px] md:max-w-[200px] lg:max-w-none">{selectedLabel}</span>
              <ChevronDown className="h-3 w-3 opacity-50 ml-1 flex-shrink-0" />
            </div>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-72 p-0 overflow-hidden"
          sideOffset={4}
        >
          <div className="overflow-y-auto w-full scrollbar-hide relative">
            {/* Simplified view - show all models without premium restrictions */}
              <div className='max-h-[320px] overflow-y-auto w-full'>
                <div className="px-3 py-3 flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground">All Models</span>
                </div>
                {uniqueModels
                  // Sort to prioritize recommended models first
                  .sort((a, b) => {
                    const aRecommended = MODELS[a.id]?.recommended;
                    const bRecommended = MODELS[b.id]?.recommended;

                    if (aRecommended && !bRecommended) return -1;
                    if (!aRecommended && bRecommended) return 1;

                    // Default to alphabetical order
                    return a.label.localeCompare(b.label);
                  })
                  .map((model, index) => renderModelOption(model, index))}

                {uniqueModels.length === 0 && (
                  <div className="text-sm text-center py-4 text-muted-foreground">
                    No models available
                  </div>
                )}
              </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>


    </div>
  );
};