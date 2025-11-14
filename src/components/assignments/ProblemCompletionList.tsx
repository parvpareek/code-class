import React from 'react';
import { ProblemWithUserSubmission } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { CheckCircle2, Clock, ExternalLink, Calendar } from 'lucide-react';
import { Button } from '../ui/button';

interface ProblemCompletionListProps {
  problems: ProblemWithUserSubmission[];
  isTeacher?: boolean;
  dueDate?: string;
  assignDate?: string;
}

const ProblemCompletionList: React.FC<ProblemCompletionListProps> = ({ problems, isTeacher = false, dueDate, assignDate }) => {
  return (
    <div className="space-y-3">
      {problems.map((problem, index) => {
        const isAutoCompleted = problem.completed;
        
        // Determine submission status
        let submissionStatus: 'on-time' | 'late' | 'before' = 'on-time';
        if (isAutoCompleted && problem.submissionTime) {
          const submissionTime = new Date(problem.submissionTime);
          
          // Check if submitted before assignment was created
          if (assignDate && submissionTime < new Date(assignDate)) {
            submissionStatus = 'before';
          } 
          // Check if submitted after due date
          else if (dueDate) {
            const dueDateEndOfDay = new Date(dueDate);
            dueDateEndOfDay.setHours(23, 59, 59, 999);
            if (submissionTime > dueDateEndOfDay) {
              submissionStatus = 'late';
            }
          }
        }
        
        const isLate = submissionStatus === 'late';
        const isBeforeAssignment = submissionStatus === 'before';
        
        return (
        <Card key={problem.id} className={`border transition-all duration-200 ${
          isAutoCompleted 
            ? isLate 
              ? 'border-yellow-200 bg-yellow-50/50 hover:bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30'
              : isBeforeAssignment
              ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/30'
              : 'border-green-200 bg-green-50/50 hover:bg-green-50 dark:border-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/30' 
            : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {/* Completion Status Icon */}
                <div className="flex-shrink-0">
                  {isAutoCompleted ? (
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      isLate ? 'bg-yellow-600' : 
                      isBeforeAssignment ? 'bg-blue-500' : 
                      'bg-green-500'
                    }`}>
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Problem Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Problem #{index + 1}
                    </span>
                    {isAutoCompleted && (
                      <Badge className={`${
                        isLate ? 'bg-yellow-600' : 
                        isBeforeAssignment ? 'bg-blue-500' : 
                        'bg-green-500'
                      } text-xs text-white`}>
                        {isLate ? 'Late Submission' : 
                         isBeforeAssignment ? 'Before Assignment' : 
                         'Auto-Completed'}
                      </Badge>
                    )}
                  </div>
                  
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1 line-clamp-1">
                    {problem.title}
                  </h4>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Badge variant="outline" className="text-xs">
                      {problem.platform}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        problem.difficulty === 'Easy' ? 'border-green-300 text-green-700 dark:border-green-600 dark:text-green-400' :
                        problem.difficulty === 'Medium' ? 'border-yellow-300 text-yellow-700 dark:border-yellow-600 dark:text-yellow-400' :
                        'border-red-300 text-red-700 dark:border-red-600 dark:text-red-400'
                      }`}
                    >
                      {problem.difficulty}
                    </Badge>
                    
                    {isAutoCompleted && problem.submissionTime && (
                      <div className={`flex items-center gap-1 text-xs ${
                        isLate ? 'text-yellow-700 dark:text-yellow-400' : 
                        isBeforeAssignment ? 'text-blue-600 dark:text-blue-400' : 
                        'text-green-600 dark:text-green-400'
                      }`}>
                        <Calendar className="h-3 w-3" />
                        <span>
                          {isLate ? 'Late submission' : 
                           isBeforeAssignment ? 'Completed before assignment' : 
                           'Auto-completed'} {new Date(problem.submissionTime).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                  
                  {/* Action Button */}
                <div className="flex-shrink-0">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={problem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {isAutoCompleted ? 'Review' : 'Solve'}
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
};

export default ProblemCompletionList; 