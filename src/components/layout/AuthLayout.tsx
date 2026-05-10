import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingScreen from '../ui/LoadingScreen';

const AuthLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/classes" />;
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background flex flex-col">
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-brand-blue flex items-center justify-center">
              <span className="text-white text-xl font-bold">CC</span>
            </div>
          </div>
          <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900 dark:text-gray-100">
            Coding Classroom
          </h2>
        </div>
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[440px]">
          <div className="rounded-2xl border border-border/80 bg-card px-6 py-10 shadow-lg shadow-black/5 dark:shadow-black/30 sm:px-10">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
