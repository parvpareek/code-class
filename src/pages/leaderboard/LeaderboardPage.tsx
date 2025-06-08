
import React, { useState, useEffect } from 'react';
import { getLeaderboard, getWeeklyLeaderboard, getMonthlyLeaderboard } from '../../api/analytics';
import { getMyClasses } from '../../api/classes';
import { LeaderboardEntry, Class } from '../../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../../components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import LeaderboardTable from '../../components/leaderboard/LeaderboardTable';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { Trophy, Calendar, TrendingUp } from 'lucide-react';

const formSchema = z.object({
  selectedClass: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const LeaderboardPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('overall');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedClass: 'all',
    },
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [classesData, leaderboardData, weeklyData, monthlyData] = await Promise.all([
          getMyClasses(),
          getLeaderboard(), // Fetch global leaderboard initially
          getWeeklyLeaderboard(),
          getMonthlyLeaderboard(),
        ]);

        setClasses(classesData);
        setLeaderboard(leaderboardData);
        setWeeklyLeaderboard(weeklyData);
        setMonthlyLeaderboard(monthlyData);
      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const onClassChange = async (classId: string) => {
    setIsLoading(true);
    try {
      const [overallData, weeklyData, monthlyData] = await Promise.all([
        getLeaderboard(classId === 'all' ? undefined : classId),
        getWeeklyLeaderboard(classId === 'all' ? undefined : classId),
        getMonthlyLeaderboard(classId === 'all' ? undefined : classId),
      ]);

      setLeaderboard(overallData);
      setWeeklyLeaderboard(weeklyData);
      setMonthlyLeaderboard(monthlyData);
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
        </Form>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overall" className="flex items-center space-x-2">
            <Trophy className="h-4 w-4" />
            <span>Overall</span>
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>This Week</span>
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>This Month</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overall" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                <CardTitle>Overall Leaderboard</CardTitle>
              </div>
              <CardDescription>
                All-time rankings based on total completed problems and submission speed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeaderboardTable entries={leaderboard} showScore={true} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="h-6 w-6 text-blue-500" />
                <CardTitle>Weekly Leaderboard</CardTitle>
              </div>
              <CardDescription>
                Rankings for problems completed this week (Monday to Sunday)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeaderboardTable entries={weeklyLeaderboard} showScore={true} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-6 w-6 text-green-500" />
                <CardTitle>Monthly Leaderboard</CardTitle>
              </div>
              <CardDescription>
                Rankings for problems completed this month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeaderboardTable entries={monthlyLeaderboard} showScore={true} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 text-sm text-muted-foreground">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">🏆 Scoring System</h4>
          <ul className="space-y-1">
            <li><strong>Base Score:</strong> 100 points per completed problem</li>
            <li><strong>Speed Bonus:</strong> Up to 50 additional points for faster submissions</li>
            <li><strong>Quick Submit:</strong> Problems solved within 24 hours get maximum bonus</li>
            <li><strong>Time Calculation:</strong> Measured from assignment date to submission time</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
