import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { useToast } from '../../hooks/use-toast';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Copy, 
  CheckCircle, 
  AlertTriangle,
  Loader2,
  KeyRound
} from 'lucide-react';
import { Switch } from '../ui/switch';
import { getAuthToken } from '../../lib/authTokenStorage';

interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isPublic: boolean;
  explanation?: string;
}

interface TestCaseEditorProps {
  testCases: TestCase[];
  onTestCasesChange: (testCases: TestCase[]) => void;
  problemTitle: string;
  problemDescription: string;
}

const TestCaseEditor: React.FC<TestCaseEditorProps> = ({
  testCases,
  onTestCasesChange,
  problemTitle,
  problemDescription
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('cases');
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null);

  // Check if teacher has Gemini API key on component mount
  React.useEffect(() => {
    const checkGeminiKey = async () => {
      if (user?.role !== 'TEACHER') return;
      
      try {
        const token = getAuthToken();
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'}/auth/gemini-key`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setHasGeminiKey(data.hasKey && data.status === 'ACTIVE');
        } else {
          setHasGeminiKey(false);
        }
      } catch (error) {
        console.error('Error checking Gemini key:', error);
        setHasGeminiKey(false);
      }
    };

    checkGeminiKey();
  }, [user]);

  const addTestCase = () => {
    const newTestCase: TestCase = {
      id: `test-case-${Date.now()}`,
      input: '',
      expectedOutput: '',
      isPublic: false,
      explanation: ''
    };
    onTestCasesChange([...testCases, newTestCase]);
  };

  const updateTestCase = (id: string, field: keyof TestCase, value: any) => {
    const updated = testCases.map(tc => 
      tc.id === id ? { ...tc, [field]: value } : tc
    );
    onTestCasesChange(updated);
  };

  const removeTestCase = (id: string) => {
    onTestCasesChange(testCases.filter(tc => tc.id !== id));
  };

  const duplicateTestCase = (id: string) => {
    const testCase = testCases.find(tc => tc.id === id);
    if (testCase) {
      const duplicated: TestCase = {
        ...testCase,
        id: `test-case-${Date.now()}`,
        isPublic: false // Duplicated cases are private by default
      };
      onTestCasesChange([...testCases, duplicated]);
    }
  };

  const generateTestCases = async () => {
    if (!problemTitle.trim() || !problemDescription.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide problem title and description before generating test cases.',
        variant: 'destructive'
      });
      return;
    }

    // Check if Gemini API key is configured
    if (hasGeminiKey === false) {
      toast({
        title: 'API Key Not Configured',
        description: 'Please configure your Gemini API key in your profile settings to use AI test case generation.',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'}/tests/generate-test-cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          title: problemTitle,
          description: problemDescription,
          existingTestCases: testCases
        })
      });

      if (response.ok) {
        const data = await response.json();
        const generatedCases: TestCase[] = data.testCases.map((tc: any, index: number) => ({
          id: `generated-${Date.now()}-${index}`,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isPublic: tc.isPublic || false,
          explanation: tc.explanation || ''
        }));

        onTestCasesChange([...testCases, ...generatedCases]);
        toast({
          title: 'Success',
          description: `Generated ${generatedCases.length} comprehensive test cases including edge cases.`,
        });
      } else {
        const errorData = await response.json();
        if (errorData.error && errorData.error.includes('API key')) {
          toast({
            title: 'API Key Not Configured',
            description: 'Please configure your Gemini API key in your profile settings to use AI test case generation.',
            variant: 'destructive'
          });
        } else {
          throw new Error(errorData.error || 'Failed to generate test cases');
        }
      }
    } catch (error) {
      console.error('Error generating test cases:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate test cases. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const publicTestCases = testCases.filter(tc => tc.isPublic);
  const privateTestCases = testCases.filter(tc => !tc.isPublic);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Test Cases</CardTitle>
              <CardDescription>
                Create comprehensive test cases to evaluate code submissions
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={addTestCase} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Test Case
              </Button>
              <Button 
                onClick={generateTestCases} 
                disabled={isGenerating || hasGeminiKey === false}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : hasGeminiKey === false ? (
                  <KeyRound className="mr-2 h-4 w-4" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {isGenerating ? 'Generating...' : hasGeminiKey === false ? 'API Key Required' : 'Generate with AI'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {testCases.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              <CheckCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No test cases yet</h3>
              <p className="text-gray-600 mb-4">
                Add test cases manually or use AI to generate comprehensive test cases
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={addTestCase} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Manually
                </Button>
                <Button 
                  onClick={generateTestCases} 
                  disabled={isGenerating || hasGeminiKey === false}
                  className={hasGeminiKey === false ? 'opacity-50' : ''}
                >
                  {hasGeminiKey === false ? (
                    <KeyRound className="mr-2 h-4 w-4" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {hasGeminiKey === false ? 'API Key Required' : 'Generate with AI'}
                </Button>
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="cases">All Cases ({testCases.length})</TabsTrigger>
                <TabsTrigger value="public">Public ({publicTestCases.length})</TabsTrigger>
                <TabsTrigger value="private">Private ({privateTestCases.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="cases" className="space-y-4 mt-4">
                <div className="space-y-4">
                  {testCases.map((testCase, index) => (
                    <TestCaseItem
                      key={testCase.id}
                      testCase={testCase}
                      index={index}
                      onUpdate={updateTestCase}
                      onRemove={removeTestCase}
                      onDuplicate={duplicateTestCase}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="public" className="space-y-4 mt-4">
                <Alert>
                  <Eye className="h-4 w-4" />
                  <AlertDescription>
                    Public test cases are visible to students as examples. Use these to help students understand the problem.
                  </AlertDescription>
                </Alert>
                {publicTestCases.map((testCase, index) => (
                  <TestCaseItem
                    key={testCase.id}
                    testCase={testCase}
                    index={index}
                    onUpdate={updateTestCase}
                    onRemove={removeTestCase}
                    onDuplicate={duplicateTestCase}
                  />
                ))}
              </TabsContent>

              <TabsContent value="private" className="space-y-4 mt-4">
                <Alert>
                  <EyeOff className="h-4 w-4" />
                  <AlertDescription>
                    Private test cases are hidden from students and used for evaluation. Include edge cases and boundary conditions.
                  </AlertDescription>
                </Alert>
                {privateTestCases.map((testCase, index) => (
                  <TestCaseItem
                    key={testCase.id}
                    testCase={testCase}
                    index={index}
                    onUpdate={updateTestCase}
                    onRemove={removeTestCase}
                    onDuplicate={duplicateTestCase}
                  />
                ))}
              </TabsContent>
            </Tabs>
          )}

          {testCases.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Test Case Summary</h4>
              <div className="flex flex-wrap gap-4 text-sm text-blue-800">
                <div>Total: {testCases.length}</div>
                <div>Public: {publicTestCases.length}</div>
                <div>Private: {privateTestCases.length}</div>
                <div>
                  Coverage: {testCases.length >= 10 ? 'Comprehensive' : testCases.length >= 5 ? 'Good' : 'Basic'}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface TestCaseItemProps {
  testCase: TestCase;
  index: number;
  onUpdate: (id: string, field: keyof TestCase, value: any) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const TestCaseItem: React.FC<TestCaseItemProps> = ({ 
  testCase, 
  index, 
  onUpdate, 
  onRemove, 
  onDuplicate 
}) => {
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">Test Case {index + 1}</span>
            <Badge variant={testCase.isPublic ? 'default' : 'secondary'}>
              {testCase.isPublic ? 'Public' : 'Private'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <Switch
                checked={testCase.isPublic}
                onCheckedChange={(checked) => onUpdate(testCase.id, 'isPublic', checked)}
              />
              <Label className="text-sm">Public</Label>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDuplicate(testCase.id)}
              className="h-8 w-8"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(testCase.id)}
              className="h-8 w-8 text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Input</Label>
            <Textarea
              value={testCase.input}
              onChange={(e) => onUpdate(testCase.id, 'input', e.target.value)}
              placeholder="Enter input data..."
              rows={3}
              className="font-mono text-sm"
            />
          </div>
          <div>
            <Label>Expected Output</Label>
            <Textarea
              value={testCase.expectedOutput}
              onChange={(e) => onUpdate(testCase.id, 'expectedOutput', e.target.value)}
              placeholder="Enter expected output..."
              rows={3}
              className="font-mono text-sm"
            />
          </div>
        </div>
        
        <div>
          <Label>Explanation (Optional)</Label>
          <Textarea
            value={testCase.explanation || ''}
            onChange={(e) => onUpdate(testCase.id, 'explanation', e.target.value)}
            placeholder="Explain what this test case validates..."
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default TestCaseEditor; 