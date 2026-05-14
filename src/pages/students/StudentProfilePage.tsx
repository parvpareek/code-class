import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getStudentProfile } from '../../api/students';
import { StudentProfile as StudentProfileType } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import LoadingScreen from '../../components/ui/LoadingScreen';
import LeetCodeStats from '../../components/ui/LeetCodeStats';
import { CheckCircle2, XCircle, ArrowLeft, ExternalLink } from 'lucide-react';
import { differenceInMilliseconds } from 'date-fns';

const StudentProfilePage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!studentId) return;
      try {
        const data = await getStudentProfile(studentId);
        setProfile(data);
      } catch (error) {
        console.error('Failed to fetch student profile', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [studentId]);

  // Handle back navigation - try to go back to where we came from
  const handleBack = () => {
    // Check if we have navigation history and try to go back
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback to classes list
      navigate('/classes');
    }
  };

  // --- Calculations ---
  const totalSubmissions = profile?.submissions.length || 0;
  const completedSubmissions = profile?.submissions.filter(s => s.completed).length || 0;
  const completionRate = totalSubmissions > 0 ? Math.round((completedSubmissions / totalSubmissions) * 100) : 0;

  const submissionsByAssignment = (profile?.submissions || []).reduce((acc, submission) => {
    const assignId = submission.problem.assignment.id;
    if (!acc[assignId]) {
      acc[assignId] = {
        title: submission.problem.assignment.title,
        problems: [],
      };
    }
    acc[assignId].problems.push(submission);
    return acc;
  }, {} as Record<string, { title: string; problems: StudentProfileType['submissions'] }>);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!profile) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-bold mb-4">Student not found</h2>
        <Button onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-8">
      {/* Back Button Header */}
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={handleBack}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">{profile.name}</h1>
        <p className="text-muted-foreground">{profile.email}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Member since {new Date(profile.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completionRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completedSubmissions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalSubmissions}</p>
          </CardContent>
        </Card>
      </div>

      <LeetCodeStats user={profile} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Portfolio</CardTitle>
            {profile.portfolio && !profile.portfolio.published ? (
              <Badge variant="secondary">Not live</Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {!profile.portfolio ? (
            <p className="text-sm text-muted-foreground">This student has no portfolio on file yet.</p>
          ) : profile.portfolio.published ? (
            <Button asChild className="gap-2">
              <Link to={`/p/${encodeURIComponent(profile.portfolio.slug)}`} target="_blank" rel="noreferrer">
                View portfolio
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              They have a portfolio draft but it is not published — the public link stays hidden until they publish.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submission History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(submissionsByAssignment).length > 0 ? (
            Object.entries(submissionsByAssignment).map(([assignmentId, { title, problems }]) => (
              <div key={assignmentId}>
                <Link to={`/assignments/${assignmentId}`} className="text-lg font-semibold hover:underline">
                  {title}
                </Link>
                <div className="border rounded-lg mt-2">
                  <div className="divide-y">
                    {problems.map(sub => (
                      <div key={sub.problem.id} className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium">{sub.problem.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{sub.problem.difficulty}</Badge>
                            <Badge variant="secondary">{sub.problem.platform}</Badge>
                            {sub.completed && sub.submissionTime && sub.problem.assignment?.dueDate &&
                              new Date(sub.submissionTime).getTime() > new Date(sub.problem.assignment.dueDate).getTime() && (
                                <Badge className="bg-yellow-600 text-white">Late</Badge>
                            )}
                          </div>
                        </div>
                        {sub.completed ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="text-sm font-medium">Completed</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-600">
                            <XCircle className="h-5 w-5" />
                            <span className="text-sm font-medium">Not Submitted</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center">This student has no submission history.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentProfilePage; 