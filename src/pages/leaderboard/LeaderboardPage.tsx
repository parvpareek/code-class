import React, { useState, useEffect } from 'react';
import { getLeaderboard } from '../../api/analytics';
import { getClasses } from '../../api/classes';
import { LeaderboardEntry, Class } from '../../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../../components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import LeaderboardTable from '../../components/leaderboard/LeaderboardTable';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { Trophy } from 'lucide-react';
import { useDataRefresh, DATA_REFRESH_EVENTS } from '../../utils/dataRefresh';

const formSchema = z.object({
  selectedClass: z.string().optional(),
  sortBy: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const LeaderboardPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedClass: 'all',
      sortBy: 'assignments',
    },
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch classes first
        const classesResponse = await getClasses();
        setClasses(classesResponse.classes || []);
        
        // Fetch initial leaderboard with default values
        await fetchLeaderboard('all', 'assignments');
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setClasses([]); // Ensure empty array on error
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const fetchLeaderboard = async (classId?: string, sortBy?: string) => {
    setIsLoading(true);
    try {
      const normalizedClassId = classId === 'all' ? undefined : classId;
      const leaderboardData = await getLeaderboard(normalizedClassId, sortBy);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      // Don't set leaderboard to empty on error, keep previous data
    } finally {
      setIsLoading(false);
    }
  };

  const onClassChange = (classId: string) => {
    form.setValue('selectedClass', classId);
    const currentSortBy = form.getValues('sortBy');
    fetchLeaderboard(classId, currentSortBy);
  };

  const onSortChange = (sortBy: string) => {
    form.setValue('sortBy', sortBy);
    const currentClass = form.getValues('selectedClass');
    fetchLeaderboard(currentClass, sortBy);
  };

  // Listen for leaderboard refresh events to update data when assignments change
  useDataRefresh(DATA_REFRESH_EVENTS.LEADERBOARD_UPDATED, () => {
    const currentClass = form.getValues('selectedClass');
    const currentSortBy = form.getValues('sortBy');
    fetchLeaderboard(currentClass, currentSortBy);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground mt-2">
          Top performers ranked by completed assignments and submission speed.
        </p>
      </div>

      <div className="mb-6">
        <Form {...form}>
          <div className="flex flex-col md:flex-row gap-4">
            <FormField
              control={form.control}
              name="selectedClass"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Filter by Class</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={onClassChange}
                      value={field.value}
                      defaultValue="all"
                    >
                      <SelectTrigger className="w-full md:w-[300px]">
                        <SelectValue placeholder="All Classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sortBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sort by</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={onSortChange}
                      value={field.value}
                      defaultValue="assignments"
                    >
                      <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="Sort by..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assignments">Assignment Progress</SelectItem>
                        <SelectItem value="leetcode">LeetCode Performance</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </Form>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <Trophy className="h-6 w-6 text-yellow-500 dark:text-yellow-400" />
            <CardTitle>Top Students</CardTitle>
          </div>
          <CardDescription>
            {form.watch('sortBy') === 'leetcode' 
              ? 'Students ranked by LeetCode performance and assignment completion'
              : 'Students ranked by completed assignments and submission speed'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeaderboardTable entries={leaderboard} />
        </CardContent>
      </Card>

      <div className="mt-6 text-sm text-muted-foreground">
        <p>
          <strong>Note:</strong> {form.watch('sortBy') === 'leetcode' 
            ? 'Rankings prioritize LeetCode problems solved, then assignment completion and submission speed.'
            : 'Rankings are calculated based on completed assignments and average submission speed (time between assignment and submission).'
          }
        </p>
      </div>
    </div>
  );
};

export default LeaderboardPage;
