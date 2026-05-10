import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../../components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { createClass } from '../../api/classes';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Class } from '../../types';
import { Copy } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(3, 'Class name must be at least 3 characters'),
});

type FormValues = z.infer<typeof formSchema>;

const CreateClassPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [createdClass, setCreatedClass] = useState<Class | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const newClass = await createClass(values.name);
      setCreatedClass(newClass);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create class. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  const copyJoinCode = () => {
    if (createdClass) {
      navigator.clipboard.writeText(createdClass.joinCode);
      toast({
        title: 'Copied!',
        description: 'Join code copied to clipboard.',
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold tracking-tight">Create a New Class</h1>
      <p className="text-muted-foreground mt-2">
        A unique join code will be generated for your students to join.
      </p>

      <div className="mt-6 max-w-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Class Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Data Structures and Algorithms" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating...' : 'Create Class'}
            </Button>
          </form>
        </Form>
      </div>

      {createdClass && (
        <AlertDialog open onOpenChange={() => setCreatedClass(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Class Created Successfully!</AlertDialogTitle>
              <AlertDialogDescription>
                Your new class "{createdClass.name}" has been created. Share the code
                below with your students to let them join.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4">
              <p className="text-sm font-semibold text-gray-500">JOIN CODE</p>
              <div className="flex items-center space-x-2 mt-1">
                <div className="w-full p-2 border rounded-md font-mono text-lg text-center bg-gray-50">
                  {createdClass.joinCode}
                </div>
                <Button variant="outline" size="icon" onClick={copyJoinCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => navigate('/classes')}>
                Done
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default CreateClassPage;
