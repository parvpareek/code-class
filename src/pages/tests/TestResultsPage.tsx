import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Progress } from '../../components/ui/progress';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  TrophyIcon,
  BarChartIcon,
  CodeIcon,
  ArrowLeftIcon,
  AlertTriangleIcon
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { getAuthToken } from '../../lib/authTokenStorage';

interface Problem {
  id: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  order: number;
}

interface TestCase {
  testCaseId: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  status: string;
  passed: boolean;
  time: number;
  memory: number;
}

interface Submission {
  id: string;
  problemId: string;
  code: string;
  language: string;
  status: string;
  score: number;
  executionTime: number;
  memoryUsed: number;
  submittedAt: string;
  judgeResponse?: {
    testCases: TestCase[];
    summary: {
      totalTestCases: number;
      passedTestCases: number;
      totalScore: number;
      allPassed: boolean;
    };
  };
  problem: Problem;
}

interface TestSession {
  id: string;
  status: string;
  penaltyCount: number;
  startedAt: string;
  submittedAt?: string;
  totalScore: number;
  maxScore: number;
  submissions: Submission[];
}

interface Test {
  id: string;
  title: string;
  duration: number;
  problems: Problem[];
}

const TestResultsPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [test, setTest] = useState<Test | null>(null);
  const [session, setSession] = useState<TestSession | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize results
  useEffect(() => {
    const fetchResults = async () => {
      try {
        const token = getAuthToken();
        
        // Fetch test details
        const testResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'}/tests/${testId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!testResponse.ok) {
          throw new Error('Failed to fetch test details');
        }
        
        const testData = await testResponse.json();
        setTest(testData.test);

        // Fetch session results
        const sessionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'}/test-sessions/${testId}/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!sessionResponse.ok) {
          throw new Error('Failed to fetch session results');
        }
        
        const sessionData = await sessionResponse.json();
        setSession(sessionData.session);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch results:', error);
        toast({
          title: 'Error',
          description: 'Failed to load test results.',
          variant: 'destructive'
        });
        navigate('/dashboard');
      }
    };

    if (testId) {
      fetchResults();
    }
  }, [testId, navigate, toast]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading test results...</div>
        </div>
      </div>
    );
  }

  if (!test || !session) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Test Results</h2>
          <p className="mb-4">Results will be available after the test is completed and graded.</p>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Calculate overall statistics
  const totalProblems = test.problems.length;
  const solvedProblems = session.submissions.filter(s => s.status === 'ACCEPTED').length;
  const partialProblems = session.submissions.filter(s => s.status === 'PARTIAL').length;
  const overallScore = session.submissions.reduce((sum, s) => sum + s.score, 0);
  const maxPossibleScore = totalProblems * 100;
  const scorePercentage = maxPossibleScore > 0 ? (overallScore / maxPossibleScore) * 100 : 0;

  // Performance grade
  const getGrade = (percentage: number): { grade: string; color: string } => {
    if (percentage >= 90) return { grade: 'A+', color: 'text-gray-600' };
    if (percentage >= 80) return { grade: 'A', color: 'text-green-500' };
    if (percentage >= 70) return { grade: 'B', color: 'text-blue-500' };
    if (percentage >= 60) return { grade: 'C', color: 'text-yellow-500' };
    if (percentage >= 50) return { grade: 'D', color: 'text-orange-500' };
    return { grade: 'F', color: 'text-red-500' };
  };

  const grade = getGrade(scorePercentage);

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{test.title}</h1>
            <p className="text-gray-600">Test Results</p>
          </div>
        </div>

        {/* Overall Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Overall Score</p>
                  <p className="text-2xl font-bold">{Math.round(scorePercentage)}%</p>
                </div>
                <div className={`text-4xl font-bold ${grade.color}`}>
                  {grade.grade}
                </div>
              </div>
              <Progress value={scorePercentage} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Problems Solved</p>
                  <p className="text-2xl font-bold text-gray-600">{solvedProblems}</p>
                  <p className="text-xs text-gray-500">out of {totalProblems}</p>
                </div>
                <CheckCircleIcon className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Partial Solutions</p>
                  <p className="text-2xl font-bold text-yellow-600">{partialProblems}</p>
                </div>
                <AlertTriangleIcon className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Penalties</p>
                  <p className="text-2xl font-bold text-red-600">{session.penaltyCount}</p>
                </div>
                <XCircleIcon className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="details">Detailed Results</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Test Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrophyIcon className="h-5 w-5" />
                  Test Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Test Duration:</span>
                    <span>{test.duration} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Started At:</span>
                    <span>{new Date(session.startedAt).toLocaleString()}</span>
                  </div>
                  {session.submittedAt && (
                    <div className="flex justify-between">
                      <span className="font-medium">Submitted At:</span>
                      <span>{new Date(session.submittedAt).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-medium">Status:</span>
                    <Badge variant={session.status === 'SUBMITTED' ? 'default' : 'secondary'}>
                      {session.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Total Score:</span>
                    <span className="font-bold">{overallScore} / {maxPossibleScore}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Problem Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChartIcon className="h-5 w-5" />
                  Problem Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {test.problems.map((problem, index) => {
                    const submission = session.submissions.find(s => s.problemId === problem.id);
                    const score = submission?.score || 0;
                    
                    return (
                      <div key={problem.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{index + 1}. {problem.title}</span>
                            <Badge 
                              variant={
                                problem.difficulty === 'EASY' ? 'default' :
                                problem.difficulty === 'MEDIUM' ? 'secondary' : 'destructive'
                              }
                            >
                              {problem.difficulty}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{score}%</span>
                            {submission ? (
                              submission.status === 'ACCEPTED' ? (
                                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                              ) : submission.status === 'PARTIAL' ? (
                                <AlertTriangleIcon className="h-4 w-4 text-yellow-500" />
                              ) : (
                                <XCircleIcon className="h-4 w-4 text-red-500" />
                              )
                            ) : (
                              <XCircleIcon className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </div>
                        <Progress value={score} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>Submission History</CardTitle>
              <CardDescription>
                Detailed view of all your submissions during the test
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {session.submissions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No submissions found.</p>
                ) : (
                  session.submissions.map((submission) => (
                    <div 
                      key={submission.id} 
                      className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => setSelectedSubmission(submission)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <CodeIcon className="h-5 w-5" />
                          <div>
                            <span className="font-medium">{submission.problem.title}</span>
                            <div className="text-sm text-gray-500">
                              Language: {submission.language.toUpperCase()} • 
                              Submitted: {new Date(submission.submittedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={
                              submission.status === 'ACCEPTED' ? 'default' :
                              submission.status === 'PARTIAL' ? 'secondary' : 'destructive'
                            }
                          >
                            {submission.score}% - {submission.status}
                          </Badge>
                          <div className="text-sm text-gray-500 mt-1">
                            {submission.executionTime.toFixed(3)}s • {submission.memoryUsed}KB
                          </div>
                        </div>
                      </div>
                      
                      {submission.judgeResponse && (
                        <div className="text-sm text-gray-600">
                          Test Cases: {submission.judgeResponse.summary.passedTestCases} / {submission.judgeResponse.summary.totalTestCases} passed
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          {selectedSubmission ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Detailed Results: {selectedSubmission.problem.title}
                </CardTitle>
                <CardDescription>
                  Test case breakdown and execution details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Submission Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-black rounded">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedSubmission.score}%</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Overall Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedSubmission.executionTime.toFixed(3)}s</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Execution Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedSubmission.memoryUsed}KB</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Memory Used</div>
                    </div>
                  </div>

                  {/* Test Cases */}
                  {selectedSubmission.judgeResponse && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Test Case Results</h3>
                      <div className="space-y-4">
                        {selectedSubmission.judgeResponse.testCases.map((testCase, index) => (
                          <div key={index} className="border rounded p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">Test Case {index + 1}</span>
                              <div className="flex items-center gap-2">
                                {testCase.passed ? (
                                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircleIcon className="h-4 w-4 text-red-500" />
                                )}
                                <Badge variant={testCase.passed ? 'default' : 'destructive'}>
                                  {testCase.status}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  {testCase.time.toFixed(3)}s • {testCase.memory}KB
                                </span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <strong>Input:</strong>
                                <pre className="mt-1 p-2 bg-gray-100 dark:bg-black rounded border border-gray-200 dark:border-gray-700 text-xs overflow-x-auto text-gray-900 dark:text-gray-100">
                                  {testCase.input}
                                </pre>
                              </div>
                              <div>
                                <strong>Expected Output:</strong>
                                <pre className="mt-1 p-2 bg-gray-100 dark:bg-black rounded border border-gray-200 dark:border-gray-700 text-xs overflow-x-auto text-gray-900 dark:text-gray-100">
                                  {testCase.expectedOutput}
                                </pre>
                              </div>
                              <div>
                                <strong>Your Output:</strong>
                                <pre className={`mt-1 p-2 rounded border text-xs overflow-x-auto text-gray-900 dark:text-gray-100 ${
                                  testCase.passed 
                                    ? 'bg-green-50 dark:bg-green-900/20 border-gray-200 dark:border-gray-700' 
                                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                }`}>
                                  {testCase.actualOutput || '(no output)'}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Code */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Submitted Code</h3>
                    <pre className="p-4 bg-gray-900 text-gray-100 rounded overflow-x-auto text-sm">
                      <code>{selectedSubmission.code}</code>
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">
                  Select a submission from the "Submissions" tab to view detailed results.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TestResultsPage; 
