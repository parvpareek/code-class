import React from 'react';
import { Link } from 'react-router-dom';
import { Class } from '../../types';
import ClassCard from './ClassCard';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { BookOpen, Users } from 'lucide-react';

interface ClassListProps {
  classes: Class[];
  isLoading?: boolean;
  onDelete?: (classId: string) => void;
  onLeave?: (classId: string) => void;
  onArchive?: (classId: string) => void;
}

const ClassList: React.FC<ClassListProps> = ({ classes, isLoading, onDelete, onLeave, onArchive }) => {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
            className="h-48 rounded-lg bg-gray-100 animate-pulse"
          ></div>
        ))}
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="flex justify-center mb-4">
          {isTeacher ? (
            <BookOpen className="h-12 w-12 text-gray-400" />
          ) : (
            <Users className="h-12 w-12 text-gray-400" />
          )}
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {isTeacher ? "No classes created yet" : "No classes joined yet"}
        </h3>
        <p className="text-gray-500 mb-6">
          {isTeacher
            ? "Create your first class to start managing assignments and tracking student progress."
            : "Join a class using a class code to start solving assignments."}
        </p>
        <Button asChild>
          <Link to={isTeacher ? "/classes/create" : "/join-class"}>
            {isTeacher ? "Create Your First Class" : "Join a Class"}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {classes.map((classItem) => (
        <ClassCard 
          key={classItem.id} 
          classData={classItem} 
          onDelete={onDelete} 
          onLeave={onLeave}
          onArchive={onArchive}
        />
      ))}
    </div>
  );
};

export default ClassList;
