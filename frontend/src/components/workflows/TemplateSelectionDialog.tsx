"use client";

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Copy, Edit } from 'lucide-react';
import { type Workflow } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useIsAdmin } from '@/hooks/use-admin';

// Helper function to get signed URL for image display
const getImageUrl = async (imagePath: string): Promise<string> => {
  if (!imagePath) return '';
  
  // If it's already a full URL, return it
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Generate signed URL for private bucket
  const supabase = createClient();
  const { data: signedUrlData } = await supabase.storage
    .from('workflow-images')
    .createSignedUrl(imagePath, 60 * 60 * 24 * 7); // 7 days expiry
  
  return signedUrlData?.signedUrl || '';
};

// Component to handle image display with signed URLs
const WorkflowImage = ({ imagePath, alt, className }: { imagePath: string; alt: string; className: string }) => {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      if (imagePath) {
        setLoading(true);
        const url = await getImageUrl(imagePath);
        setImageUrl(url);
        setLoading(false);
      } else {
        setImageUrl('');
        setLoading(false);
      }
    };
    loadImage();
  }, [imagePath]);

  if (loading) {
    return <div className={`${className} bg-muted animate-pulse`} />;
  }

  if (!imageUrl) {
    return null;
  }

  return <img src={imageUrl} alt={alt} className={className} />;
};

interface TemplateSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Workflow[];
  onTemplateSelect: (templateId: string) => void;
  onTemplateEdit?: (templateId: string) => void;
  isLoading?: boolean;
}

export function TemplateSelectionDialog({
  isOpen,
  onClose,
  templates,
  onTemplateSelect,
  onTemplateEdit,
  isLoading = false
}: TemplateSelectionDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { data: isAdmin = false } = useIsAdmin();

  // Reset selection when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedTemplateId(null);
    }
  }, [isOpen]);

  const handleTemplateClick = (templateId: string) => {
    // Toggle selection - clicking the same template deselects it
    if (selectedTemplateId === templateId) {
      setSelectedTemplateId(null);
    } else {
      setSelectedTemplateId(templateId);
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Deselect if clicking on the background (not on a workflow card)
    if (e.target === e.currentTarget) {
      setSelectedTemplateId(null);
    }
  };

  const handleConfirm = () => {
    if (selectedTemplateId) {
      onTemplateSelect(selectedTemplateId);
    }
  };

  const getWorkflowColor = (status: string) => {
    switch (status) {
      case "active":
        return "#10b981";
      case "draft":
        return "#f59e0b";
      case "paused":
        return "#6b7280";
      case "disabled":
        return "#ef4444";
      case "archived":
        return "#9ca3af";
      default:
        return "#8b5cf6";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Choose a template</DialogTitle>
        </DialogHeader>
        
        {/* Scrollable content area - 2x height of workflow builder */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto py-6 px-4"
          onClick={handleBackgroundClick}
        >
          {templates.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                  <Copy className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">No workflow templates available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Administrators can promote workflows to templates
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-6">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex flex-col space-y-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTemplateClick(template.id);
                  }}
                >
                  {/* Workflow Card */}
                  <div
                    className={`
                      bg-neutral-100 dark:bg-sidebar rounded-xl overflow-hidden 
                      hover:ring-2 hover:ring-primary/50 transition-all duration-200 hover:shadow-lg
                      cursor-pointer h-20 relative group
                      ${selectedTemplateId === template.id ? 'ring-2 ring-primary shadow-xl scale-105' : 'hover:scale-102'}
                    `}
                    style={{ boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.4)' }}
                  >
                    {/* Background Image, Striped Pattern, or Color - with overlay inside same container */}
                    <div className="absolute inset-0 overflow-hidden rounded-xl">
                      {template.image_url ? (
                        <>
                          <WorkflowImage 
                            imagePath={template.image_url}
                            alt={template.name}
                            className="w-full h-full object-cover"
                          />
                          {/* Dark overlay for better text readability */}
                          <div className="absolute inset-0 bg-black/20" />
                        </>
                      ) : (
                        <div 
                          className="absolute inset-0"
                          style={{ 
                            background: `repeating-linear-gradient(
                              45deg,
                              #e5e7eb30,
                              #e5e7eb30 3px,
                              #3b82f660 3px,
                              #3b82f660 6px
                            )`
                          }}
                        />
                      )}

                      {/* Title overlay */}
                      <div className="absolute top-0 left-0 right-0 h-8 bg-background/85 backdrop-blur-sm flex items-center justify-center p-1.5 rounded-t-xl">
                        <h3 className="font-medium text-foreground text-xs leading-tight line-clamp-2 text-center">
                          {template.name}
                        </h3>
                      </div>
                    </div>

                    {/* Admin Edit Button */}
                    {isAdmin && onTemplateEdit && (
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 bg-background/80 hover:bg-background"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTemplateEdit(template.id);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Selection indicator */}
                    {selectedTemplateId === template.id && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-primary/10">
                        <div className="bg-primary text-primary-foreground rounded-full p-3 shadow-lg">
                          <Copy className="h-6 w-6" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Back and Confirm buttons */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Button
            onClick={handleConfirm}
            disabled={!selectedTemplateId || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

