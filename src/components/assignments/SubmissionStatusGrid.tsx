import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type StudentInfo = {
  id: string;
  name: string;
  email: string;
};

interface SubmissionStatusGridProps {
  assignment: {
    problems: Array<{
      id: string;
      title: string;
      url: string;
      submissions: Array<{
        id: string;
        userId: string;
        completed: boolean;
        submissionTime?: string;
        isLate?: boolean;
        user: {
          id: string;
          name: string;
          email: string;
        };
      }>;
    }>;
    class?: {
      students: Array<{
        id: string;
        name: string;
        email: string;
      }>;
    };
    dueDate?: string;
    assignDate?: string; // Add this line
  };
  onRefresh?: () => void;
}

const SubmissionStatusGrid: React.FC<SubmissionStatusGridProps> = ({ assignment, onRefresh }) => {
  const [unsolvedFilter, setUnsolvedFilter] = useState<string>('all');

  // Extract unique students from submissions data (since class.students might not be available)
  const students = useMemo(() => {
    if (!assignment || !assignment.problems || assignment.problems.length === 0) {
      return [];
    }

    const studentMap = new Map<string, StudentInfo>();
    
    // Collect unique students from all submissions
    assignment.problems.forEach(problem => {
      // Defensive check for submissions
      if (!problem?.submissions || !Array.isArray(problem.submissions)) {
        return;
      }
      
      problem.submissions.forEach(submission => {
        if (submission?.user && 
            submission.user.id && 
            submission.user.name && 
            !studentMap.has(submission.user.id)) {
          studentMap.set(submission.user.id, {
            id: submission.user.id,
            name: submission.user.name,
            email: submission.user.email || ''
          });
        }
      });
    });

    // If we have class.students, use that as it might be more complete
    if (assignment.class?.students && Array.isArray(assignment.class.students)) {
      assignment.class.students.forEach(student => {
        if (student?.id && student?.name && !studentMap.has(student.id)) {
          studentMap.set(student.id, {
            id: student.id,
            name: student.name,
            email: student.email || ''
          });
        }
      });
    }

    const result = Array.from(studentMap.values())
      .filter(student => student && student.name) // Extra safety check
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return result;
  }, [assignment]);

  const totalProblems = assignment?.problems?.length ?? 0;

  // Calculate unsolved counts for filter dropdown
  const unsolvedCounts = useMemo(() => {
    const counts: { [key: number]: number } = {};
    if (totalProblems > 0 && students.length > 0 && assignment?.problems) {
      students.forEach(student => {
        if (!student?.id) return;
        const completedCount = assignment.problems.reduce((acc, problem) => {
          // Defensive check for submissions
          if (!problem?.submissions || !Array.isArray(problem.submissions)) {
            return acc;
          }
          
          const submission = problem.submissions.find(s => s?.userId === student.id);
          return acc + (submission?.completed ? 1 : 0);
        }, 0);
        const unsolved = totalProblems - completedCount;
        counts[unsolved] = (counts[unsolved] || 0) + 1;
      });
    }
    return counts;
  }, [students, assignment, totalProblems]);

  // Filter students based on unsolved count
  const filteredStudents = useMemo(() => {
    if (unsolvedFilter === 'all') {
      return students;
    }
    if (!assignment?.problems || !Array.isArray(assignment.problems)) {
      return students;
    }
    const unsolvedCount = parseInt(unsolvedFilter, 10);
    return students.filter(student => {
      if (!student?.id) return false;
      const completedCount = assignment.problems.reduce((acc, problem) => {
        // Defensive check for submissions
        if (!problem?.submissions || !Array.isArray(problem.submissions)) {
          return acc;
        }
        
        const submission = problem.submissions.find(s => s?.userId === student.id);
        return acc + (submission?.completed ? 1 : 0);
      }, 0);
      return totalProblems - completedCount === unsolvedCount;
    });
  }, [students, assignment, unsolvedFilter, totalProblems]);

  // Get student completion data - only automatic completion
  const getStudentCompletion = (studentId: string, problemId: string) => {
    const problem = assignment?.problems?.find(p => p?.id === problemId);
    if (!problem || !problem.submissions) {
      return { completed: false };
    }
    
    const submission = problem.submissions.find(s => s?.userId === studentId);
    
    // Fallback calculation for isLate if not provided by backend
    let isLate = submission?.isLate;
    if (isLate === undefined && submission?.submissionTime && assignment?.dueDate && assignment?.assignDate) {
      // Calculate end of day for due date (23:59:59.999) in UTC
      const dueDateEndOfDay = new Date(assignment.dueDate);
      dueDateEndOfDay.setUTCHours(23, 59, 59, 999);
      
      isLate = new Date(submission.submissionTime).getTime() > dueDateEndOfDay.getTime() && 
               new Date(submission.submissionTime).getTime() >= new Date(assignment.assignDate).getTime();
    }
    
    return {
      completed: submission?.completed || false,
      submissionTime: submission?.submissionTime,
      isLate: isLate ?? false
    };
  };

  // Calculate student progress based only on automatic completion
  const getStudentProgress = (studentId: string) => {
    if (!assignment?.problems || !Array.isArray(assignment.problems)) {
      return { completed: 0, total: 0, percentage: 0 };
    }
    
    const totalProblems = assignment.problems.length;
    const completedProblems = assignment.problems.filter(problem => {
      // Defensive check for submissions
      if (!problem?.submissions || !Array.isArray(problem.submissions)) {
        return false;
      }
      
      const submission = problem.submissions.find(s => s?.userId === studentId);
      return submission?.completed || false;
    }).length;
    
    return {
      completed: completedProblems,
      total: totalProblems,
      percentage: totalProblems > 0 ? Math.round((completedProblems / totalProblems) * 100) : 0
    };
  };

  if (!assignment || !assignment.problems || assignment.problems.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No problems in this assignment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium">Student Progress Overview</h4>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Showing verified submissions only
          </div>
          
          {/* Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="unsolved-filter" className="text-sm font-medium">
              Filter by students with:
            </label>
            <Select value={unsolvedFilter} onValueChange={setUnsolvedFilter}>
              <SelectTrigger className="w-[350px]" id="unsolved-filter">
                <SelectValue placeholder="Show All Students" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Show All Students</SelectItem>
                {[...Array(totalProblems + 1).keys()].map(i => {
                  const studentCount = unsolvedCounts[i];
                  const studentCountText = studentCount
                    ? ` [${studentCount} student${studentCount > 1 ? 's' : ''}]`
                    : '';

                  return (
                    <SelectItem key={i} value={String(i)}>
                      {i} unsolved problem(s){studentCountText}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">Student</TableHead>
              {assignment.problems.map((problem) => {
                // Defensive check for submissions
                if (!problem?.submissions || !Array.isArray(problem.submissions)) {
                  return (
                    <TableHead key={problem.id} className="text-center min-w-[200px]">
                      <a href={problem.url} target="_blank" rel="noopener noreferrer" className="hover:underline font-medium">
                        {problem.title}
                      </a>
                      <div className="text-xs text-red-500 mt-1">No submissions data</div>
                    </TableHead>
                  );
                }
                
                const solvedCount = problem.submissions.filter(s => s.completed).length;
                const notSolvedCount = students.length - solvedCount;
                return (
                  <TableHead key={problem.id} className="text-center min-w-[200px]">
                    <a href={problem.url} target="_blank" rel="noopener noreferrer" className="hover:underline font-medium">
                      {problem.title}
                    </a>
                    <div className="flex items-center justify-center gap-3 text-xs mt-1.5 font-normal">
                      <span className="flex items-center gap-1 text-green-500">
                        <CheckCircle2 className="h-3 w-3" />
                        {solvedCount} Solved
                      </span>
                      <span className="flex items-center gap-1 text-red-500">
                        <XCircle className="h-3 w-3" />
                        {notSolvedCount} Not Solved
                      </span>
                    </div>
                  </TableHead>
                );
              })}
              <TableHead className="text-center">Completion</TableHead>
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {filteredStudents.length > 0 ? (
              filteredStudents.map((student) => {
                const progress = getStudentProgress(student.id);
                
                return (
                  <TableRow key={student.id}>
                    <TableCell className="sticky left-0 bg-background z-10 font-medium">
                      <div className="font-medium">{student.name}</div>
                    </TableCell>
                    
                    {assignment.problems.map((problem) => {
                      const { completed, submissionTime, isLate } = getStudentCompletion(student.id, problem.id);
                      
                      return (
                        <TableCell key={`${student.id}-${problem.id}`} className="text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            {completed ? (
                              <>
                                <CheckCircle2 className={`h-5 w-5 ${isLate ? 'text-yellow-600' : 'text-green-500'}`} />
                                <div className="flex items-center gap-1">
                                  {submissionTime && (
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(submissionTime).toLocaleDateString()}
                                    </span>
                                  )}
                                  {isLate && (
                                    <Badge className="bg-yellow-600 text-white">Late</Badge>
                                  )}
                                </div>
                              </>
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                    
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        {progress.completed === progress.total && progress.total > 0 ? (
                          <Badge className="bg-green-500 text-white">
                            All Questions Completed
                          </Badge>
                        ) : progress.completed > 0 ? (
                          <Badge className="bg-yellow-500 text-white">
                            In Progress
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-600 border-gray-300">
                            Not Started
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {progress.completed}/{progress.total}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={assignment.problems.length + 2} className="text-center py-10">
                  <p className="text-muted-foreground">No students match the current filter.</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SubmissionStatusGrid; 