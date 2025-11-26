import React, { useEffect, useState } from 'react';
import { getClasses, deleteClass as apiDeleteClass, leaveClass as apiLeaveClass, archiveClass as apiArchiveClass } from '../../api/classes';
import { useAuth } from '../../context/AuthContext';
import { Class } from '../../types';
import ClassList from '../../components/classes/ClassList';
import { Button } from '../../components/ui/button';
import { Link } from 'react-router-dom';
import { Plus, Users, BookOpen, Archive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/use-toast';
import { useDataRefresh, DATA_REFRESH_EVENTS } from '../../utils/dataRefresh';

const ClassesPage: React.FC = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isTeacher = user?.role === 'TEACHER';
  const { toast } = useToast();

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      const response = await getClasses();
      setClasses(response.classes || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
      setClasses([]); // Ensure classes is always an array
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  // Listen for data refresh events to update classes when assignments are modified
  useDataRefresh(DATA_REFRESH_EVENTS.CLASSES_UPDATED, () => {
    fetchClasses();
  }, []);

  const handleDeleteClass = async (classId: string) => {
    if (!window.confirm('Are you sure you want to delete this class? This action is permanent and will delete all associated assignments and submissions.')) {
      return;
    }

    try {
      await apiDeleteClass(classId);
      setClasses(classes.filter((c) => c.id !== classId));
      toast({
        title: 'Class Deleted',
        description: 'The class has been successfully deleted.',
      });
    } catch (error) {
      console.error('Error deleting class:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete class. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleLeaveClass = async (classId: string) => {
    if (!window.confirm('Are you sure you want to leave this class? You will lose access to all assignments and your progress.')) {
      return;
    }

    try {
      await apiLeaveClass(classId);
      setClasses(classes.filter((c) => c.id !== classId));
      toast({
        title: 'Left Class',
        description: 'You have successfully left the class.',
      });
    } catch (error) {
      console.error('Error leaving class:', error);
      toast({
        title: 'Error',
        description: 'Failed to leave class. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleArchiveClass = async (classId: string) => {
    try {
      await apiArchiveClass(classId);
      setClasses(classes.filter((c) => c.id !== classId));
      toast({
        title: 'Class Archived',
        description: 'The class has been archived. You can view it in the archived classes section.',
      });
    } catch (error) {
      console.error('Error archiving class:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive class. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const totalStudents = Array.isArray(classes) ? classes.reduce((acc, curr) => acc + (curr.studentCount || 0), 0) : 0;
  const totalAssignments = Array.isArray(classes) ? classes.reduce((acc, curr) => acc + (curr.assignmentCount || 0), 0) : 0;

  return (
    <div className="py-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isTeacher ? 'My Classes' : 'Enrolled Classes'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher
              ? 'Manage your classes and track student progress'
              : 'Access your enrolled classes and assignments'
            }
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/classes/archived">
              <Archive className="mr-2 h-4 w-4" />
              Archived
            </Link>
          </Button>
          {isTeacher && (
            <Button asChild>
              <Link to="/classes/create">
                <Plus className="mr-2 h-4 w-4" />
                Create Class
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards - only show for teachers */}
      {isTeacher && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classes.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudents}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssignments}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <ClassList 
        classes={classes} 
        isLoading={isLoading} 
        onDelete={isTeacher ? handleDeleteClass : undefined}
        onLeave={!isTeacher ? handleLeaveClass : undefined}
        onArchive={handleArchiveClass}
      />
    </div>
  );
};

export default ClassesPage;
