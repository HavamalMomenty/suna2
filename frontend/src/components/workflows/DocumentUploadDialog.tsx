"use client";

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, FileText, X, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  description?: string;
}

interface DocumentUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  workflowName: string;
  onDocumentsUploaded: (documents: UploadedDocument[]) => void;
  onExecute: (documents: UploadedDocument[]) => void;
}

export function DocumentUploadDialog({
  isOpen,
  onClose,
  workflowId,
  workflowName,
  onDocumentsUploaded,
  onExecute,
}: DocumentUploadDialogProps) {
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const processFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newDocuments: UploadedDocument[] = [];

      for (const file of Array.from(files)) {
        // Generate a unique ID for the document
        const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // For now, we'll store the file locally and simulate upload
        // In a real implementation, you would upload to your backend
        const uploadPath = `/workflows/${workflowId}/documents/${file.name}`;
        
        // Create a local URL for the file
        const localUrl = URL.createObjectURL(file);
        
        const newDocument: UploadedDocument = {
          id: documentId,
          name: file.name,
          size: file.size,
          type: file.type,
          path: uploadPath,
          description: ''
        };

        newDocuments.push(newDocument);
        
        // Set default description
        setDescriptions(prev => ({
          ...prev,
          [documentId]: `Document for workflow: ${workflowName}`
        }));
      }

      setUploadedDocuments(prev => [...prev, ...newDocuments]);
      toast.success(`Successfully uploaded ${newDocuments.length} document${newDocuments.length !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Document upload failed:', error);
      toast.error('Failed to upload documents');
    } finally {
      setIsUploading(false);
      // Reset the file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const removeDocument = (documentId: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== documentId));
    setDescriptions(prev => {
      const newDescriptions = { ...prev };
      delete newDescriptions[documentId];
      return newDescriptions;
    });
  };

  const updateDescription = (documentId: string, description: string) => {
    setDescriptions(prev => ({
      ...prev,
      [documentId]: description
    }));
  };

  const handleExecute = () => {
    // Update documents with descriptions
    const documentsWithDescriptions = uploadedDocuments.map(doc => ({
      ...doc,
      description: descriptions[doc.id] || ''
    }));

    // Call the callback with uploaded documents
    onDocumentsUploaded(documentsWithDescriptions);
    
    // Execute the workflow with documents
    onExecute(documentsWithDescriptions);
    
    // Close the dialog
    onClose();
  };

  const handleClose = () => {
    // Reset state when closing
    setUploadedDocuments([]);
    setDescriptions({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Documents for Workflow
          </DialogTitle>
          <DialogDescription>
            Upload additional documents that will be available when running "{workflowName}".
            These documents will be accessible to the workflow during execution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="document-upload">Upload Documents</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFileUpload}
                disabled={isUploading}
                className="flex items-center gap-2"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isUploading ? 'Uploading...' : 'Choose Files'}
              </Button>
            </div>
            
            <Input
              ref={fileInputRef}
              id="document-upload"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.json,.xml,.html,.htm"
              onChange={processFileUpload}
              className="hidden"
            />
            
            <p className="text-sm text-muted-foreground">
              Supported formats: PDF, Word, Text, Markdown, CSV, Excel, JSON, XML, HTML
            </p>
          </div>

          {/* Uploaded Documents List */}
          {uploadedDocuments.length > 0 && (
            <div className="space-y-4">
              <Label>Uploaded Documents</Label>
              
              <div className="space-y-3">
                {uploadedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start gap-3 p-3 border rounded-lg bg-muted/50"
                  >
                    <div className="flex-shrink-0">
                      <FileText className="h-5 w-5 text-blue-500" />
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(doc.size / 1024 / 1024).toFixed(2)} MB • {doc.type}
                          </p>
                        </div>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDocument(doc.id)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="space-y-1">
                        <Label htmlFor={`desc-${doc.id}`} className="text-xs">
                          Description (optional)
                        </Label>
                        <Input
                          id={`desc-${doc.id}`}
                          placeholder="Describe what this document contains..."
                          value={descriptions[doc.id] || ''}
                          onChange={(e) => updateDescription(doc.id, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Documents State */}
          {uploadedDocuments.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No documents uploaded yet</p>
              <p className="text-sm text-muted-foreground">
                Click "Choose Files" to upload documents for this workflow
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          
          <Button
            onClick={handleExecute}
            disabled={uploadedDocuments.length === 0}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Execute Workflow
            {uploadedDocuments.length > 0 && (
              <span className="ml-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                {uploadedDocuments.length} doc{uploadedDocuments.length !== 1 ? 's' : ''}
              </span>
            )}
          </Button>
        </DialogFooter>
        
        {/* Execution confirmation info */}
        {uploadedDocuments.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Ready to execute:</strong> "{workflowName}" will run with {uploadedDocuments.length} additional document{uploadedDocuments.length !== 1 ? 's' : ''} that will be available during execution.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
