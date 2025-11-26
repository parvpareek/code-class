import React from 'react';
import { Link } from 'react-router-dom';
import { Class } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { MoreVertical, Users, BookOpen, Settings, Trash2, Copy, LogOut, Archive } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

interface ClassCardProps {
  classData: Class;
  onDelete?: (classId: string) => void;
  onLeave?: (classId: string) => void;
  onArchive?: (classId: string) => void;
}

const ClassCard: React.FC<ClassCardProps> = ({ classData, onDelete, onLeave, onArchive }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isTeacher = user?.role === 'TEACHER';

  const copyJoinCode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(classData.joinCode);
    toast({
      title: 'Copied!',
      description: 'Class join code copied to clipboard.',
    });
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex-none">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{classData.name}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isTeacher ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link to={`/classes/${classData.id}/settings`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Class Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive?.(classData.id);
                    }}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive Class
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(classData.id);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Class
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive?.(classData.id);
                    }}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive Class
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLeave?.(classData.id);
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Leave Class
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-4">
          {isTeacher && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center">
                 <span className="font-semibold mr-2">Join Code:</span>
                 <span className="font-mono bg-gray-100 p-1 rounded">{classData.joinCode}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={copyJoinCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
          {isTeacher && (
            <div className="flex items-center text-sm text-gray-500">
              <Users className="mr-2 h-4 w-4" />
              {classData.studentCount || 0} Students
            </div>
          )}
          {isTeacher && (
            <div className="flex items-center text-sm text-gray-500">
              <BookOpen className="mr-2 h-4 w-4" />
              {classData.assignmentCount || 0} Assignments
            </div>
          )}
          {!isTeacher && (
            <div className="text-sm text-gray-500">
              Teacher: {classData.teacherName}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-none space-x-2">
        <Button asChild variant="default" className="flex-1">
          <Link to={`/classes/${classData.id}`}>
            {isTeacher ? 'View Class' : 'Enter Class'}
          </Link>
        </Button>
        {isTeacher && (
          <Button asChild variant="outline" className="flex-1">
            <Link to={`/classes/${classData.id}/assignments/new`}>
              Add Assignment
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ClassCard;
