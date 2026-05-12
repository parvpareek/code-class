import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContextType, AuthState, User } from '../types';
import * as authApi from '../api/auth';
import { clearAuthToken, getAuthToken, setAuthToken } from '../lib/authTokenStorage';
import { writeLastSignInMethod } from '../lib/lastSignInStorage';

const initialState: AuthState = {
  user: null,
  token: typeof window !== 'undefined' ? getAuthToken() : null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

export const AuthContext = createContext<AuthContextType>({
  ...initialState,
  login: async () => {},
  logout: () => {},
  updateProfile: async () => {},
  refreshUser: async () => {},
  clearError: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(initialState);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = getAuthToken();

        if (token) {
          const user = await authApi.getCurrentUser();

          setAuthState({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          setAuthState({
            ...initialState,
            isLoading: false,
          });
        }
      } catch (error) {
        clearAuthToken();
        localStorage.removeItem('user');

        setAuthState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Session expired, please log in again.',
        });
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { user, token } = await authApi.login(email, password);

      writeLastSignInMethod('EMAIL_PASSWORD');

      setAuthToken(token);
      localStorage.setItem('user', JSON.stringify(user));

      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.message || 'Login failed. Please check your credentials.',
      }));
    }
  };

  const logout = () => {
    clearAuthToken();
    localStorage.removeItem('user');

    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  };

  const updateProfile = async (data: {
    hackerrankUsername?: string;
    leetcodeUsername?: string;
    gfgUsername?: string;
  }) => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      const updatedUser = await authApi.updateUserProfile(data);

      localStorage.setItem('user', JSON.stringify(updatedUser));

      setAuthState((prev) => ({
        ...prev,
        user: updatedUser as User,
        isLoading: false,
      }));
    } catch (error: any) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.message || 'Failed to update profile.',
      }));
    }
  };

  const clearError = () => {
    setAuthState((prev) => ({ ...prev, error: null }));
  };

  const refreshUser = async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      const user = await authApi.getCurrentUser();

      localStorage.setItem('user', JSON.stringify(user));

      setAuthState((prev) => ({
        ...prev,
        user: user as User,
        isLoading: false,
      }));
    } catch (error: any) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.message || 'Failed to refresh user data.',
      }));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        updateProfile,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
