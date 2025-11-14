import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAssignmentDetails, checkSubmissionsForAssignment, checkMySubmissionsForAssignment } from '../../api/assignments';
import { AssignmentWithSubmissions, StudentAssignmentDetails, ProblemWithUserSubmission } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { useAuth } from '../../context/AuthContext';
import SubmissionStatusGrid from '../../components/assignments/SubmissionStatusGrid';
import CompletionStats from '../../components/assignments/CompletionStats';
import ProblemCompletionList from '../../components/assignments/ProblemCompletionList';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { RefreshCw, Pencil, CheckCircle2, Clock, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Progress } from '../../components/ui/progress';
import { isAxiosError } from 'axios';

const AssignmentDetailsPage: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<AssignmentWithSubmissions | StudentAssignmentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';
  const cooldownDuration = 60; // 1 minute

  const fetchAssignment = useCallback(async () => {
    if (!assignmentId) return;
    try {
      const data = await getAssignmentDetails(assignmentId);
      setAssignment(data);

      if (user?.role === 'STUDENT' && data && 'problems' in data) {
        const studentData = data as StudentAssignmentDetails;
        if (studentData.lastCheckedAt) {
          const lastChecked = new Date(studentData.lastCheckedAt).getTime();
          const now = new Date().getTime();
          const diffInSeconds = Math.floor((now - lastChecked) / 1000);
          
          if (diffInSeconds < cooldownDuration) {
            setCooldown(cooldownDuration - diffInSeconds);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch assignment details', error);
      toast.error('Failed to fetch assignment details.');
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId, user?.role]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleCheckSubmissions = async () => {
    if (!assignmentId) return;
    setIsChecking(true);
    try {
      const result = await checkSubmissionsForAssignment(assignmentId);
      const now = new Date().toLocaleTimeString();
      toast.success(`Submission check complete at ${now}. Data has been updated.`);
      await fetchAssignment(); // Refresh to get the updated lastSubmissionCheck
    } catch (error) {
      console.error('Failed to check submissions', error);
      if (isAxiosError(error) && error.response?.status === 403) {
        toast.error('Only teachers can trigger submission checks.');
      } else {
        toast.error('Failed to check submissions.');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleCheckMySubmissions = async () => {
    if (!assignmentId) return;
    setIsChecking(true);
    setCooldown(cooldownDuration);
    try {
      const response = await checkMySubmissionsForAssignment(assignmentId);
      toast.success(response.message || 'Checked for new submissions!');
      fetchAssignment();
    } catch (error) {
      console.error('Failed to check my submissions', error);
      if (isAxiosError(error) && error.response?.status === 429) {
        toast.error('You can only check for new submissions once every 1 minute.');
      } else {
        toast.error('Failed to check your submissions.');
      }
    } finally {
      setIsChecking(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!assignment) {
    return <div className="text-center py-10">Assignment not found.</div>;
  }

  // Calculate progress for students
  const studentProblems = assignment.problems as ProblemWithUserSubmission[];
  
  // For main progress: Only count automatic completion (actual submissions)
  const autoCompletedCount = studentProblems ? studentProblems.filter(p => p.completed).length : 0;
  const totalCount = studentProblems ? studentProblems.length : 0;
  const progressPercentage = totalCount > 0 ? Math.round((autoCompletedCount / totalCount) * 100) : 0;
  
  return (
    <div className="container py-8">
      {/* Back Button Header */}
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => navigate(`/classes/${assignment.classId}?tab=assignments`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Assignments
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl mb-2">{assignment.title}</CardTitle>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Assigned: {new Date(assignment.assignDate).toLocaleDateString()}</span>
                <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                {isTeacher && assignment.lastSubmissionCheck && (
                  <span>Last checked: {new Date(assignment.lastSubmissionCheck).toLocaleString()}</span>
                )}
              </div>
            </div>
              <div className="flex items-center gap-2">
                {isTeacher ? (
                  <Button
                    onClick={handleCheckSubmissions}
                    disabled={isChecking}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                    Check Submissions
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleCheckMySubmissions}
                      disabled={isChecking || cooldown > 0}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                      {cooldown > 0 ? `Try again in ${cooldown}s` : 'Check My Submissions'}
                    </Button>
                  </>
                )}
                {isTeacher && (
                  <Button asChild variant="outline">
                    <Link to={`/assignments/${assignmentId}/edit`}>
                      <Pencil className="h-4 w-4" />
                      Edit Assignment
                    </Link>
                  </Button>
                )}
              </div>
          </div>
        </CardHeader>
        <CardContent>
          {assignment.description && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground">{assignment.description}</p>
            </div>
          )}

          <div>
            {isTeacher ? (
              <>
                <h3 className="font-semibold mb-4">Submission Status</h3>
                <div className="space-y-6">
                  <CompletionStats assignment={assignment as AssignmentWithSubmissions} />
                  <SubmissionStatusGrid 
                    assignment={assignment as AssignmentWithSubmissions} 
                    onRefresh={fetchAssignment}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Simple Progress Section for Students */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Your Progress</h3>
                  <Progress value={progressPercentage} className="w-full" />
                  <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>{progressPercentage}% complete</span>
                    <span>{autoCompletedCount} of {totalCount} problems completed</span>
                  </div>
                </div>

                {/* Problems List */}
                <h3 className="font-semibold mb-4">Problems</h3>
                <ProblemCompletionList 
                  problems={studentProblems} 
                  dueDate={assignment.dueDate}
                  assignDate={assignment.assignDate}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssignmentDetailsPage; 