import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { 
  Sparkles, 
  Key, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  ExternalLink,
  Lightbulb
} from 'lucide-react';
import { getAuthToken } from '../../lib/authTokenStorage';

interface GeminiStatus {
  hasKey: boolean;
  keyStatus: string;
}

interface GeminiKeySectionProps {
  onKeyUpdate?: () => void;
}

const GeminiKeySection: React.FC<GeminiKeySectionProps> = ({ onKeyUpdate }) => {
  const [status, setStatus] = useState<GeminiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch current Gemini status
  const fetchStatus = async () => {
    try {
      const token = getAuthToken();
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
      const response = await fetch(`${apiBaseUrl}/auth/gemini-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else if (response.status === 403) {
        // Not a teacher, don't show this section
        setStatus(null);
      } else {
        setError('Failed to fetch Gemini key status');
      }
    } catch (err) {
      setError('Error fetching Gemini key status');
    } finally {
      setLoading(false);
    }
  };

  // Add or update Gemini API key
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const token = getAuthToken();
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
      const response = await fetch(`${apiBaseUrl}/auth/gemini-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ apiKey })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setShowForm(false);
        setApiKey('');
        await fetchStatus(); // Refresh status
        onKeyUpdate?.();
      } else {
        setError(data.message || 'Failed to add Gemini API key');
      }
    } catch (err) {
      setError('Error adding Gemini API key');
    } finally {
      setSubmitting(false);
    }
  };

  // Remove Gemini API key
  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove your Gemini API key? This will disable AI-powered test case generation.')) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const token = getAuthToken();
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
      const response = await fetch(`${apiBaseUrl}/auth/gemini-key`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        await fetchStatus(); // Refresh status
        onKeyUpdate?.();
      } else {
        setError(data.message || 'Failed to remove Gemini API key');
      }
    } catch (err) {
      setError('Error removing Gemini API key');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusIcon = (keyStatus: string) => {
    switch (keyStatus) {
      case 'ACTIVE':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'INVALID':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (keyStatus: string) => {
    switch (keyStatus) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Active</Badge>;
      case 'INVALID':
        return <Badge variant="destructive">Invalid</Badge>;
      default:
        return <Badge variant="secondary">Not Provided</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Gemini AI Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse">Loading Gemini status...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't render if not a teacher (but show if there's an error, as it might be an auth/network issue)
  if (!status && !error) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Gemini AI Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted border border-border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-purple-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-purple-900 mb-1">AI-Powered Test Case Generation</h3>
              <p className="text-sm text-purple-700">
                Provide your Gemini API key to enable automatic test case generation for coding problems using AI
              </p>
            </div>
          </div>
        </div>

        {/* Error Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Messages */}
        {success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        {/* Current Status */}
        {status && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(status.keyStatus)}
              <div>
                <p className="font-medium">API Key Status</p>
                <p className="text-sm text-gray-600">
                  {status.hasKey ? 'Your Gemini API key is configured' : 'No API key provided'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(status.keyStatus)}
              {status.hasKey ? (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowForm(!showForm)}
                  >
                    <Key className="h-4 w-4 mr-1" />
                    Update Key
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleRemove}
                    disabled={submitting}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={() => setShowForm(!showForm)}
                  size="sm"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  Add API Key
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Show default status if we have an error but no status */}
        {error && !status && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <XCircle className="h-4 w-4 text-gray-400" />
              <div>
                <p className="font-medium">API Key Status</p>
                <p className="text-sm text-gray-600">Unable to fetch status - you can still add your API key</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">Unknown</Badge>
              <Button 
                onClick={() => setShowForm(!showForm)}
                size="sm"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Add API Key
              </Button>
            </div>
          </div>
        )}

        {/* Add Key Form */}
        {showForm && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="apiKey">Gemini API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your Google AI Studio API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  minLength={20}
                />
                <p className="text-xs text-gray-600 mt-1">
                  Get your API key from Google AI Studio (free tier: 15 requests/minute)
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Validating...' : 'Save API Key'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">How to get your Gemini API key:</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">Google AI Studio <ExternalLink className="h-3 w-3" /></a></li>
            <li>Sign in with your Google account</li>
            <li>Click "Create API Key" button</li>
            <li>Copy the generated API key</li>
            <li>Paste it in the form above</li>
          </ol>
          <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-700">
            <strong>Note:</strong> The free tier includes 15 requests per minute, which is sufficient for generating test cases for your coding problems.
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h4 className="font-medium text-sm">Smart Test Generation</h4>
              <p className="text-xs text-gray-600">AI generates comprehensive test cases including edge cases</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Lightbulb className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium text-sm">Problem Analysis</h4>
              <p className="text-xs text-gray-600">Automatically analyzes problem complexity and constraints</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GeminiKeySection; 