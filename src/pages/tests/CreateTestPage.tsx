import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { 
  Plus, 
  Save, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Code, 
  Settings,
  Trash2,
  Edit,
  Eye,
  Link,
  Download,
  Loader2,
  Terminal
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { TestProblem, TestCase } from '../../components/tests/TestCard';
import TestCaseEditor from '../../components/tests/TestCaseEditor';
import { getAuthToken } from '../../lib/authTokenStorage';

interface TestFormData {
  title: string;
  description: string;
  classId: string;
  duration: number;
  startTime: string;
  endTime: string;
  problems: TestProblem[];
  allowedLanguages: string[];
  isActive: boolean;
}

const CreateTestPage: React.FC = () => {
  const navigate = useNavigate();
  const { classId } = useParams<{ classId?: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [formData, setFormData] = useState<TestFormData>({
    title: '',
    description: '',
    classId: classId || '',
    duration: 120,
    startTime: '',
    endTime: '',
    problems: [],
    allowedLanguages: ['python', 'cpp', 'java', 'javascript'],
    isActive: false
  });

  // Real classes data from API
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [judge0Stats, setJudge0Stats] = useState<{
    totalKeys: number;
    availableKeys: number;
    totalRequests: number;
    usedRequests: number;
  } | null>(null);

  // Function to import problem from LeetCode
  const importFromLeetCode = async () => {
    if (!importUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a LeetCode problem URL.',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    
    try {
      const token = getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'}/tests/import-leetcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url: importUrl })
      });

      if (response.ok) {
        const data = await response.json();
        const problemData = data.problem;

        // Create new problem with LeetCode data
        const newProblem: TestProblem = {
          id: `leetcode-${Date.now()}`,
          title: problemData.title,
          description: problemData.description,
          difficulty: problemData.difficulty,
          timeLimit: problemData.timeLimit,
          memoryLimit: problemData.memoryLimit,
          testCases: [],
          order: formData.problems.length + 1,
          constraints: problemData.constraints,
          examples: problemData.examples
        };

        // Add the problem to the form
        setFormData(prev => ({
          ...prev,
          problems: [...prev.problems, newProblem]
        }));

        // Clear the import URL
        setImportUrl('');

        toast({
          title: 'Success',
          description: `Successfully imported "${problemData.title}" from LeetCode!`,
        });

      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import problem from LeetCode');
      }
    } catch (error) {
      console.error('Error importing from LeetCode:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to import problem from LeetCode. Please check the URL and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Fetch classes on component mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const token = getAuthToken();
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'}/classes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setClasses(data.classes || []);
        }
      } catch (error) {
        console.error('Failed to fetch classes:', error);
      }
    };

    const fetchJudge0Stats = async () => {
      try {
        const token = getAuthToken();
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'}/judge0/pool-stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setJudge0Stats(data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch Judge0 stats:', error);
      }
    };

    fetchClasses();
    fetchJudge0Stats();

    // Set default start time to current IST time and calculate end time
    const istStartTime = getCurrentLocalTime();
    const istEndTime = calculateEndTime(istStartTime, 120); // Use the initial duration value
    
    setFormData(prev => ({
      ...prev,
      startTime: istStartTime,
      endTime: istEndTime
    }));
  }, []);

  // Helper function to get current time formatted for datetime-local input
  const getCurrentLocalTime = (): string => {
    const now = new Date();
    
    // Get IST time by creating a new date with Asia/Kolkata timezone
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const year = istTime.getFullYear();
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const day = String(istTime.getDate()).padStart(2, '0');
    const hours = String(istTime.getHours()).padStart(2, '0');
    const minutes = String(istTime.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper function to calculate end time
  const calculateEndTime = (startTime: string, duration: number): string => {
    if (!startTime || duration <= 0) return '';
    
    const start = new Date(startTime);
    if (isNaN(start.getTime())) return '';
    
    // Add duration in milliseconds
    const end = new Date(start.getTime() + (duration * 60 * 1000));
    
    // Format for datetime-local input
    const year = end.getFullYear();
    const month = String(end.getMonth() + 1).padStart(2, '0');
    const day = String(end.getDate()).padStart(2, '0');
    const hours = String(end.getHours()).padStart(2, '0');
    const minutes = String(end.getMinutes()).padStart(2, '0');
    
    const result = `${year}-${month}-${day}T${hours}:${minutes}`;

    return result;
  };

  const handleInputChange = (field: keyof TestFormData, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Recalculate end time whenever start time or duration changes
      const newStartTime = field === 'startTime' ? value : prev.startTime;
      const newDuration = field === 'duration' ? value : prev.duration;
      
      if (newStartTime && newDuration > 0) {
        updated.endTime = calculateEndTime(newStartTime, newDuration);
      }
      
      return updated;
    });
  };

  const addProblem = () => {
    const newProblem: TestProblem = {
      id: `temp-${Date.now()}`,
      title: '',
      description: '',
      difficulty: 'EASY',
      timeLimit: 30,
      memoryLimit: 256,
      testCases: [],
      order: formData.problems.length + 1,
      constraints: '',
      examples: ''
    };
    
    setFormData(prev => ({
      ...prev,
      problems: [...prev.problems, newProblem]
    }));
  };

  const updateProblem = (index: number, field: keyof TestProblem, value: any) => {
    setFormData(prev => ({
      ...prev,
      problems: prev.problems.map((problem, i) => 
        i === index ? { ...problem, [field]: value } : problem
      )
    }));
  };

  const removeProblem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      problems: prev.problems.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async (status: 'DRAFT' | 'SCHEDULED') => {
    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Test title is required.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.classId) {
      toast({
        title: 'Error',
        description: 'Please select a class.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.allowedLanguages.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one programming language.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.problems.length === 0) {
      toast({
        title: 'Error',
        description: 'At least one problem is required.',
        variant: 'destructive',
      });
      return;
    }

    // Validate that each problem has test cases
    for (let i = 0; i < formData.problems.length; i++) {
      const problem = formData.problems[i];
      if (!problem.title.trim()) {
        toast({
          title: 'Error',
          description: `Problem ${i + 1} title is required.`,
          variant: 'destructive',
        });
        return;
      }
      if (!problem.description.trim()) {
        toast({
          title: 'Error',
          description: `Problem ${i + 1} description is required.`,
          variant: 'destructive',
        });
        return;
      }
      if (!Array.isArray(problem.testCases) || problem.testCases.length === 0) {
        toast({
          title: 'Error',
          description: `Problem ${i + 1} needs at least one test case.`,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    
    try {
      const token = getAuthToken();
      
      // Prepare the data with proper datetime format and test case format
      const testData = {
        title: formData.title,
        description: formData.description,
        classId: formData.classId,
        duration: formData.duration,
        allowedLanguages: formData.allowedLanguages,
        // Convert datetime-local to proper ISO strings
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        isActive: status === 'SCHEDULED', // Set active only if scheduling
        problems: formData.problems.map(problem => ({
          title: problem.title,
          description: problem.description,
          constraints: problem.constraints || '',
          examples: problem.examples || '',
          difficulty: problem.difficulty,
          timeLimit: problem.timeLimit,
          memoryLimit: problem.memoryLimit,
          testCases: Array.isArray(problem.testCases) ? problem.testCases : [],
          order: problem.order
        }))
      };
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'}/tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(testData)
      });
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: `Test ${status === 'DRAFT' ? 'saved as draft' : 'scheduled'} successfully.`,
        });
        navigate('/tests');
      } else {
        const errorData = await response.json();

        if (errorData.details && Array.isArray(errorData.details)) {
          // Show specific validation errors
          const validationErrors = errorData.details.map((detail: any) => 
            `${detail.path.join('.')}: ${detail.message}`
          ).join('\n');
          throw new Error(`Validation errors:\n${validationErrors}`);
        }
        
        throw new Error(errorData.error || 'Failed to create test');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save test.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HARD': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Coding Test</h1>
          <p className="text-muted-foreground mt-1">
            Set up a new coding test for your students
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="basic">
                <Settings className="h-4 w-4 mr-2" />
                Basic Info
              </TabsTrigger>
              <TabsTrigger value="timing">
                <Calendar className="h-4 w-4 mr-2" />
                Timing
              </TabsTrigger>
              <TabsTrigger value="problems">
                <Code className="h-4 w-4 mr-2" />
                Problems ({formData.problems.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Test Information</CardTitle>
                  <CardDescription>
                    Basic details about your coding test
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">Test Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="e.g., Data Structures Fundamentals"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describe what this test covers..."
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="class">Class *</Label>
                    <Select 
                      value={formData.classId} 
                      onValueChange={(value) => handleInputChange('classId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="allowedLanguages">Allowed Programming Languages *</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {[
                        { value: 'python', label: 'Python' },
                        { value: 'cpp', label: 'C++' },
                        { value: 'java', label: 'Java' },
                        { value: 'javascript', label: 'JavaScript' },
                        { value: 'c', label: 'C' },
                        { value: 'go', label: 'Go' }
                      ].map((lang) => (
                        <div key={lang.value} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={lang.value}
                            checked={formData.allowedLanguages.includes(lang.value)}
                            onChange={(e) => {
                              const newLanguages = e.target.checked
                                ? [...formData.allowedLanguages, lang.value]
                                : formData.allowedLanguages.filter(l => l !== lang.value);
                              handleInputChange('allowedLanguages', newLanguages);
                            }}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor={lang.value} className="text-sm font-normal">
                            {lang.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Test Timing</CardTitle>
                  <CardDescription>
                    Configure when the test will be available and how long it will last
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="duration">Duration (minutes) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={formData.duration}
                      onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 0)}
                      min="1"
                      max="480"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startTime">Start Time *</Label>
                      <Input
                        id="startTime"
                        type="datetime-local"
                        value={formData.startTime}
                        onChange={(e) => handleInputChange('startTime', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="endTime">End Time (Auto-calculated)</Label>
                      <Input
                        id="endTime"
                        type="datetime-local"
                        value={formData.endTime}
                        disabled
                      />
                    </div>
                  </div>
                  
                  <div className={`p-4 rounded-lg ${
                    formData.startTime && formData.endTime && new Date(formData.endTime) <= new Date(formData.startTime)
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      : 'bg-gray-50 dark:bg-gray-800/20 border border-gray-200 dark:border-gray-700'
                  }`}>
                    <div className={`flex items-center gap-2 ${
                      formData.startTime && formData.endTime && new Date(formData.endTime) <= new Date(formData.startTime)
                        ? 'text-red-800 dark:text-red-300'
                        : 'text-blue-800 dark:text-blue-300'
                    }`}>
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">Test Schedule</span>
                      {formData.startTime && formData.endTime && new Date(formData.endTime) <= new Date(formData.startTime) && (
                        <span className="text-xs bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded">⚠️ Invalid Time Range</span>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${
                      formData.startTime && formData.endTime && new Date(formData.endTime) <= new Date(formData.startTime)
                        ? 'text-red-700'
                        : 'text-blue-700'
                    }`}>
                      Students will be able to join the test from{' '}
                      <strong>{formData.startTime ? new Date(formData.startTime).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Kolkata'
                      }) : 'Not set'}</strong>
                      {' '}to{' '}
                      <strong>{formData.endTime ? new Date(formData.endTime).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Kolkata'
                      }) : 'Not set'}</strong>
                      {' '}(Duration: <strong>{formData.duration} minutes</strong>) IST.
                    </p>
                    {formData.startTime && formData.endTime && new Date(formData.endTime) <= new Date(formData.startTime) && (
                      <p className="text-xs text-red-600 mt-2">
                        ⚠️ End time must be after start time. Please check your duration or start time.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="problems" className="space-y-6">
              {/* LeetCode Import Section */}
              <Card className="border-dashed border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Link className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    <CardTitle className="text-lg text-orange-800 dark:text-orange-200">Import from LeetCode</CardTitle>
                  </div>
                  <CardDescription className="text-orange-700 dark:text-orange-300">
                    Paste a LeetCode problem URL to automatically import problem details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="https://leetcode.com/problems/two-sum/"
                      className="flex-1"
                      disabled={isImporting}
                    />
                    <Button 
                      onClick={importFromLeetCode}
                      disabled={isImporting || !importUrl.trim()}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {isImporting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      {isImporting ? 'Importing...' : 'Import'}
                    </Button>
                  </div>
                  <p className="text-xs text-orange-600 mt-2">
                    Supports LeetCode problem URLs. The problem details will be automatically filled in the form below.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Test Problems</CardTitle>
                    <CardDescription>
                      Add coding problems for students to solve
                    </CardDescription>
                  </div>
                  <Button onClick={addProblem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Problem
                  </Button>
                </CardHeader>
                <CardContent>
                  {formData.problems.length === 0 ? (
                    <div className="text-center py-8">
                      <Code className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No problems yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Add your first problem manually or import from LeetCode
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button onClick={addProblem} variant="outline">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Manually
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {formData.problems.map((problem, index) => (
                        <Card key={problem.id} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground">
                                  Problem {index + 1}
                                </span>
                                <Badge className={getDifficultyColor(problem.difficulty)}>
                                  {problem.difficulty}
                                </Badge>
                                {problem.id.startsWith('leetcode-') && (
                                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                                    <Link className="mr-1 h-3 w-3" />
                                    LeetCode
                                  </Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeProblem(index)}
                                className="h-8 w-8 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <Label>Problem Title *</Label>
                              <Input
                                value={problem.title}
                                onChange={(e) => updateProblem(index, 'title', e.target.value)}
                                placeholder="e.g., Two Sum"
                              />
                            </div>
                            
                            <div>
                              <Label>Problem Description *</Label>
                              <Textarea
                                value={problem.description}
                                onChange={(e) => updateProblem(index, 'description', e.target.value)}
                                placeholder="Describe the problem clearly. What should the function do?"
                                rows={4}
                              />
                            </div>

                            <div>
                              <Label>Constraints</Label>
                              <Textarea
                                value={problem.constraints || ''}
                                onChange={(e) => updateProblem(index, 'constraints', e.target.value)}
                                placeholder="e.g., 1 ≤ n ≤ 10^5, -10^9 ≤ nums[i] ≤ 10^9"
                                rows={2}
                              />
                            </div>

                            <div>
                              <Label>Examples</Label>
                              <Textarea
                                value={problem.examples || ''}
                                onChange={(e) => updateProblem(index, 'examples', e.target.value)}
                                placeholder="Example 1:&#10;Input: nums = [2,7,11,15], target = 9&#10;Output: [0,1]&#10;Explanation: Because nums[0] + nums[1] == 9, we return [0, 1]."
                                rows={3}
                              />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <Label>Difficulty</Label>
                                <Select 
                                  value={problem.difficulty} 
                                  onValueChange={(value) => updateProblem(index, 'difficulty', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="EASY">Easy</SelectItem>
                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                    <SelectItem value="HARD">Hard</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <Label>Time Limit (min)</Label>
                                <Input
                                  type="number"
                                  value={problem.timeLimit}
                                  onChange={(e) => updateProblem(index, 'timeLimit', parseInt(e.target.value) || 0)}
                                  min="1"
                                  max="120"
                                />
                              </div>
                              
                              <div>
                                <Label>Memory Limit (MB)</Label>
                                <Input
                                  type="number"
                                  value={problem.memoryLimit}
                                  onChange={(e) => updateProblem(index, 'memoryLimit', parseInt(e.target.value) || 0)}
                                  min="1"
                                  max="1024"
                                />
                              </div>
                            </div>

                            {/* Test Cases Editor */}
                            <div className="mt-6">
                              <TestCaseEditor
                                testCases={Array.isArray(problem.testCases) ? problem.testCases : []}
                                onTestCasesChange={(testCases) => updateProblem(index, 'testCases', testCases)}
                                problemTitle={problem.title}
                                problemDescription={problem.description}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Judge0 Pool Status */}
          <Card className="border-gray-200 bg-gray-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="h-5 w-5 text-blue-600" />
                Judge0 Pool Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {judge0Stats ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active API Keys:</span>
                    <span className="font-medium">{judge0Stats.availableKeys} / {judge0Stats.totalKeys}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pool Requests:</span>
                    <span className="font-medium">{judge0Stats.totalRequests - judge0Stats.usedRequests} / {judge0Stats.totalRequests}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className={`text-xs px-2 py-1 rounded ${
                      judge0Stats.availableKeys > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {judge0Stats.availableKeys > 0 
                        ? `✅ ${judge0Stats.availableKeys} keys ready for execution`
                        : '⚠️ No API keys available'
                      }
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground">
                  Loading pool status...
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={() => handleSave('DRAFT')} 
                variant="outline" 
                className="w-full"
                disabled={isLoading}
              >
                <Save className="mr-2 h-4 w-4" />
                Save as Draft
              </Button>
              
              <Button 
                onClick={() => handleSave('SCHEDULED')} 
                className="w-full"
                disabled={isLoading}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Schedule Test
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Test Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span>{formData.duration} minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Problems:</span>
                <span>{formData.problems.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Class:</span>
                <span>{classes.find(c => c.id === formData.classId)?.name || 'Not selected'}</span>
              </div>
              {formData.startTime && (
                <div className="pt-2 border-t">
                  <div className="text-muted-foreground mb-1">Scheduled for:</div>
                  <div className="text-xs">
                    {new Date(formData.startTime).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateTestPage; 
