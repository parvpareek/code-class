/**
 * Logger utility that conditionally logs based on environment
 * Reduces I/O overhead in production by disabling verbose logging
 */

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  /**
   * Logs messages only in development
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Always logs errors (important for production debugging)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Logs warnings only in development
   */
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Logs info messages only in development
   */
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Debug logging (only in development)
   */
  debug: (...args: any[]) => {
    if (isDev || process.env.DEBUG === 'true') {
      console.debug(...args);
    }
  },
};

