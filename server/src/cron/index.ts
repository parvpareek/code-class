import cron from 'node-cron';
import { syncAllLinkedLeetCodeUsers } from '../services/enhanced-leetcode.service';

/**
 * REMOVED: Automatic submission checking for all users
 * Submission checking should ONLY be triggered manually via API endpoints:
 * - Student clicks "Check Submissions" for a specific assignment
 * - Teacher manually triggers submission check for a specific assignment
 * 
 * No automatic/cron job should check submissions for all users.
 */

/**
 * Schedules LeetCode data sync to run every 4 hours
 */
export const scheduleLeetCodeSync = () => {
  cron.schedule('0 */4 * * *', () => {
    console.log('Running LeetCode data sync...');
    syncAllLinkedLeetCodeUsers().catch(error => {
      console.error('Error during scheduled LeetCode sync:', error);
    });
  });

  console.log('Scheduled LeetCode sync to run every 4 hours.');
};

/**
 * Initialize all scheduled jobs
 * NOTE: Submission checking is NOT scheduled - must be done manually
 */
export const initializeScheduledJobs = () => {
  // Removed scheduleSubmissionChecks() - no automatic submission checking
  scheduleLeetCodeSync();
}; 