"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LayoutTemplate, SquarePen } from 'lucide-react';

interface WorkflowCreationChoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUseTemplate: () => void;
  onDesignFromScratch: () => void;
}

export function WorkflowCreationChoiceDialog({
  isOpen,
  onClose,
  onUseTemplate,
  onDesignFromScratch
}: WorkflowCreationChoiceDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Create New Workflow</DialogTitle>
        </DialogHeader>
        
        <div className="py-8">
          <p className="text-center text-muted-foreground mb-8">
            Choose how you'd like to create your workflow
          </p>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Use Workflow Template Option */}
            <button
              onClick={onUseTemplate}
              className="group relative overflow-hidden rounded-lg border-2 border-border hover:border-primary transition-all duration-200 p-6 text-left bg-card hover:bg-accent/50"
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="rounded-full bg-primary/10 p-4 group-hover:bg-primary/20 transition-colors">
                  <LayoutTemplate className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-2">Use Workflow Template</h3>
                  <p className="text-sm text-muted-foreground">
                    Start with a pre-built template and customize it to your needs
                  </p>
                </div>
              </div>
            </button>

            {/* Design from Scratch Option */}
            <button
              onClick={onDesignFromScratch}
              className="group relative overflow-hidden rounded-lg border-2 border-border hover:border-primary transition-all duration-200 p-6 text-left bg-card hover:bg-accent/50"
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="rounded-full bg-primary/10 p-4 group-hover:bg-primary/20 transition-colors">
                  <SquarePen className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-2">Design from Scratch</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a completely custom workflow from the ground up
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

