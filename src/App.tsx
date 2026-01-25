import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Analytics } from "@vercel/analytics/react";
import LoadingScreen from "./components/ui/LoadingScreen";

// Layouts
import AppLayout from "./components/layout/AppLayout";
import AuthLayout from "./components/layout/AuthLayout";
import TeacherRoute from "./components/layout/TeacherRoute";

// Auth Pages
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";

// App Pages
import HomePage from "./pages/home/HomePage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import ProfilePage from "./pages/user/ProfilePage";
import ClassesPage from "./pages/classes/ClassesPage";
import ArchivedClassesPage from "./pages/classes/ArchivedClassesPage";
import CreateClassPage from "./pages/classes/CreateClassPage";
import JoinClassPage from "./pages/classes/JoinClassPage";
import ClassDetailsPage from "./pages/classes/ClassDetailsPage";
import NewAssignmentPage from "./pages/assignments/NewAssignmentPage";
import AssignmentDetailsPage from "./pages/assignments/AssignmentDetailsPage";
import AnalyticsPage from "./pages/analytics/AnalyticsPage";
import LeaderboardPage from "./pages/leaderboard/LeaderboardPage";
import NotFoundPage from "./pages/NotFound";
import ClassSettingsPage from './pages/classes/ClassSettingsPage';
import EditAssignmentPage from './pages/assignments/EditAssignmentPage';
import PracticeQuestionsPage from  './pages/practice/PracticeQuestionsPage';
import StudentProfilePage from './pages/students/StudentProfilePage';
import TestsPage from './pages/tests/TestsPage';
import CreateTestPage from './pages/tests/CreateTestPage';
import TestTakingPage from './pages/tests/TestTakingPage';
import TestMonitoringPage from './pages/tests/TestMonitoringPage';
import TestResultsPage from './pages/tests/TestResultsPage';
import { StudentAnalyticsPage } from './pages/students/StudentAnalyticsPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';

const queryClient = new QueryClient();

// Component to handle root route logic
const RootRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/classes" replace />;
  }

  return <HomePage />;
};

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root route - redirect authenticated users to classes, show HomePage for guests */}
        <Route path="/" element={<RootRoute />} />
        
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>

        {/* Admin routes - separate from regular app */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Navigate to="/classes" replace />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/classes/archived" element={<ArchivedClassesPage />} />
          <Route path="/classes/create" element={<TeacherRoute><CreateClassPage /></TeacherRoute>} />
          <Route path="/classes/:classId" element={<ClassDetailsPage />} />
          <Route path="/classes/:classId/settings" element={<TeacherRoute><ClassSettingsPage /></TeacherRoute>} />
          <Route
            path="/classes/:classId/assignments/new"
            element={
              <TeacherRoute>
                <NewAssignmentPage />
              </TeacherRoute>
            }
          />
          <Route path="/assignments/:assignmentId" element={<AssignmentDetailsPage />} />
          <Route
            path="/assignments/:assignmentId/edit"
            element={
              <TeacherRoute>
                <EditAssignmentPage />
              </TeacherRoute>
            }
          />
          <Route path="/join-class" element={<JoinClassPage />} />
          <Route path="/practice" element={<PracticeQuestionsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/students/:studentId" element={<TeacherRoute><StudentProfilePage /></TeacherRoute>} />
          <Route path="/classes/:classId/students/:studentId/analytics" element={<TeacherRoute><StudentAnalyticsPage /></TeacherRoute>} />
          <Route path="/tests" element={<TestsPage />} />
          <Route path="/tests/new" element={<TeacherRoute><CreateTestPage /></TeacherRoute>} />
          <Route path="/classes/:classId/tests/new" element={<TeacherRoute><CreateTestPage /></TeacherRoute>} />
          <Route path="/tests/:testId/monitor" element={<TeacherRoute><TestMonitoringPage /></TeacherRoute>} />
          <Route path="/tests/:testId/results" element={<TestResultsPage />} />
        </Route>
        
        {/* Test taking route - outside AppLayout for fullscreen */}
        <Route path="/tests/:testId/take" element={<TestTakingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppContent />
            <Analytics />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
