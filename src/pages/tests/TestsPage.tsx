import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import TestList from '../../components/tests/TestList';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { CodingTest } from '../../components/tests/TestCard';
import { 
  Plus, 
  Search, 
  Terminal, 
  Calendar, 
  Clock,
  Filter,
  BookOpen
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { getAuthToken } from '../../lib/authTokenStorage';

const TestsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user?.role === 'TEACHER';
  
  const [tests, setTests] = useState<CodingTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState(isTeacher ? 'all' : 'upcoming');

  // Fetch real tests from API
  useEffect(() => {
    const fetchTests = async () => {
      setIsLoading(true);
      
      try {
        const token = getAuthToken();
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'}/tests`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setTests(data.tests || []);
        } else {
          console.error('Failed to fetch tests');
          // Fallback to empty array
          setTests([]);
        }
      } catch (error) {
        console.error('Error fetching tests:', error);
        // Fallback to empty array
        setTests([]);
      } finally {
      setIsLoading(false);
      }
    };

    fetchTests();
  }, []);

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         test.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || test.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const getTestsByCategory = (category: string) => {
    switch (category) {
      case 'upcoming':
        return filteredTests.filter(test => test.status === 'SCHEDULED');
      case 'active':
        return filteredTests.filter(test => test.status === 'ACTIVE');
      case 'completed':
        return filteredTests.filter(test => test.status === 'COMPLETED');
      case 'drafts':
        return filteredTests.filter(test => test.status === 'DRAFT');
      default:
        return filteredTests;
    }
  };

  const handleEditTest = (testId: string) => {
    // Navigate to edit page (will be implemented)
  };

  const handleDeleteTest = (testId: string) => {
    // Show confirmation and delete (will be implemented)
  };

  const handleViewTest = (testId: string) => {
    // Navigate based on user role and test status
    const test = tests.find(t => t.id === testId);
    if (!test) return;

    if (isTeacher) {
      // Teachers go to monitoring page
      navigate(`/tests/${testId}/monitor`);
    } else {
      // Students go to take test or view results
      if (test.status === 'ACTIVE') {
        navigate(`/tests/${testId}/take`);
      } else if (test.status === 'COMPLETED') {
        navigate(`/tests/${testId}/results`);
      }
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="py-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coding Tests</h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher 
              ? 'Create and manage coding tests for your classes'
              : 'View and take coding tests from your classes'
            }
          </p>
        </div>
        
        {isTeacher && (
          <Button asChild>
            <Link to="/tests/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Test
            </Link>
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Terminal className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Tests</p>
                <p className="text-2xl font-bold">{tests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Upcoming</p>
                <p className="text-2xl font-bold">
                  {tests.filter(t => t.status === 'SCHEDULED').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-2xl font-bold">
                  {tests.filter(t => t.status === 'ACTIVE').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium">Completed</p>
                <p className="text-2xl font-bold">
                  {tests.filter(t => t.status === 'COMPLETED').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different test categories */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          {isTeacher && (
            <TabsTrigger value="all">
              <Terminal className="h-4 w-4 mr-2" />
              All Tests
            </TabsTrigger>
          )}
          <TabsTrigger value="upcoming">
            <Calendar className="h-4 w-4 mr-2" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="active">
            <Clock className="h-4 w-4 mr-2" />
            Active
          </TabsTrigger>
          <TabsTrigger value="completed">
            <BookOpen className="h-4 w-4 mr-2" />
            Completed
          </TabsTrigger>
          {isTeacher && (
            <TabsTrigger value="drafts">
              <Filter className="h-4 w-4 mr-2" />
              Drafts
            </TabsTrigger>
          )}
        </TabsList>

        {isTeacher && (
          <TabsContent value="all">
            <TestList
              tests={getTestsByCategory('all')}
              isTeacher={isTeacher}
              onEdit={handleEditTest}
              onDelete={handleDeleteTest}
              onView={handleViewTest}
              emptyMessage="No tests found. Create your first test to get started."
            />
          </TabsContent>
        )}

        <TabsContent value="upcoming">
          <TestList
            tests={getTestsByCategory('upcoming')}
            isTeacher={isTeacher}
            onEdit={handleEditTest}
            onDelete={handleDeleteTest}
            onView={handleViewTest}
            emptyMessage={isTeacher ? "No upcoming tests scheduled." : "No upcoming tests. Check back later!"}
          />
        </TabsContent>

        <TabsContent value="active">
          <TestList
            tests={getTestsByCategory('active')}
            isTeacher={isTeacher}
            onEdit={handleEditTest}
            onDelete={handleDeleteTest}
            onView={handleViewTest}
            emptyMessage={isTeacher ? "No tests are currently active." : "No active tests right now."}
          />
        </TabsContent>

        <TabsContent value="completed">
          <TestList
            tests={getTestsByCategory('completed')}
            isTeacher={isTeacher}
            onEdit={handleEditTest}
            onDelete={handleDeleteTest}
            onView={handleViewTest}
            emptyMessage="No completed tests yet."
          />
        </TabsContent>

        {isTeacher && (
          <TabsContent value="drafts">
            <TestList
              tests={getTestsByCategory('drafts')}
              isTeacher={isTeacher}
              onEdit={handleEditTest}
              onDelete={handleDeleteTest}
              onView={handleViewTest}
              emptyMessage="No draft tests. Create a new test to get started."
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default TestsPage; 
