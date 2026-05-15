import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SidebarProvider, useSidebar } from '../../context/SidebarContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import LoadingScreen from '../ui/LoadingScreen';
import { cn } from '../../lib/utils';

const AppLayoutContent: React.FC = () => {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex flex-col h-screen bg-background">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main 
          className={cn(
            'flex-1 overflow-y-auto animate-in-right transition-all duration-300',
            'bg-background dark:bg-background',
            // Adjust padding based on sidebar state - less padding when collapsed for more space
            isCollapsed ? 'p-3 md:p-4' : 'p-4 md:p-6'
          )}
        >
          <div className={cn(
            'container mx-auto',
            // Increase max width when sidebar is collapsed to use more screen space
            isCollapsed ? 'max-w-full px-2' : 'max-w-7xl'
          )}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  return (
    <SidebarProvider>
      <AppLayoutContent />
    </SidebarProvider>
  );
};

export default AppLayout;
