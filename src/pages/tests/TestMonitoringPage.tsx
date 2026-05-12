import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Progress } from '../../components/ui/progress';
import { 
  UsersIcon, 
  ClockIcon, 
  PlayIcon, 
  PauseIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  DownloadIcon,
  RefreshCwIcon,
  ServerIcon
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { getAuthToken } from '../../lib/authTokenStorage';
import { io, Socket } from 'socket.io-client';
import ViolationMonitoringPanel from '../../components/test/ViolationMonitoringPanel';

interface Student {
  id: string;
  name: string;
  email: string;
  sessionId?: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED';
  joinedAt?: string;
  lastActivity?: string;
  penaltyCount: number;
  problemsAttempted: number;
  currentProblemIndex: number;
  submissions: Array<{
    id: string;
    problemId: string;
    status: string;
    score: number;
    submittedAt: string;
  }>;
}

interface Test {
  id: string;
  title: string;
  duration: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  problems: Array<{
    id: string;
    title: string;
    difficulty: string;
    order: number;
  }>;
}

interface BatchStatus {
  testId: string;
  queueSize: number;
  processing: boolean;
  totalSubmissions: number;
  processedSubmissions: number;
}

const TestMonitoringPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);

  // State
  const [test, setTest] = useState<Test | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [activeStudents, setActiveStudents] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [selectedTab, setSelectedTab] = useState('overview');

  // Initialize monitoring
  useEffect(() => {
    const initializeMonitoring = async () => {
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

        // Calculate time left
        const endTime = new Date(testData.test.endTime).getTime();
        const now = new Date().getTime();
        setTimeLeft(Math.max(0, Math.floor((endTime - now) / 1000)));

        // Fetch student sessions
        await fetchStudentSessions();
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize monitoring:', error);
        toast({
          title: 'Error',
          description: 'Failed to load test monitoring data.',
          variant: 'destructive'
        });
        navigate('/dashboard');
      }
    };

    if (testId) {
      initializeMonitoring();
    }
  }, [testId, navigate, toast]);

  // Fetch student sessions
  const fetchStudentSessions = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'}/tests/${testId}/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStudents(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch student sessions:', error);
    }
  };

  // Setup WebSocket connection
  useEffect(() => {
    const token = getAuthToken();
    if (!token || !testId) return;

    const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:4000', {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-test-monitor', { testId });
    });

    // Real-time updates
    socket.on('student-joined', (data) => {
      setActiveStudents(prev => prev + 1);
      fetchStudentSessions();
      toast({
        title: 'Student Joined',
        description: `${data.userName} joined the test`,
        variant: 'default'
      });
    });

    socket.on('student-left', (data) => {
      setActiveStudents(prev => Math.max(0, prev - 1));
      fetchStudentSessions();
    });

    socket.on('submission-update', (data) => {
      fetchStudentSessions();
    });

    socket.on('penalty-occurred', (data) => {
      fetchStudentSessions();
      toast({
        title: 'Penalty Recorded',
        description: `${data.type} penalty for student in session ${data.sessionId}`,
        variant: 'destructive'
      });
    });

    socket.on('batch-status', (status: BatchStatus) => {
      setBatchStatus(status);
    });

    socket.on('queue-status', (data) => {
      setBatchStatus(prev => prev ? { ...prev, ...data } : null);
    });

    return () => {
      socket.disconnect();
    };
  }, [testId, toast]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Format time
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start test
  const handleStartTest = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/v1/tests/${testId}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setTest(prev => prev ? { ...prev, isActive: true } : null);
        toast({
          title: 'Test Started',
          description: 'The test has been started successfully.',
          variant: 'default'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start test.',
        variant: 'destructive'
      });
    }
  };

  // End test
  const handleEndTest = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/v1/tests/${testId}/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setTest(prev => prev ? { ...prev, isActive: false } : null);
        toast({
          title: 'Test Ended',
          description: 'The test has been ended successfully.',
          variant: 'default'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to end test.',
        variant: 'destructive'
      });
    }
  };

  // Force process pending batches
  const handleProcessBatches = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/v1/tests/${testId}/process-batches`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast({
          title: 'Batch Processing',
          description: 'Forced processing of pending submission batches.',
          variant: 'default'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process batches.',
        variant: 'destructive'
      });
    }
  };

  // Export results
  const handleExportResults = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/v1/tests/${testId}/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `test-results-${testId}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export results.',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading test monitoring...</div>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Test Not Found</h2>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const submittedCount = students.filter(s => s.status === 'SUBMITTED' || s.status === 'COMPLETED').length;
  const inProgressCount = students.filter(s => s.status === 'IN_PROGRESS').length;
  const notStartedCount = students.filter(s => s.status === 'NOT_STARTED').length;

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">{test.title}</h1>
            <p className="text-gray-600">Real-time Test Monitoring</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5" />
              <span className="font-mono text-xl">
                {formatTime(timeLeft)}
              </span>
            </div>
            <div className="flex gap-2">
              {!test.isActive ? (
                <Button onClick={handleStartTest} className="bg-gray-600 hover:bg-gray-700">
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Start Test
                </Button>
              ) : (
                <Button onClick={handleEndTest} variant="destructive">
                  <PauseIcon className="h-4 w-4 mr-2" />
                  End Test
                </Button>
              )}
              <Button onClick={fetchStudentSessions} variant="outline">
                <RefreshCwIcon className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleExportResults} variant="outline">
                <DownloadIcon className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Students</p>
                  <p className="text-2xl font-bold">{activeStudents}</p>
                </div>
                <UsersIcon className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Submitted</p>
                  <p className="text-2xl font-bold text-gray-600">{submittedCount}</p>
                </div>
                <CheckCircleIcon className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Progress</p>
                  <p className="text-2xl font-bold text-yellow-600">{inProgressCount}</p>
                </div>
                <ClockIcon className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Not Started</p>
                  <p className="text-2xl font-bold text-gray-600">{notStartedCount}</p>
                </div>
                <XCircleIcon className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Batch Processing Status */}
        {batchStatus && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ServerIcon className="h-5 w-5" />
                Batch Processing Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between">
                  <span>Queue Size:</span>
                  <Badge variant={batchStatus.queueSize > 0 ? 'destructive' : 'default'}>
                    {batchStatus.queueSize}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Processing:</span>
                  <Badge variant={batchStatus.processing ? 'default' : 'secondary'}>
                    {batchStatus.processing ? 'Active' : 'Idle'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Progress:</span>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={batchStatus.totalSubmissions > 0 ? 
                        (batchStatus.processedSubmissions / batchStatus.totalSubmissions) * 100 : 0
                      } 
                      className="w-20" 
                    />
                    <span className="text-sm">
                      {batchStatus.processedSubmissions}/{batchStatus.totalSubmissions}
                    </span>
                  </div>
                </div>
              </div>
              {batchStatus.queueSize > 0 && (
                <div className="mt-4">
                  <Button onClick={handleProcessBatches} size="sm">
                    Force Process Pending Batches
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Test Information */}
            <Card>
              <CardHeader>
                <CardTitle>Test Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Duration:</span>
                    <span>{test.duration} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Start Time:</span>
                    <span>{new Date(test.startTime).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">End Time:</span>
                    <span>{new Date(test.endTime).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Status:</span>
                    <Badge variant={test.isActive ? 'default' : 'secondary'}>
                      {test.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Problems:</span>
                    <span>{test.problems.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Problems List */}
            <Card>
              <CardHeader>
                <CardTitle>Problems</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {test.problems.map((problem, index) => (
                    <div key={problem.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{index + 1}. {problem.title}</span>
                      </div>
                      <Badge 
                        variant={
                          problem.difficulty === 'EASY' ? 'default' :
                          problem.difficulty === 'MEDIUM' ? 'secondary' : 'destructive'
                        }
                      >
                        {problem.difficulty}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Student Sessions</CardTitle>
              <CardDescription>
                Real-time monitoring of student activity and progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current Problem</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Penalties</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{student.name}</div>
                          <div className="text-sm text-gray-500">{student.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            student.status === 'SUBMITTED' || student.status === 'COMPLETED' ? 'default' :
                            student.status === 'IN_PROGRESS' ? 'secondary' : 'outline'
                          }
                        >
                          {student.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {student.status === 'IN_PROGRESS' ? 
                          `Problem ${student.currentProblemIndex + 1}` : 
                          '-'
                        }
                      </TableCell>
                      <TableCell>
                        {student.lastActivity ? 
                          new Date(student.lastActivity).toLocaleTimeString() : 
                          '-'
                        }
                      </TableCell>
                      <TableCell>
                        {student.penaltyCount > 0 ? (
                          <Badge variant="destructive">{student.penaltyCount}</Badge>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline">
                          <EyeIcon className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>Submission Tracking</CardTitle>
              <CardDescription>
                Monitor submission status and scoring progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {students.filter(s => s.submissions.length > 0).map((student) => (
                  <div key={student.id} className="border rounded p-4">
                    <div className="font-medium mb-2 text-gray-900 dark:text-gray-100">{student.name}</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {student.submissions.map((submission) => (
                        <div key={submission.id} className="p-2 bg-gray-50 dark:bg-black rounded">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Problem {test.problems.findIndex(p => p.id === submission.problemId) + 1}
                            </span>
                            <Badge 
                              variant={
                                submission.status === 'ACCEPTED' ? 'default' :
                                submission.status === 'PARTIAL' ? 'secondary' : 'destructive'
                              }
                            >
                              {submission.score}%
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {submission.status} • {new Date(submission.submittedAt).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violations">
          <ViolationMonitoringPanel 
            testId={testId || ''} 
            violations={[]}
            onTerminateStudent={(_sessionId) => {
              // TODO: Implement termination logic
            }}
            onWarnStudent={(_sessionId) => {
              // TODO: Implement warning logic
            }}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Participation Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Participation Rate</span>
                      <span>{students.length > 0 ? Math.round(((students.length - notStartedCount) / students.length) * 100) : 0}%</span>
                    </div>
                    <Progress value={students.length > 0 ? ((students.length - notStartedCount) / students.length) * 100 : 0} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Completion Rate</span>
                      <span>{students.length > 0 ? Math.round((submittedCount / students.length) * 100) : 0}%</span>
                    </div>
                    <Progress value={students.length > 0 ? (submittedCount / students.length) * 100 : 0} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Problem Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {test.problems.map((problem, index) => {
                    const attempts = students.filter(s => 
                      s.submissions.some(sub => sub.problemId === problem.id)
                    ).length;
                    const successRate = attempts > 0 ? 
                      students.filter(s => 
                        s.submissions.some(sub => sub.problemId === problem.id && sub.status === 'ACCEPTED')
                      ).length / attempts * 100 : 0;

                    return (
                      <div key={problem.id} className="p-2 border rounded">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{index + 1}. {problem.title}</span>
                          <div className="text-sm text-gray-500">
                            {attempts} attempts • {Math.round(successRate)}% success
                          </div>
                        </div>
                        <Progress value={successRate} className="mt-1" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TestMonitoringPage; 
