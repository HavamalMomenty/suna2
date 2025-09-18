'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileTextIcon, UploadIcon, Trash2Icon } from 'lucide-react';
import { Workflow } from '@/lib/api';
import { toast } from 'sonner';

interface ConfigureJobDialogProps {
  workflow: Workflow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRun: (params: { workflow: Workflow; promptText: string; files: File[]; background: boolean }) => void;
}

export default function ConfigureJobDialog({
  workflow,
  open,
  onOpenChange,
  onRun,
}: ConfigureJobDialogProps) {
  const [promptText, setPromptText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    }
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file !== fileToRemove));
  };

  const handleRun = (background: boolean) => {
    if (!workflow) return;
    onRun({ workflow, promptText, files, background });
    // Close dialog immediately
    onOpenChange(false);
    setPromptText('');
    setFiles([]);
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setPromptText('');
      setFiles([]);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [open]);

  if (!workflow) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure Job: {workflow.name}</DialogTitle>
          <DialogDescription>{workflow.description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow p-4 -mx-4">
          <div className="grid gap-4 py-4 px-4">
            <div className="grid gap-2">
              <Label htmlFor="prompt">Prompt for the Agent</Label>
              <Textarea
                id="prompt"
                placeholder="Enter your prompt here..."
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="files">Attach Files (Optional)</Label>
              <Input
                id="files"
                type="file"
                multiple
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="mr-2 h-4 w-4" /> Upload Files
              </Button>
              {files.length > 0 && (
                <div className="mt-2 space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-md bg-muted p-2 text-sm"
                    >
                      <div className="flex items-center">
                        <FileTextIcon className="mr-2 h-4 w-4" />
                        <span>{file.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFile(file)}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => handleRun(true)}
            className="bg-green-600 hover:bg-green-600/90 text-white"
          >
            Run in Background
          </Button>
          <Button 
            onClick={() => handleRun(false)}
            className="bg-green-600 hover:bg-green-600/90 text-white"
          >
            Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
