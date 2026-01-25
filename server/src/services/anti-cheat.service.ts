import prisma from '../lib/prisma';
// WebSocket service removed - using console logging instead for notifications

export enum ViolationType {
  TAB_SWITCH = 'TAB_SWITCH',
  FULLSCREEN_EXIT = 'FULLSCREEN_EXIT',
  COPY_PASTE = 'COPY_PASTE',
  DEV_TOOLS = 'DEV_TOOLS',
  FOCUS_LOSS = 'FOCUS_LOSS',
  CONTEXT_MENU = 'CONTEXT_MENU'
}

export enum PenaltyLevel {
  WARNING = 'WARNING',
  MINOR = 'MINOR',
  MAJOR = 'MAJOR',
  TERMINATION = 'TERMINATION'
}

interface ViolationConfig {
  warningThreshold: number;
  minorThreshold: number;
  majorThreshold: number;
  terminationThreshold: number;
  scoreReduction: number;
  timePenalty: number; // in seconds
}

export class AntiCheatService {
  private static readonly VIOLATION_CONFIGS: Record<ViolationType, ViolationConfig> = {
    [ViolationType.TAB_SWITCH]: {
      warningThreshold: 1,
      minorThreshold: 3,
      majorThreshold: 5,
      terminationThreshold: 8,
      scoreReduction: 5,
      timePenalty: 30
    },
    [ViolationType.FULLSCREEN_EXIT]: {
      warningThreshold: 1,
      minorThreshold: 2,
      majorThreshold: 3,
      terminationThreshold: 5,
      scoreReduction: 10,
      timePenalty: 60
    },
    [ViolationType.COPY_PASTE]: {
      warningThreshold: 1,
      minorThreshold: 2,
      majorThreshold: 3,
      terminationThreshold: 4,
      scoreReduction: 15,
      timePenalty: 120
    },
    [ViolationType.DEV_TOOLS]: {
      warningThreshold: 0,
      minorThreshold: 1,
      majorThreshold: 2,
      terminationThreshold: 3,
      scoreReduction: 20,
      timePenalty: 180
    },
    [ViolationType.FOCUS_LOSS]: {
      warningThreshold: 3,
      minorThreshold: 6,
      majorThreshold: 10,
      terminationThreshold: 15,
      scoreReduction: 2,
      timePenalty: 10
    },
    [ViolationType.CONTEXT_MENU]: {
      warningThreshold: 1,
      minorThreshold: 3,
      majorThreshold: 5,
      terminationThreshold: 7,
      scoreReduction: 5,
      timePenalty: 30
    }
  };

  /**
   * Record a violation and determine penalty
   */
  static async recordViolation(
    sessionId: string,
    violationType: ViolationType,
    details?: any
  ): Promise<{
    penalty: PenaltyLevel;
    shouldTerminate: boolean;
    message: string;
    totalViolations: number;
  }> {
    try {
      // Get current session with relations
      const session = await prisma.testSession.findUnique({
        where: { id: sessionId },
        include: {
          user: { select: { name: true, email: true } },
          test: { 
            select: { 
              title: true, 
              class: { select: { teacherId: true } }
            } 
          },
          penalties: true
        }
      });

      if (!session) {
        throw new Error('Test session not found');
      }

      // Count violations of this type by filtering penalties
      const typeViolations = session.penalties.filter(p => p.violationType === violationType);
      const violationCount = typeViolations.length + 1;
      const config = this.VIOLATION_CONFIGS[violationType];

      // Determine penalty level
      let penaltyLevel: PenaltyLevel;
      let shouldTerminate = false;

      if (violationCount >= config.terminationThreshold) {
        penaltyLevel = PenaltyLevel.TERMINATION;
        shouldTerminate = true;
      } else if (violationCount >= config.majorThreshold) {
        penaltyLevel = PenaltyLevel.MAJOR;
      } else if (violationCount >= config.minorThreshold) {
        penaltyLevel = PenaltyLevel.MINOR;
      } else {
        penaltyLevel = PenaltyLevel.WARNING;
      }

      // Create penalty record
      const penalty = await prisma.testPenalty.create({
        data: {
          sessionId,
          type: violationType as any, // Map to PenaltyType for compatibility
          violationType,
          penaltyLevel,
          description: `${violationType} violation - ${penaltyLevel}`,
          scoreReduction: penaltyLevel === PenaltyLevel.WARNING ? 0 : config.scoreReduction,
          timePenalty: penaltyLevel === PenaltyLevel.WARNING ? 0 : config.timePenalty,
          details,
          timestamp: new Date()
        }
      });

      // Update session penalty totals
      await this.updateSessionPenalties(sessionId);

      // Generate appropriate message
      const message = this.generatePenaltyMessage(violationType, penaltyLevel, violationCount);

      // Notify teacher in real-time
      await this.notifyTeacher(session.test.class.teacherId, {
        type: 'VIOLATION_DETECTED',
        sessionId,
        studentName: session.user.name,
        studentEmail: session.user.email,
        testTitle: session.test.title,
        violationType,
        penaltyLevel,
        violationCount,
        shouldTerminate,
        timestamp: new Date()
      });

      // WebSocket notifications disabled (WebSocket service removed to save memory)
      // Log penalty for debugging instead
      console.log(`[Anti-Cheat] Penalty applied to session ${sessionId}: ${penaltyLevel} - ${message}`);
      // WebSocketService.notifyStudent(sessionId, {
      //   type: 'PENALTY_APPLIED',
      //   penalty: {
      //     level: penaltyLevel,
      //     message,
      //     violationType,
      //     count: violationCount,
      //     shouldTerminate
      //   }
      // });

      console.log(`Violation recorded: ${violationType} for session ${sessionId}, penalty: ${penaltyLevel}`);

      return {
        penalty: penaltyLevel,
        shouldTerminate,
        message,
        totalViolations: violationCount
      };

    } catch (error) {
      console.error('Error recording violation:', error);
      throw error;
    }
  }

  /**
   * Update session penalty totals
   */
  private static async updateSessionPenalties(sessionId: string): Promise<void> {
    try {
      // Get all penalties for this session
      const penalties = await prisma.testPenalty.findMany({
        where: { sessionId }
      });

      // Calculate totals
      const totalPenalties = penalties.length;
      const scoreReduction = penalties.reduce((sum, p) => sum + (p.scoreReduction || 0), 0);
      const timePenalty = penalties.reduce((sum, p) => sum + (p.timePenalty || 0), 0);

      // Update session
      await prisma.testSession.update({
        where: { id: sessionId },
        data: {
          totalPenalties,
          scoreReduction,
          timePenalty,
          penaltyCount: totalPenalties
        }
      });
    } catch (error) {
      console.error('Error updating session penalties:', error);
    }
  }

  /**
   * Generate user-friendly penalty message
   */
  private static generatePenaltyMessage(
    violationType: ViolationType,
    penaltyLevel: PenaltyLevel,
    violationCount: number
  ): string {
    const violationMessages = {
      [ViolationType.TAB_SWITCH]: 'switching tabs',
      [ViolationType.FULLSCREEN_EXIT]: 'exiting fullscreen mode',
      [ViolationType.COPY_PASTE]: 'using copy/paste operations',
      [ViolationType.DEV_TOOLS]: 'attempting to access developer tools',
      [ViolationType.FOCUS_LOSS]: 'losing window focus',
      [ViolationType.CONTEXT_MENU]: 'using context menu'
    };

    const action = violationMessages[violationType];
    const config = this.VIOLATION_CONFIGS[violationType];

    switch (penaltyLevel) {
      case PenaltyLevel.WARNING:
        return `⚠️ Warning: Please avoid ${action}. This is violation #${violationCount}. You have ${config.minorThreshold - violationCount} more chances before penalties apply.`;
      
      case PenaltyLevel.MINOR:
        return `🔶 Minor Penalty: ${action} detected (violation #${violationCount}). Score reduced by ${config.scoreReduction}% and ${config.timePenalty} seconds added to your time.`;
      
      case PenaltyLevel.MAJOR:
        return `🔴 Major Penalty: Repeated ${action} (violation #${violationCount}). Significant score reduction of ${config.scoreReduction}% and ${config.timePenalty} seconds penalty applied.`;
      
      case PenaltyLevel.TERMINATION:
        return `❌ Test Terminated: Too many violations for ${action} (${violationCount} violations). Your test has been automatically submitted.`;
      
      default:
        return `Violation detected: ${action}`;
    }
  }

  /**
   * Notify teacher of violations
   */
  private static async notifyTeacher(teacherId: string, notification: any): Promise<void> {
    // WebSocket notifications disabled (WebSocket service removed to save memory)
    // Log notification for debugging instead
    console.log(`[Anti-Cheat] Teacher notification for ${teacherId}:`, notification);
    // try {
    //   WebSocketService.notifyTeacher(teacherId, notification);
    // } catch (error) {
    //   console.error('Error notifying teacher:', error);
    // }
  }

  /**
   * Get session violation summary
   */
  static async getSessionViolations(sessionId: string): Promise<{
    totalViolations: number;
    violationsByType: Record<ViolationType, number>;
    totalScoreReduction: number;
    totalTimePenalty: number;
    shouldTerminate: boolean;
  }> {
    try {
      const penalties = await prisma.testPenalty.findMany({
        where: { sessionId }
      });

      const violationsByType: Record<ViolationType, number> = {
        [ViolationType.TAB_SWITCH]: 0,
        [ViolationType.FULLSCREEN_EXIT]: 0,
        [ViolationType.COPY_PASTE]: 0,
        [ViolationType.DEV_TOOLS]: 0,
        [ViolationType.FOCUS_LOSS]: 0,
        [ViolationType.CONTEXT_MENU]: 0
      };

      let totalScoreReduction = 0;
      let totalTimePenalty = 0;
      let shouldTerminate = false;

      penalties.forEach((penalty: any) => {
        const vType = penalty.violationType as ViolationType;
        if (vType && violationsByType.hasOwnProperty(vType)) {
          violationsByType[vType]++;
        }
        totalScoreReduction += penalty.scoreReduction || 0;
        totalTimePenalty += penalty.timePenalty || 0;
        
        if (penalty.penaltyLevel === PenaltyLevel.TERMINATION) {
          shouldTerminate = true;
        }
      });

      return {
        totalViolations: penalties.length,
        violationsByType,
        totalScoreReduction,
        totalTimePenalty,
        shouldTerminate
      };

    } catch (error) {
      console.error('Error getting session violations:', error);
      throw error;
    }
  }

  /**
   * Get test violation statistics
   */
  static async getTestViolationStats(testId: string): Promise<{
    totalSessions: number;
    sessionsWithViolations: number;
    violationsByType: Record<ViolationType, number>;
    highRiskSessions: any[];
  }> {
    try {
      const sessions = await prisma.testSession.findMany({
        where: { testId },
        include: {
          penalties: true,
          user: { select: { name: true, email: true } }
        }
      });

      const violationsByType: Record<ViolationType, number> = {
        [ViolationType.TAB_SWITCH]: 0,
        [ViolationType.FULLSCREEN_EXIT]: 0,
        [ViolationType.COPY_PASTE]: 0,
        [ViolationType.DEV_TOOLS]: 0,
        [ViolationType.FOCUS_LOSS]: 0,
        [ViolationType.CONTEXT_MENU]: 0
      };

      let sessionsWithViolations = 0;
      const highRiskSessions: any[] = [];

      sessions.forEach(session => {
        if (session.penalties.length > 0) {
          sessionsWithViolations++;

          session.penalties.forEach((penalty: any) => {
            const vType = penalty.violationType as ViolationType;
            if (vType && violationsByType.hasOwnProperty(vType)) {
              violationsByType[vType]++;
            }
          });

          // Mark as high risk if 5+ violations
          if (session.penalties.length >= 5) {
            highRiskSessions.push({
              sessionId: session.id,
              userId: session.userId,
              userName: session.user.name,
              violationCount: session.penalties.length
            });
          }
        }
      });

      return {
        totalSessions: sessions.length,
        sessionsWithViolations,
        violationsByType,
        highRiskSessions
      };

    } catch (error) {
      console.error('Error getting test violation stats:', error);
      throw error;
    }
  }

  /**
   * Check if session should be terminated
   */
  static async shouldTerminateSession(sessionId: string): Promise<boolean> {
    try {
      const penalties = await prisma.testPenalty.findMany({
        where: { 
          sessionId,
          penaltyLevel: PenaltyLevel.TERMINATION
        }
      });

      return penalties.length > 0;
    } catch (error) {
      console.error('Error checking termination status:', error);
      return false;
    }
  }
} 