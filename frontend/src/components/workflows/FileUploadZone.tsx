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
  Download,
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
  mode?: 'create' | 'edit' | 'view';
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (match backend)
const ALLOWED_TYPES = [
  // Text/Data
  'text/markdown',
  'text/plain',
  'text/csv',
  'text/html',
  'text/css',
  'text/xml',
  'application/xml',
  'application/json',
  'text/tab-separated-values',
  'application/octet-stream',
  // Office/Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/mspowerpoint',
  'application/powerpoint',
  'application/vnd.ms-excel',
  'application/msexcel',
  'application/excel',
  'application/rtf',
  'application/x-tex',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  // Images
  'image/jpeg',
  'image/png',
  'image/svg+xml'
];

const ALLOWED_EXTENSIONS = [
  '.md', '.markdown', '.mdx', '.txt', '.csv', '.tsv', '.html', '.htm', '.css', '.xml', '.json',
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.odt', '.ods', '.odp', '.rtf', '.tex',
  '.jpg', '.jpeg', '.png', '.svg'
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
        toast.error(`File "${file.name}" is too large. Maximum size is 50MB.`);
        continue;
      }

      // Validate file type
      const lowerName = file.name.toLowerCase();
      const hasAllowedExtension = ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
      if (!ALLOWED_TYPES.includes(file.type) && !hasAllowedExtension) {
        toast.error(`File type "${file.type || 'unknown'}" not supported for "${file.name}".`);
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

        // Add the uploaded file to the files list (construct WorkflowFile from response)
        const newFile: WorkflowFile = {
          id: response.file_id,
          workflow_id: workflowId || '',
          filename: response.filename,
          file_type: response.mime_type,
          file_size: response.file_size,
          file_path: '', // This will be set by the backend
          mime_type: response.mime_type,
          created_by: '' // This will be set by the backend
        };
        onFilesChange([...files, newFile]);
        
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
      'text/markdown': ['.md', '.markdown', '.mdx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
      'text/html': ['.html', '.htm'],
      'text/css': ['.css'],
      'text/xml': ['.xml'],
      'application/xml': ['.xml'],
      'application/json': ['.json'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/mspowerpoint': ['.ppt'],
      'application/powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-excel': ['.xls', '.csv'],
      'application/msexcel': ['.xls'],
      'application/excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.oasis.opendocument.text': ['.odt'],
      'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
      'application/vnd.oasis.opendocument.presentation': ['.odp'],
      'application/rtf': ['.rtf'],
      'application/x-tex': ['.tex'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/svg+xml': ['.svg']
    },
    maxSize: MAX_FILE_SIZE,
    disabled: mode === 'view' // Disable uploads in view mode
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

  const handleDownloadFile = async (file: WorkflowFile) => {
    if (!workflowId) return;

    try {
      // Get Supabase session for authentication
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/workflows/${workflowId}/files/${file.id}/content`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`File "${file.filename}" downloaded successfully`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Upload supplementary files to provide additional context for your workflow.
          Supported: MD/MDX, TXT, HTML, CSS, XML, JSON, CSV/TSV, PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, ODT/ODS/ODP, RTF, TEX, JPG/JPEG, PNG, SVG (max 50MB each).
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
                    MD/MDX, TXT, HTML, CSS, XML, JSON, CSV/TSV, PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, ODT/ODS/ODP, RTF, TEX, JPG/JPEG, PNG, SVG (max 50MB)
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadFile(file)}
                      className="text-primary hover:text-primary hover:bg-primary/10"
                      title="Download file"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {mode !== 'view' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFile(file.id)}
                        disabled={deleteMutation.isPending}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete file"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
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
