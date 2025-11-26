import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { getClassDetails, updateClass, deleteClass as deleteClassApi } from '../../api/classes';

const ClassSettingsPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (user && user.role !== 'TEACHER') {
      navigate('/classes');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!classId) {
      return;
    }

    const fetchClass = async () => {
      setIsFetching(true);
      try {
        const classDetails = await getClassDetails(classId);
        setFormData({
          name: classDetails.name ?? '',
          description: classDetails.description ?? '',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Unable to load class details',
          variant: 'destructive',
        });
        navigate('/classes');
      } finally {
        setIsFetching(false);
      }
    };

    fetchClass();
  }, [classId, navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) return;

    setIsSaving(true);
    try {
      await updateClass(classId, {
        name: formData.name.trim(),
        description: formData.description.trim(),
      });

      toast({
        title: 'Success',
        description: 'Class settings updated successfully',
      });
      navigate(`/classes/${classId}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update class settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!classId) return;

    if (!window.confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteClassApi(classId);

      toast({
        title: 'Success',
        description: 'Class deleted successfully',
      });
      navigate('/classes');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete class',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (user && user.role !== 'TEACHER') {
    return null;
  }

  if (isFetching) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Class Settings</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading class information...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Class Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Class Name
              </label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSaving || isDeleting}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSaving || isDeleting}
                rows={4}
              />
            </div>
            <div className="flex justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Class'
                )}
              </Button>
              <Button type="submit" disabled={isSaving || isDeleting}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClassSettingsPage; 