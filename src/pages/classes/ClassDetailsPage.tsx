import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { getClassDetails, getClassAssignments, removeStudentFromClass } from '../../api/classes';
import { getAssignmentDetails } from '../../api/assignments';
import { deleteAssignment } from '../../api/assignments';
import { getClassAnnouncements } from '../../api/announcements';
import { ClassWithStudents, Assignment, TeacherAssignment, StudentAssignment, Student, Announcement } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { triggerDataRefresh, DATA_REFRESH_EVENTS } from '../../utils/dataRefresh';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import AssignmentList from '../../components/assignments/AssignmentList';
import LoadingScreen from '../../components/ui/LoadingScreen';
import LeetCodeStats from '../../components/ui/LeetCodeStats';
import AnnouncementList from '../../components/announcements/AnnouncementList';
import TestList from '../../components/tests/TestList';
import { CodingTest } from '../../components/tests/TestCard';
import { Plus, Users, BookOpen, Award, Copy, Code, TrendingUp, Search, Megaphone, Terminal, UserMinus, Key, Shield } from 'lucide-react';
import { Input } from '../../components/ui/input';
import SubmissionStatusChecker from '../../components/classes/SubmissionStatusChecker';
import { StudentAnalyticsDashboard } from '../../components/analytics/StudentAnalyticsDashboard';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../components/ui/accordion';
import { Badge } from '../../components/ui/badge';


const ClassDetailsPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const isTeacher = user?.role === 'TEACHER';
  
  const [classDetails, setClassDetails] = useState<ClassWithStudents | null>(null);
  const [assignments, setAssignments] = useState<(Assignment | TeacherAssignment | StudentAssignment)[]>([]);
  const [tests, setTests] = useState<CodingTest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const initialTab = searchParams.get('tab') || (isTeacher ? 'overview' : 'assignments');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [studentSearch, setStudentSearch] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [latestAssignmentLateCounts, setLatestAssignmentLateCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      if (!classId) return;
      
      setIsLoading(true);
      try {
        const [classData, assignmentsData, announcementsData] = await Promise.all([
          getClassDetails(classId),
          getClassAssignments(classId),
          getClassAnnouncements(classId),
        ]);
        
        setClassDetails(classData);
        setAssignments(assignmentsData);
        setAnnouncements(announcementsData);

        // Compute late counts for the most recent assignment (lightweight: single extra call)
        const sorted = [...assignmentsData].sort((a, b) => {
          const aTime = new Date((a as any).dueDate || (a as any).createdAt).getTime();
          const bTime = new Date((b as any).dueDate || (b as any).createdAt).getTime();
          return bTime - aTime;
        });
        const latest = sorted[0];
        if (latest && (user?.role === 'TEACHER')) {
          try {
            const details: any = await getAssignmentDetails(latest.id);
            if (details && Array.isArray(details.problems)) {
              const counts: Record<string, number> = {};
              details.problems.forEach((p: any) => {
                if (Array.isArray(p.submissions)) {
                  p.submissions.forEach((s: any) => {
                    // Check if submission is late (with proper end-of-day calculation in UTC)
                    let isLate = s?.isLate;
                    if (isLate === undefined && s?.submissionTime && details?.dueDate) {
                      const dueDateEndOfDay = new Date(details.dueDate);
                      dueDateEndOfDay.setUTCHours(23, 59, 59, 999);
                      isLate = new Date(s.submissionTime).getTime() > dueDateEndOfDay.getTime();
                    }
                    
                    if (s?.completed && isLate) {
                      counts[s.userId] = (counts[s.userId] || 0) + 1;
                    }
                  });
                }
              });
              setLatestAssignmentLateCounts(counts);
            }
          } catch (e) {
            // Non-critical; ignore
          }
        }
        
        // Mock test data for now - will be replaced with API call
        const mockTests: CodingTest[] = [
          {
            id: '1',
            title: 'Data Structures Quiz',
            description: 'Test covering arrays, linked lists, and stacks',
            duration: 90,
            startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
            status: 'SCHEDULED',
            classId: classId,
            problems: [],
            sessions: [],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];
        setTests(mockTests);
      } catch (error) {
        console.error('Error fetching class details:', error);
        toast({
          title: 'Error',
          description: 'Failed to load class details.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [classId, toast]);



  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await deleteAssignment(assignmentId);
      
      // Update local state immediately for better UX
      setAssignments(assignments.filter(a => a.id !== assignmentId));
      
      // Refresh class details to ensure all counts are updated
      if (classId) {
        try {
          const [refreshedClassData, refreshedAssignments] = await Promise.all([
            getClassDetails(classId),
            getClassAssignments(classId),
          ]);
          setClassDetails(refreshedClassData);
          setAssignments(refreshedAssignments);
        } catch (refreshError) {
          console.error('Error refreshing data after deletion:', refreshError);
          // Don't show error toast for refresh failure since main operation succeeded
        }
      }
      
      // Trigger refresh events for other pages
      triggerDataRefresh(DATA_REFRESH_EVENTS.ASSIGNMENTS_UPDATED, { classId, deletedAssignmentId: assignmentId });
      triggerDataRefresh(DATA_REFRESH_EVENTS.CLASSES_UPDATED);
      triggerDataRefresh(DATA_REFRESH_EVENTS.LEADERBOARD_UPDATED);
      
      toast({
        title: 'Assignment deleted',
        description: 'The assignment has been successfully removed.',
      });
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete assignment.',
        variant: 'destructive',
      });
    }
  };

  const copyJoinCode = () => {
    if (classDetails) {
      navigator.clipboard.writeText(classDetails.joinCode);
      toast({
        title: 'Join code copied!',
        description: 'The class join code has been copied to clipboard.',
      });
    }
  };

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${studentName} from this class? This will delete all their progress and submissions.`)) {
      return;
    }

    if (!classId) return;

    try {
      await removeStudentFromClass(classId, studentId);
      
      // Update local state immediately for better UX
      if (classDetails) {
        const updatedStudents = classDetails.students.filter(s => s.id !== studentId);
        setClassDetails({
          ...classDetails,
          students: updatedStudents
        });
      }
      
      // Trigger refresh events
      triggerDataRefresh(DATA_REFRESH_EVENTS.CLASSES_UPDATED);
      
      toast({
        title: 'Student Removed',
        description: `${studentName} has been successfully removed from the class.`,
      });
    } catch (error) {
      console.error('Error removing student:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove student from class.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateAssignment = () => {
    navigate(`/classes/${classId}/assignments/new`);
  };

  const handleCreateTest = () => {
    navigate(`/classes/${classId}/tests/new`);
  };
  
  const handleCreateAnnouncement = () => {
    navigate(`/classes/${classId}/announcements/new`);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!classDetails) {
    return (
      <div className="py-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Class not found</h1>
        <Button asChild>
          <Link to="/classes">Back to Classes</Link>
        </Button>
      </div>
    );
  }

  const studentTabs = [
    { value: 'assignments', label: 'Assignments', content: <AssignmentList assignments={assignments as StudentAssignment[]} showStatus /> },
    { value: 'tests', label: 'Tests', content: <TestList tests={tests} /> },
    { value: 'announcements', label: 'Announcements', content: <AnnouncementList announcements={announcements} isTeacher={false} classId={classId} /> },
  ];

  const teacherTabs = [
    { 
      value: 'assignments', 
      label: 'Assignments', 
      content: <AssignmentList assignments={assignments as TeacherAssignment[]} onDelete={handleDeleteAssignment} />
    },
    { value: 'students', label: 'Students', content: (
      <div className="space-y-4">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search students..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classDetails.students
            .filter(student => student.name.toLowerCase().includes(studentSearch.toLowerCase()))
            .map(student => (
              <Card key={student.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle 
                    className="text-lg hover:text-blue-600 transition-colors cursor-pointer"
                    onClick={() => navigate(`/students/${student.id}`)}
                  >
                    <span className="flex items-center gap-2">
                      {student.name}
                      {latestAssignmentLateCounts[student.id] > 0 && (
                        <Badge className="bg-yellow-600 text-white" title={`Late ${latestAssignmentLateCounts[student.id]} in last assignment`}>
                          Late x{latestAssignmentLateCounts[student.id]}
                        </Badge>
                      )}
                    </span>
                  </CardTitle>
                  {isTeacher && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveStudent(student.id, student.name);
                      }}
                      title="Remove student"
                    >
                      <UserMinus className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent onClick={() => navigate(`/students/${student.id}`)}>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                  
                  <div className="mt-3">
                    <LeetCodeStats user={student} compact />
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    )},
    { value: 'tests', label: 'Tests', content: <TestList tests={tests} isTeacher={isTeacher} /> },
    { value: 'announcements', label: 'Announcements', content: <AnnouncementList announcements={announcements} isTeacher={isTeacher} classId={classId}/> },
    { value: 'settings', label: 'Settings', content: <div>Settings will be here</div> },
  ];

  const tabsConfig = isTeacher ? teacherTabs : studentTabs;

  return (
    <div className="py-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{classDetails.name}</h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher 
              ? `${classDetails.students.length} enrolled students` 
              : `Teacher: ${classDetails.teacherName}`
            }
          </p>
        </div>
        
        {isTeacher && (
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to={`/classes/${classId}/assignments/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Add Assignment
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/classes/${classId}/tests/new`}>
                <Terminal className="mr-2 h-4 w-4" />
                Create Test
              </Link>
            </Button>
            <div className="flex items-center space-x-2">
              <div className="bg-muted px-3 py-1 rounded font-mono text-sm">
                {classDetails.joinCode}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyJoinCode}
                title="Copy join code"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        // Update URL to reflect current tab
        navigate(`/classes/${classId}?tab=${value}`, { replace: true });
      }} className="mt-6">
        <TabsList className={`grid w-full ${isTeacher ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-3'}`}>
          {isTeacher && (
            <TabsTrigger value="overview">
              <TrendingUp className="mr-2 h-4 w-4" /> Overview
            </TabsTrigger>
          )}
          <TabsTrigger value="assignments">
            <BookOpen className="mr-2 h-4 w-4" /> Assignments
          </TabsTrigger>
          {isTeacher && (
            <TabsTrigger value="students">
              <Users className="mr-2 h-4 w-4" /> Students
            </TabsTrigger>
          )}
          <TabsTrigger value="tests">
            <Terminal className="mr-2 h-4 w-4" /> Tests
          </TabsTrigger>
           <TabsTrigger value="announcements">
            <Megaphone className="mr-2 h-4 w-4" /> Announcements
          </TabsTrigger>
        </TabsList>

        {isTeacher && (
          <TabsContent value="overview" className="mt-4">
            <StudentAnalyticsDashboard classId={classId} />
          </TabsContent>
        )}

        {tabsConfig.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ClassDetailsPage;
