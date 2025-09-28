'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Get backend URL from environment variables (same pattern as api.ts)
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface TokenData {
  resights_token?: string;
  redata_token?: string;
  has_any_tokens: boolean;
}

interface TokenManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTokensUpdated?: () => void;
}

export function TokenManagementModal({ 
  open, 
  onOpenChange, 
  onTokensUpdated 
}: TokenManagementModalProps) {
  const [tokens, setTokens] = useState<TokenData>({
    resights_token: '',
    redata_token: '',
    has_any_tokens: false
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showResightsToken, setShowResightsToken] = useState(false);
  const [showRedataToken, setShowRedataToken] = useState(false);

  // Load tokens when modal opens
  useEffect(() => {
    if (open) {
      loadTokens();
    }
  }, [open]);

  const loadTokens = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        // Don't show error for missing auth, just set empty tokens
        setTokens({
          resights_token: '',
          redata_token: '',
          has_any_tokens: false
        });
        return;
      }

      if (!API_URL) {
        throw new Error('NEXT_PUBLIC_BACKEND_URL is not configured');
      }
      const response = await fetch(`${API_URL}/user/tokens`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // If 404 or similar, just set empty tokens instead of error
        if (response.status === 404) {
          setTokens({
            resights_token: '',
            redata_token: '',
            has_any_tokens: false
          });
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to load tokens');
      }

      const data = await response.json();
      setTokens(data);
    } catch (err) {
      // Only show error for actual network/server errors, not auth issues
      console.error('Token load error:', err);
      setTokens({
        resights_token: '',
        redata_token: '',
        has_any_tokens: false
      });
    } finally {
      setLoading(false);
    }
  };

  const saveTokens = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No authentication token found');
      }

      const requestBody = {
        resights_token: tokens.resights_token || null,
        redata_token: tokens.redata_token || null,
      };
      
      console.log('Sending token save request:', {
        url: '/api/user/tokens',
        method: 'PUT',
        hasResightsToken: !!tokens.resights_token,
        hasRedataToken: !!tokens.redata_token,
        hasAuthToken: !!session.access_token
      });

      // First test the basic API endpoint
      if (!API_URL) {
        throw new Error('NEXT_PUBLIC_BACKEND_URL is not configured');
      }
      const basicTestResponse = await fetch(`${API_URL}/test`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Basic API test response:', {
        status: basicTestResponse.status,
        ok: basicTestResponse.ok,
        contentType: basicTestResponse.headers.get('content-type')
      });
      
      if (!basicTestResponse.ok) {
        const testText = await basicTestResponse.text();
        console.error('Basic API test failed:', testText);
        throw new Error(`Basic API not available: ${basicTestResponse.status}`);
      }

      // Then test the user tokens endpoint
      const testResponse = await fetch(`${API_URL}/user/tokens/test`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('User tokens test endpoint response:', {
        status: testResponse.status,
        ok: testResponse.ok,
        contentType: testResponse.headers.get('content-type')
      });
      
      if (!testResponse.ok) {
        const testText = await testResponse.text();
        console.error('User tokens test endpoint failed:', testText);
        throw new Error(`User tokens API endpoint not available: ${testResponse.status}`);
      }

      const response = await fetch(`${API_URL}/user/tokens`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = `Failed to save tokens (${response.status})`;
        const contentType = response.headers.get('content-type');
        console.error('Response details:', {
          status: response.status,
          contentType: contentType,
          ok: response.ok
        });
        
        try {
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            console.error('Save tokens error response:', errorData);
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } else {
            const responseText = await response.text();
            console.error('Non-JSON response:', responseText);
            if (responseText.includes('<!DOCTYPE')) {
              errorMessage = 'Server returned HTML error page - API endpoint may not be available';
            } else {
              errorMessage = responseText || errorMessage;
            }
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          const responseText = await response.text().catch(() => '');
          console.error('Raw response text:', responseText);
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setTokens(data);
      setSuccess(true);
      
      // Notify parent component
      if (onTokensUpdated) {
        onTokensUpdated();
      }

      // Dispatch custom event to notify other components (like TokenWarningIndicator)
      window.dispatchEvent(new CustomEvent('tokensUpdated'));

      // Auto-close after success
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tokens');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onOpenChange(false);
    }
  };

  const handleInputChange = (field: 'resights_token' | 'redata_token', value: string) => {
    setTokens(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connect to Resights/Redata</DialogTitle>
          <DialogDescription>
            Configure your API tokens for external data services. These tokens are encrypted and stored securely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Tokens saved successfully!</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading tokens...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resights-token">Resights Token</Label>
                <div className="relative">
                  <Input
                    id="resights-token"
                    type={showResightsToken ? "text" : "password"}
                    placeholder="Enter your Resights API token"
                    value={tokens.resights_token || ''}
                    onChange={(e) => handleInputChange('resights_token', e.target.value)}
                    disabled={saving}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowResightsToken(!showResightsToken)}
                    disabled={saving}
                  >
                    {showResightsToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your Resights API token for accessing property data
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="redata-token">Redata Token</Label>
                <div className="relative">
                  <Input
                    id="redata-token"
                    type={showRedataToken ? "text" : "password"}
                    placeholder="Enter your Redata API token"
                    value={tokens.redata_token || ''}
                    onChange={(e) => handleInputChange('redata_token', e.target.value)}
                    disabled={saving}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowRedataToken(!showRedataToken)}
                    disabled={saving}
                  >
                    {showRedataToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your Redata API token for accessing property data
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={saving}
          >
            Close
          </Button>
          <Button
            onClick={saveTokens}
            disabled={saving || loading}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save and Continue'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
