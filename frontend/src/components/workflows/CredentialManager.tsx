"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Key,
  AlertCircle,
  Info
} from 'lucide-react';
import { 
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { type WorkflowCredential } from '@/hooks/react-query/workflows/use-workflow-builder';

interface CredentialManagerProps {
  credentials: WorkflowCredential[];
  template: string;
  onCredentialsUpdate: (credentials: WorkflowCredential[]) => void;
  onTemplateUpdate: (template: string) => void;
}

export function CredentialManager({
  credentials,
  template,
  onCredentialsUpdate,
  onTemplateUpdate
}: CredentialManagerProps) {
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const addCredential = () => {
    const newCredential: WorkflowCredential = {
      workflow_id: '', // Will be set when workflow is saved
      credential_key: '',
      credential_value: '',
      description: ''
    };
    
    onCredentialsUpdate([...credentials, newCredential]);
  };

  const updateCredential = (index: number, field: keyof WorkflowCredential, value: string) => {
    const updatedCredentials = credentials.map((cred, i) => 
      i === index ? { ...cred, [field]: value } : cred
    );
    onCredentialsUpdate(updatedCredentials);
  };

  const removeCredential = (index: number) => {
    const updatedCredentials = credentials.filter((_, i) => i !== index);
    onCredentialsUpdate(updatedCredentials);
  };

  const toggleShowValue = (index: number) => {
    setShowValues(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const generateTemplate = () => {
    if (credentials.length === 0) {
      onTemplateUpdate('');
      return;
    }

    const templateContent = credentials
      .filter(cred => cred.credential_key.trim())
      .map(cred => `${cred.credential_key}=`)
      .join('\n');
    
    onTemplateUpdate(templateContent);
  };

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Credentials are encrypted and stored securely. They can be referenced in your workflow prompts 
          using the credential keys you define below.
        </AlertDescription>
      </Alert>

      {/* Credentials Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Credentials</h3>
            <p className="text-sm text-muted-foreground">
              Add API keys, tokens, and other sensitive information
            </p>
          </div>
          <Button onClick={addCredential} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Credential
          </Button>
        </div>

        {credentials.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No credentials added yet. Click "Add Credential" to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {credentials.map((credential, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Credential Key */}
                    <div className="space-y-2">
                      <Label htmlFor={`key-${index}`}>
                        Credential Key <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`key-${index}`}
                        value={credential.credential_key}
                        onChange={(e) => updateCredential(index, 'credential_key', e.target.value)}
                        placeholder="e.g., OPENAI_API_KEY"
                        className="font-mono"
                      />
                    </div>

                    {/* Credential Value */}
                    <div className="space-y-2">
                      <Label htmlFor={`value-${index}`}>
                        Credential Value <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id={`value-${index}`}
                          type={showValues[index] ? 'text' : 'password'}
                          value={credential.credential_value || ''}
                          onChange={(e) => updateCredential(index, 'credential_value', e.target.value)}
                          placeholder="Enter credential value..."
                          className="pr-20"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleShowValue(index)}
                            className="h-6 w-6 p-0"
                          >
                            {showValues[index] ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCredential(index)}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`desc-${index}`}>Description (Optional)</Label>
                      <Input
                        id={`desc-${index}`}
                        value={credential.description || ''}
                        onChange={(e) => updateCredential(index, 'description', e.target.value)}
                        placeholder="Brief description of this credential..."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Login Template Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Login Template</h3>
            <p className="text-sm text-muted-foreground">
              Markdown template with credential placeholders
            </p>
          </div>
          {credentials.length > 0 && (
            <Button onClick={generateTemplate} variant="outline" size="sm">
              Generate Template
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-4">
            <Textarea
              value={template}
              onChange={(e) => onTemplateUpdate(e.target.value)}
              placeholder={
                credentials.length > 0
                  ? "Click 'Generate Template' to create a template from your credentials, or write your own..."
                  : "Add credentials first to generate a template..."
              }
              rows={8}
              className="font-mono text-sm"
              disabled={credentials.length === 0}
            />
            
            {credentials.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-2">Available credential keys:</p>
                <div className="flex flex-wrap gap-1">
                  {credentials
                    .filter(cred => cred.credential_key.trim())
                    .map((cred, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {cred.credential_key}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {credentials.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Add credentials above to enable the login template feature.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
