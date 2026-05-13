import React, { useState, useEffect, useCallback } from 'react';
import { getLeaderboard } from '../../api/analytics';
import { getClasses } from '../../api/classes';
import { LeaderboardEntry, Class } from '../../types';
import { useAuth } from '../../context/AuthContext';
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
  const { user, isLoading: authLoading } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const [classes, setClasses] = useState<Class[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pageLoading, setPageLoading] = useState<boolean>(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedClass: 'all',
      sortBy: 'assignments',
    },
  });

  const loadLeaderboard = useCallback(
    async (selectedClass: string | undefined, sortBy: string | undefined) => {
      setPageLoading(true);
      try {
        const normalizedClassId = selectedClass === 'all' || !selectedClass ? undefined : selectedClass;
        const data = await getLeaderboard(normalizedClassId, sortBy);
        setLeaderboard(data);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setPageLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    const init = async () => {
      setPageLoading(true);
      try {
        const classesResponse = await getClasses();
        if (cancelled) return;
        const list = classesResponse.classes || [];
        setClasses(list);

        if (!user) {
          setLeaderboard([]);
          return;
        }

        if (user.role === 'STUDENT') {
          if (list.length === 0) {
            setLeaderboard([]);
          } else {
            const firstId = list[0].id;
            form.setValue('selectedClass', firstId);
            const normalizedClassId = firstId;
            const data = await getLeaderboard(normalizedClassId, 'assignments');
            if (!cancelled) setLeaderboard(data);
          }
        } else {
          form.setValue('selectedClass', 'all');
          const data = await getLeaderboard(undefined, 'assignments');
          if (!cancelled) setLeaderboard(data);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        if (!cancelled) setClasses([]);
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, user?.role]);

  const onClassChange = (classId: string) => {
    form.setValue('selectedClass', classId);
    void loadLeaderboard(classId, form.getValues('sortBy'));
  };

  const onSortChange = (sortBy: string) => {
    form.setValue('sortBy', sortBy);
    void loadLeaderboard(form.getValues('selectedClass'), sortBy);
  };

  useDataRefresh(
    DATA_REFRESH_EVENTS.LEADERBOARD_UPDATED,
    () => {
      void loadLeaderboard(form.getValues('selectedClass'), form.getValues('sortBy'));
    },
    [loadLeaderboard]
  );

  if (authLoading || pageLoading) {
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
                    <Select onValueChange={onClassChange} value={field.value} defaultValue="all">
                      <SelectTrigger className="w-full md:w-[300px]">
                        <SelectValue placeholder={isStudent ? 'Select class' : 'All Classes'} />
                      </SelectTrigger>
                      <SelectContent>
                        {!isStudent && <SelectItem value="all">All Classes</SelectItem>}
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
                    <Select onValueChange={onSortChange} value={field.value} defaultValue="assignments">
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
              : 'Students ranked by completed assignments and submission speed'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeaderboardTable entries={leaderboard} peerNavigation={peerNavigation} />
        </CardContent>
      </Card>

      <div className="mt-6 text-sm text-muted-foreground">
        <p>
          <strong>Note:</strong>{' '}
          {form.watch('sortBy') === 'leetcode'
            ? 'Rankings prioritize LeetCode problems solved, then assignment completion and submission speed.'
            : 'Rankings are calculated based on completed assignments and average submission speed (time between assignment and submission).'}
        </p>
      </div>
    </div>
  );
};

export default LeaderboardPage;
