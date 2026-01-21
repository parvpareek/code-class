import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  testId?: string;
  sessionId?: string;
  userName?: string;
}

interface SocketData {
  userId: string;
  userRole: string;
  testId?: string;
  sessionId?: string;
}

export class WebSocketService {
  private io: SocketIOServer;
  private connectedUsers = new Map<string, string>(); // userId -> socketId
  private testRooms = new Map<string, Set<string>>(); // testId -> Set of socketIds
  private cleanupInterval: NodeJS.Timeout;

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: [
          'http://localhost:8080',
          'http://localhost:3000',
          'https://codeclass.up.railway.app',
          'https://code-class-eight.vercel.app'
        ],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    
    // Periodic cleanup of stale connections (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 5 * 60 * 1000);
    
    console.log('WebSocket service initialized with memory leak prevention');
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        // Fetch user details
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, role: true, name: true }
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.userRole = user.role;
        socket.userName = user.name;

        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: any) => {
      console.log(`User ${socket.userId} (${socket.userRole}) connected`);
      
      // Store connection
      this.connectedUsers.set(socket.userId, socket.id);

      // Handle test session joining
      socket.on('join-test', async (data: { testId: string }) => {
        try {
          await this.handleJoinTest(socket, data.testId);
        } catch (error) {
          console.error('Error joining test:', error);
          socket.emit('error', { message: 'Failed to join test' });
        }
      });

      // Handle leaving test
      socket.on('leave-test', async () => {
        try {
          await this.handleLeaveTest(socket);
        } catch (error) {
          console.error('Error leaving test:', error);
        }
      });

      // Handle penalty reporting
      socket.on('penalty-event', async (data: { type: string; description: string }) => {
        try {
          await this.handlePenaltyEvent(socket, data);
        } catch (error) {
          console.error('Error handling penalty:', error);
        }
      });

      // Handle violation detection
      socket.on('violation-detected', async (data: { 
        sessionId: string; 
        violationType: string; 
        timestamp: Date; 
        details?: any 
      }) => {
        try {
          await this.handleViolationDetected(socket, data);
        } catch (error) {
          console.error('Error handling violation:', error);
        }
      });

      // Handle heartbeat to keep session alive
      socket.on('heartbeat', async () => {
        try {
          await this.handleHeartbeat(socket);
        } catch (error) {
          console.error('Error handling heartbeat:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        this.connectedUsers.delete(socket.userId);
        this.removeFromTestRooms(socket);
      });
    });
  }

  private async handleJoinTest(socket: any, testId: string) {
    // Verify test exists and user has access
    const test = await prisma.codingTest.findFirst({
      where: {
        id: testId,
        class: {
          students: {
            some: { userId: socket.userId }
          }
        }
      },
      include: {
        class: true,
        problems: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!test) {
      socket.emit('error', { message: 'Test not found or access denied' });
      return;
    }

    // Check if test is active
    const now = new Date();
    if (now < test.startTime || now > test.endTime) {
      socket.emit('error', { message: 'Test is not currently active' });
      return;
    }

    // Find or create test session
    let session = await prisma.testSession.findUnique({
      where: {
        testId_userId: {
          testId,
          userId: socket.userId
        }
      }
    });

    if (!session) {
      session = await prisma.testSession.create({
        data: {
          testId,
          userId: socket.userId,
          status: 'IN_PROGRESS'
        }
      });
    }

    // Join test room
    const roomName = `test-${testId}`;
    socket.join(roomName);
    socket.testId = testId;
    socket.sessionId = session.id;

    // Add to test room tracking
    if (!this.testRooms.has(testId)) {
      this.testRooms.set(testId, new Set());
    }
    this.testRooms.get(testId)!.add(socket.id);

    // Send test data to client
    socket.emit('test-joined', {
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        duration: test.duration,
        startTime: test.startTime,
        endTime: test.endTime,
        allowedLanguages: test.allowedLanguages,
        problems: (test as any).problems?.map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          constraints: p.constraints,
          examples: p.examples,
          difficulty: p.difficulty,
          timeLimit: p.timeLimit,
          memoryLimit: p.memoryLimit,
          order: p.order
        }))
      },
      session: {
        id: session.id,
        startedAt: session.startedAt,
        status: session.status,
        penaltyCount: session.penaltyCount,
        currentProblemIndex: session.currentProblemIndex
      }
    });

    // Notify teachers about student joining
    this.notifyTeachers(testId, 'student-joined', {
      userId: socket.userId,
      userName: socket.userName,
      sessionId: session.id
    });

    console.log(`User ${socket.userId} joined test ${testId}`);
  }

  private async handleLeaveTest(socket: any) {
    if (!socket.testId || !socket.sessionId) return;

    // Update session status
    await prisma.testSession.update({
      where: { id: socket.sessionId },
      data: {
        lastActivity: new Date()
      }
    });

    // Leave room
    socket.leave(`test-${socket.testId}`);
    
    // Remove from tracking
    this.removeFromTestRooms(socket);

    // Notify teachers
    this.notifyTeachers(socket.testId, 'student-left', {
      userId: socket.userId,
      sessionId: socket.sessionId
    });

    socket.testId = undefined;
    socket.sessionId = undefined;
  }

  private async handlePenaltyEvent(socket: any, data: { type: string; description: string }) {
    if (!socket.sessionId) return;

    // Record penalty in database
    await prisma.testPenalty.create({
      data: {
        sessionId: socket.sessionId,
        type: data.type as any,
        violationType: data.type as any,
        penaltyLevel: 'WARNING' as any,
        description: data.description,
        scoreReduction: 0,
        timePenalty: 0
      }
    });

    // Update session penalty count
    await prisma.testSession.update({
      where: { id: socket.sessionId },
      data: {
        penaltyCount: { increment: 1 },
        lastActivity: new Date()
      }
    });

    // Notify client
    socket.emit('penalty-recorded', {
      type: data.type,
      description: data.description,
      timestamp: new Date()
    });

    // Notify teachers
    this.notifyTeachers(socket.testId!, 'penalty-occurred', {
      userId: socket.userId,
      sessionId: socket.sessionId,
      type: data.type,
      description: data.description
    });

    console.log(`Penalty recorded for user ${socket.userId}: ${data.type}`);
  }

  private async handleViolationDetected(socket: any, data: {
    sessionId: string;
    violationType: string; 
    timestamp: Date;
    details?: any;
  }) {
    try {
      // Import anti-cheat service
      const { AntiCheatService } = await import('./anti-cheat.service');
      
      // Record the violation and get penalty info
      const result = await AntiCheatService.recordViolation(
        data.sessionId,
        data.violationType as any,
        data.details
      );

      // Send penalty response back to student
      socket.emit('penalty-applied', {
        level: result.penalty,
        message: result.message,
        violationType: data.violationType,
        count: result.totalViolations,
        shouldTerminate: result.shouldTerminate
      });

      // If termination required, force disconnect after delay
      if (result.shouldTerminate) {
        setTimeout(() => {
          socket.disconnect(true);
        }, 5000); // Give student 5 seconds to see the message
      }

      console.log(`Violation processed: ${data.violationType} for session ${data.sessionId}`);
    } catch (error) {
      console.error('Error handling violation detection:', error);
      socket.emit('error', { message: 'Failed to process violation' });
    }
  }

  private async handleHeartbeat(socket: any) {
    if (!socket.sessionId) return;

    // Update last activity
    await prisma.testSession.update({
      where: { id: socket.sessionId },
      data: {
        lastActivity: new Date()
      }
    });
  }

  private removeFromTestRooms(socket: any) {
    if (socket.testId && this.testRooms.has(socket.testId)) {
      this.testRooms.get(socket.testId)!.delete(socket.id);
      
      // Clean up empty rooms
      if (this.testRooms.get(socket.testId)!.size === 0) {
        this.testRooms.delete(socket.testId);
      }
    }
  }

  private async notifyTeachers(testId: string, event: string, data: any) {
    // Get teachers of the class
    const test = await prisma.codingTest.findUnique({
      where: { id: testId },
      include: {
        class: {
          select: { teacherId: true }
        }
      }
    });

    if (test?.class.teacherId) {
      const teacherSocketId = this.connectedUsers.get(test.class.teacherId);
      if (teacherSocketId) {
        this.io.to(teacherSocketId).emit(event, data);
      }
    }
  }

  // Public methods for external use

  /**
   * Start a test for a class
   */
  public async startTest(testId: string) {
    const roomName = `test-${testId}`;
    this.io.to(roomName).emit('test-started', { testId });
    
    // Update test status
    await prisma.codingTest.update({
      where: { id: testId },
      data: { isActive: true }
    });
  }

  /**
   * End a test for a class
   */
  public async endTest(testId: string) {
    const roomName = `test-${testId}`;
    this.io.to(roomName).emit('test-ended', { testId });
    
    // Update test status
    await prisma.codingTest.update({
      where: { id: testId },
      data: { isActive: false }
    });

    // Update all active sessions to completed
    await prisma.testSession.updateMany({
      where: {
        testId,
        status: 'IN_PROGRESS'
      },
      data: {
        status: 'COMPLETED',
        endedAt: new Date()
      }
    });
  }

  /**
   * Send time warning to test participants
   */
  public sendTimeWarning(testId: string, minutesLeft: number) {
    const roomName = `test-${testId}`;
    this.io.to(roomName).emit('time-warning', { minutesLeft });
  }

  /**
   * Force disconnect a student from test
   */
  public forceDisconnectStudent(userId: string, reason: string) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('force-disconnect', { reason });
      this.io.sockets.sockets.get(socketId)?.disconnect(true);
    }
  }

  /**
   * Get connected users for a test
   */
  public getTestParticipants(testId: string): number {
    return this.testRooms.get(testId)?.size || 0;
  }

  /**
   * Broadcast message to test room
   */
  public broadcastToTest(testId: string, event: string, data: any) {
    const roomName = `test-${testId}`;
    this.io.to(roomName).emit(event, data);
  }

  /**
   * Send real-time execution results to student
   */
  public sendExecutionResult(userId: string, result: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('execution-result', result);
    }
  }

  /**
   * Notify teachers about submission updates
   */
  public notifySubmissionUpdate(testId: string, submission: any) {
    this.notifyTeachers(testId, 'submission-update', submission);
  }

  /**
   * Send batch processing status updates
   */
  public sendBatchStatus(testId: string, status: { queueSize: number; processing: boolean }) {
    const roomName = `test-${testId}`;
    this.io.to(roomName).emit('batch-status', status);
  }

  /**
   * Send submission queue status to teachers
   */
  public sendQueueStatus(testId: string, queueData: any) {
    this.notifyTeachers(testId, 'queue-status', queueData);
  }

  /**
   * Notify student about penalty
   */
  public static notifyStudent(sessionId: string, data: any) {
    // This will be handled by the instance method
  }

  /**
   * Notify teacher about violation
   */
  public static notifyTeacher(teacherId: string, data: any) {
    // This will be handled by the instance method
  }

  /**
   * Get violation statistics for a test
   */
  public async getTestViolationStats(testId: string) {
    const { AntiCheatService } = await import('./anti-cheat.service');
    return await AntiCheatService.getTestViolationStats(testId);
  }

  /**
   * Terminate a student session due to violations
   */
  public terminateStudentSession(userId: string, reason: string) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('session-terminated', { reason });
      setTimeout(() => {
        this.io.sockets.sockets.get(socketId)?.disconnect(true);
      }, 3000);
    }
  }

  /**
   * Cleanup stale connections and empty rooms
   */
  private cleanupStaleConnections() {
    console.log('Running WebSocket cleanup...');
    
    // Clean up disconnected users
    const connectedSocketIds = new Set(Array.from(this.io.sockets.sockets.keys()));
    
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (!connectedSocketIds.has(socketId)) {
        console.log(`Removing stale connection for user ${userId}`);
        this.connectedUsers.delete(userId);
      }
    }
    
    // Clean up empty test rooms
    for (const [testId, socketIds] of this.testRooms.entries()) {
      const validSockets = new Set<string>();
      
      for (const socketId of socketIds) {
        if (connectedSocketIds.has(socketId)) {
          validSockets.add(socketId);
        }
      }
      
      if (validSockets.size === 0) {
        console.log(`Removing empty test room ${testId}`);
        this.testRooms.delete(testId);
      } else if (validSockets.size !== socketIds.size) {
        console.log(`Cleaned ${socketIds.size - validSockets.size} stale sockets from test ${testId}`);
        this.testRooms.set(testId, validSockets);
      }
    }
    
    console.log(`WebSocket cleanup complete: ${this.connectedUsers.size} users, ${this.testRooms.size} active rooms`);
  }

  /**
   * Graceful shutdown
   */
  public async shutdown() {
    console.log('Shutting down WebSocket service...');
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Disconnect all clients
    this.io.disconnectSockets(true);
    
    // Clear internal maps
    this.connectedUsers.clear();
    this.testRooms.clear();
    
    console.log('WebSocket service shutdown complete');
  }
} 