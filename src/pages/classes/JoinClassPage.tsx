import React from 'react';
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
import { joinClass } from '../../api/classes';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  joinCode: z.string().length(6, 'Join code must be 6 characters long'),
});

type FormValues = z.infer<typeof formSchema>;

const JoinClassPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      joinCode: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await joinClass(values.joinCode.toUpperCase());
      toast({
        title: 'Success!',
        description: 'You have successfully joined the class.',
      });
      navigate('/classes');
    } catch (error: any) {
      // Handle different types of errors with specific messages
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || 'Unknown error occurred';
        
        switch (status) {
          case 400:
            if (message.includes('already enrolled')) {
              toast({
                title: 'Already Enrolled',
                description: 'You are already a member of this class.',
                variant: 'default', // Use default variant instead of destructive
              });
            } else if (message.includes('cannot join your own class')) {
              toast({
                title: 'Cannot Join',
                description: 'You cannot join your own class as a student.',
                variant: 'destructive',
              });
            } else {
              toast({
                title: 'Invalid Request',
                description: message,
                variant: 'destructive',
              });
            }
            break;
          
          case 404:
            toast({
              title: 'Class Not Found',
              description: 'No class found with this join code. Please check the code and try again.',
              variant: 'destructive',
            });
            break;
            
          default:
            toast({
              title: 'Error',
              description: message || 'Failed to join class. Please try again.',
              variant: 'destructive',
            });
        }
      } else {
        // Network or other errors
        toast({
          title: 'Connection Error',
          description: 'Unable to connect to the server. Please check your internet connection.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="py-6">
      <h1 className="text-3xl font-bold tracking-tight">Join a Class</h1>
      <p className="text-muted-foreground mt-2">
        Enter the 6-character join code provided by your teacher.
      </p>

      <div className="mt-6 max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="joinCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Join Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., AB12CD"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Joining...' : 'Join Class'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default JoinClassPage;
