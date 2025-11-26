import React, { useEffect, useState } from 'react';
import { getArchivedClasses, unarchiveClass as apiUnarchiveClass } from '../../api/classes';
import { useAuth } from '../../context/AuthContext';
import { Class } from '../../types';
import { Button } from '../../components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft, Archive, ArchiveRestore, Search } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToast } from '../../hooks/use-toast';

const ArchivedClassesPage: React.FC = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const isTeacher = user?.role === 'TEACHER';
  const { toast } = useToast();

  const fetchArchivedClasses = async () => {
    setIsLoading(true);
    try {
      const response = await getArchivedClasses();
      setClasses(response.classes || []);
      setFilteredClasses(response.classes || []);
    } catch (error) {
      console.error('Error fetching archived classes:', error);
      setClasses([]);
      setFilteredClasses([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedClasses();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredClasses(classes);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredClasses(
        classes.filter((c) =>
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
          c.teacherName?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, classes]);

  const handleUnarchive = async (classId: string) => {
    try {
      await apiUnarchiveClass(classId);
      setClasses(classes.filter((c) => c.id !== classId));
      setFilteredClasses(filteredClasses.filter((c) => c.id !== classId));
      toast({
        title: 'Class Unarchived',
        description: 'The class has been restored to your active classes.',
      });
    } catch (error) {
      console.error('Error unarchiving class:', error);
      toast({
        title: 'Error',
        description: 'Failed to unarchive class. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="py-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Archived Classes</h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher
              ? 'View and manage your archived classes'
              : 'View your archived classes'}
          </p>
        </div>
        
        <Button asChild variant="outline">
          <Link to="/classes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Classes
          </Link>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, description, or teacher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Classes Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="h-48 rounded-lg bg-gray-100 animate-pulse"
            ></div>
          ))}
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <Archive className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? 'No classes found' : 'No archived classes'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchQuery
              ? 'Try adjusting your search query.'
              : 'You haven\'t archived any classes yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClasses.map((classItem) => (
            <Card key={classItem.id} className="flex flex-col h-full">
              <CardHeader className="flex-none">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl font-bold">{classItem.name}</CardTitle>
                    {classItem.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {classItem.description}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="space-y-2 text-sm text-gray-500">
                  {!isTeacher && (
                    <div>Teacher: {classItem.teacherName}</div>
                  )}
                  {isTeacher && (
                    <>
                      <div>{classItem.studentCount || 0} Students</div>
                      <div>{classItem.assignmentCount || 0} Assignments</div>
                    </>
                  )}
                  <div className="text-xs text-gray-400">
                    Archived on {new Date(classItem.updatedAt || classItem.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-none space-x-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleUnarchive(classItem.id)}
                >
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Unarchive
                </Button>
                <Button asChild variant="default" className="flex-1">
                  <Link to={`/classes/${classItem.id}`}>
                    View Class
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArchivedClassesPage;

