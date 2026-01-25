import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSystemStats,
  getMemoryMetrics,
  getCpuMetrics,
  getSystemMetrics,
  getAllUsers,
  deleteUser,
  updateUser,
  exportUsers,
  SystemStats,
  User,
  MemoryMetrics,
  CpuMetrics,
} from '../../api/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  Users,
  Database,
  Activity,
  TrendingUp,
  Server,
  Download,
  LogOut,
  RefreshCw,
  Search,
  Trash2,
  Edit,
} from 'lucide-react';
import LoadingScreen from '../../components/ui/LoadingScreen';

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [memoryMetrics, setMemoryMetrics] = useState<MemoryMetrics | null>(null);
  const [cpuMetrics, setCpuMetrics] = useState<CpuMetrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [statsData, memoryData, cpuData, usersData] = await Promise.all([
        getSystemStats(),
        getMemoryMetrics(),
        getCpuMetrics(),
        getAllUsers({
          page: pagination.page,
          limit: pagination.limit,
          role: roleFilter !== 'all' ? roleFilter : undefined,
          search: searchTerm || undefined,
        }),
      ]);

      setStats(statsData);
      setMemoryMetrics(memoryData);
      setCpuMetrics(cpuData);
      setUsers(usersData.users);
      setPagination(usersData.pagination);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to load admin data';
      setError(errorMessage);
      if (err.response?.status === 401) {
        // Token expired, redirect to login
        navigate('/admin/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pagination.page, roleFilter, searchTerm]);

  // Auto-refresh metrics every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [memoryData, cpuData] = await Promise.all([
          getMemoryMetrics(),
          getCpuMetrics(),
        ]);
        setMemoryMetrics(memoryData);
        setCpuMetrics(cpuData);
      } catch (err) {
        // Silently fail for auto-refresh
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await deleteUser(userId);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleExportUsers = async () => {
    try {
      const blob = await exportUsers();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to export users');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (isLoading && !stats) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              System monitoring and user management
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* System Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.overview.totalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.overview.totalStudents} students, {stats.overview.totalTeachers} teachers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.overview.totalClasses}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.overview.totalAssignments} assignments
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Submissions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.overview.totalSubmissions}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.overview.completionRate}% completion rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.recentActivity.newUsers24h}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.recentActivity.newSubmissions24h} submissions (24h)
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Real-time Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {memoryMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Heap Used:</span>
                    <span className="font-mono">{memoryMetrics.memory.heapUsed.toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Heap Total:</span>
                    <span className="font-mono">{memoryMetrics.memory.heapTotal.toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>RSS:</span>
                    <span className="font-mono">{memoryMetrics.memory.rss.toFixed(2)} MB</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {cpuMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>User:</span>
                    <span className="font-mono">{(cpuMetrics.cpu.user / 1000).toFixed(2)}ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>System:</span>
                    <span className="font-mono">{(cpuMetrics.cpu.system / 1000).toFixed(2)}ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Estimated:</span>
                    <span className="font-mono">{cpuMetrics.cpu.estimatedPercent.toFixed(2)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {stats && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Platform Integrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>LeetCode:</span>
                    <span>{stats.platformIntegrations.leetcode.linked} linked</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HackerRank:</span>
                    <span>{stats.platformIntegrations.hackerrank.linked} linked</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GFG:</span>
                    <span>{stats.platformIntegrations.gfg.linked} linked</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* User Management */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage all users in the system</CardDescription>
              </div>
              <Button onClick={handleExportUsers} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="STUDENT">Students</SelectItem>
                  <SelectItem value="TEACHER">Teachers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            user.role === 'TEACHER' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {user.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {user.leetcodeUsername && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                LC
                              </span>
                            )}
                            {user.hackerrankUsername && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                HR
                              </span>
                            )}
                            {user.gfgUsername && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                GFG
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboardPage;

