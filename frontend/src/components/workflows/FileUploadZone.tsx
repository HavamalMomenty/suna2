"use client";

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  File, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  FileText,
  Image,
  Archive,
  Info
} from 'lucide-react';
import { 
  useUploadWorkflowFile, 
  useDeleteWorkflowFile,
  type WorkflowFile
} from '@/hooks/react-query/workflows/use-workflow-builder';
import { toast } from 'sonner';

interface FileUploadZoneProps {
  workflowId?: string | null;
  files: WorkflowFile[];
  onFilesChange: (files: WorkflowFile[]) => void;
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
  mode?: 'create' | 'edit';
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/json'
];

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
  if (mimeType === 'application/pdf') return <FileText className="h-4 w-4" />;
  if (mimeType.includes('zip') || mimeType.includes('archive')) return <Archive className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function FileUploadZone({ 
  workflowId, 
  files, 
  onFilesChange, 
  pendingFiles = [], 
  onPendingFilesChange,
  mode = 'edit'
}: FileUploadZoneProps) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  
  const uploadMutation = useUploadWorkflowFile();
  const deleteMutation = useDeleteWorkflowFile();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Validate files first
    const validFiles: File[] = [];
    
    for (const file of acceptedFiles) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" is too large. Maximum size is 10MB.`);
        continue;
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`File type "${file.type}" is not supported for "${file.name}".`);
        continue;
      }
      
      validFiles.push(file);
    }
    
    if (validFiles.length === 0) return;
    
    if (mode === 'create' || !workflowId) {
      // Create mode - store files locally
      if (onPendingFilesChange) {
        onPendingFilesChange([...pendingFiles, ...validFiles]);
        toast.success(`${validFiles.length} file(s) ready for upload`);
      }
      return;
    }

    // Edit mode - upload immediately
    for (const file of validFiles) {

      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        
        const response = await uploadMutation.mutateAsync({
          workflowId,
          file
        });

        // Add the uploaded file to the files list (extract file from response)
        onFilesChange([...files, response.file]);
        
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[file.name];
          return newProgress;
        });

        toast.success(`File "${file.name}" uploaded successfully`);
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload "${file.name}"`);
        
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[file.name];
          return newProgress;
        });
      }
    }
  }, [workflowId, files, onFilesChange, uploadMutation, pendingFiles, onPendingFilesChange, mode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/csv': ['.csv'],
      'application/json': ['.json']
    },
    maxSize: MAX_FILE_SIZE,
    disabled: false // Allow uploads in both create and edit modes
  });

  const handleDeleteFile = async (fileId: string) => {
    if (!workflowId) return;

    try {
      await deleteMutation.mutateAsync({ workflowId, fileId });
      onFilesChange(files.filter(f => f.id !== fileId));
      toast.success('File deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete file');
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Upload supplementary files to provide additional context for your workflow. 
          Supported formats: PDF, TXT, MD, DOC, DOCX, CSV, JSON (max 10MB each).
        </AlertDescription>
      </Alert>

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
              }
            `}
          >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              {isDragActive ? (
                <p className="text-lg font-medium">Drop files here...</p>
              ) : (
                <div>
                  <p className="text-lg font-medium mb-2">
                    Drag & drop files here, or click to select
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PDF, TXT, MD, DOC, DOCX, CSV, JSON (max 10MB each)
                  </p>
                </div>
              )}
            </div>

          {/* Upload Progress */}
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="mt-4 p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{fileName}</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Files List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFileIcon(file.mime_type || file.file_type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.filename}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatFileSize(file.file_size || 0)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {file.file_type}
                        </Badge>
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Uploaded
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFile(file.id)}
                    disabled={deleteMutation.isPending}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Files (Create Mode) */}
      {mode === 'create' && pendingFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Files Ready for Upload ({pendingFiles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(file.type)}
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} • {file.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">Ready</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (onPendingFilesChange) {
                          onPendingFilesChange(pendingFiles.filter((_, i) => i !== index));
                        }
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                These files will be uploaded when you create the workflow.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {files.length === 0 && pendingFiles.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <File className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {mode === 'create' 
                ? 'No files selected yet. Upload files to provide additional context for your workflow.'
                : 'No files uploaded yet. Upload files to provide additional context for your workflow.'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
