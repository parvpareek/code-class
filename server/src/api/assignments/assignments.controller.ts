import { Request, Response } from "express";
import { Prisma } from "@prisma/client"; // <-- ADD THIS LINE
import prisma from "../../lib/prisma";
import redisClient from "../../lib/redis";
import {
  checkSubmissionsForAssignment as checkSubmissionsForAssignmentService,
} from "../../services/submission.service";
import { getLeetCodeProblemDetails } from "../../services/leetcode.service";
import { sendAssignmentEmail } from "../../services/email.service";
import { extractProblemDetailsFromUrl } from "../../services/url-title-extractor.service";
import {
  checkTeacherAuthorization,
  checkTeacherAuthorizationForAssignment,
} from "../../services/authorization.service";
import { logger } from "../../utils/logger";

const getPlatformFromUrl = (url: string): string => {
  if (typeof url !== "string" || !url) {
    return "other";
  }
  if (url.includes("leetcode.com")) {
    return "leetcode";
  }
  if (url.includes("hackerrank.com")) {
    return "hackerrank";
  }
  if (url.includes("geeksforgeeks.org")) {
    return "gfg";
  }
  return "other";
};

export const createAssignment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { title, description, classId, assignDate, dueDate, problems } =
    req.body;
  const { userId } = req.user!;

  try {
    const isTeacherAuthorized = await checkTeacherAuthorization(
      userId,
      classId
    );
    if (!isTeacherAuthorized) {
      res.status(403).json({
        message: "You are not authorized to create assignments for this class.",
      });
      return;
    }

    // Pre-validate LeetCode problems OUTSIDE the transaction
    const validatedProblems = [...(problems || [])];

    if (problems && problems.length > 0) {
      for (let i = 0; i < problems.length; i++) {
        const problem = problems[i];
        const platform = getPlatformFromUrl(problem.url);

        const problemData = {
          title: problem.title,
          difficulty: problem.difficulty,
          url: problem.url,
          platform: platform,
        };

        if (platform === "leetcode") {
          try {
            const officialDetails = await getLeetCodeProblemDetails(
              problem.url
            );
            if (officialDetails) {
              validatedProblems[i] = {
                ...problemData,
                title: officialDetails.title,
                difficulty: officialDetails.difficulty,
              };
            } else {
              logger.warn("Could not verify LeetCode problem; using user-provided details");
              validatedProblems[i] = problemData;
            }
          } catch {
            logger.warn("Error validating LeetCode problem");
            // Continue with user-provided data if API fails
            validatedProblems[i] = problemData;
          }
        } else {
          validatedProblems[i] = problemData;
        }
      }
    }

    // Now perform the database transaction with validated data
    const newAssignment = await prisma.$transaction(async (tx: any) => {
      const assignment = await tx.assignment.create({
        data: {
          title,
          description,
          assignDate: new Date(assignDate),
          dueDate: new Date(dueDate),
          class: {
            connect: { id: classId },
          },
        },
      });

      if (validatedProblems && validatedProblems.length > 0) {
        for (const problemData of validatedProblems) {
          await tx.problem.create({
            data: {
              ...problemData,
              assignmentId: assignment.id,
            },
          });
        }
      }

      const createdProblems = await tx.problem.findMany({
        where: { assignmentId: assignment.id },
      });

      const students = await tx.usersOnClasses.findMany({
        where: { classId: classId },
        select: { userId: true },
      });

      if (students.length > 0 && createdProblems.length > 0) {
        const submissions = students.flatMap((student: any) =>
          createdProblems.map((problem: any) => ({
            userId: student.userId,
            problemId: problem.id,
          }))
        );

        await tx.submission.createMany({
          data: submissions,
        });
      }

      const createdAssignment = await tx.assignment.findUnique({
        where: { id: assignment.id },
        include: {
          problems: true,
        },
      });

      return createdAssignment;
    });

    // Send email notification (don't await to avoid blocking the response)
    const teacher = await prisma.user.findUnique({ where: { id: userId } });
    if (teacher && teacher.name) {
      sendAssignmentEmail(classId, title, teacher.name).catch(() => {
        logger.warn("Failed to send assignment email");
      });
    }

    res.status(201).json(newAssignment);
  } catch (error: unknown) {
    logger.error("Error creating assignment");
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
        ? "A duplicate record prevented creating this assignment."
        : "Error creating assignment";
    res.status(500).json({ message });
  }
};

export const getAssignmentById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { assignmentId } = req.params;
  const { userId, role } = req.user!;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        problems: true,
        class: {
          include: {
            students: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    leetcodeUsername: true,
                    hackerrankUsername: true,
                    gfgUsername: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      res.status(404).json({ message: "Assignment not found" });
      return;
    }

    const problemIds = assignment.problems.map((p: any) => p.id);

    if (role === "TEACHER") {
      // For teachers, return all students' submissions (only automatic completion)
      const allSubmissions = await prisma.submission.findMany({
        where: {
          problemId: { in: problemIds },
        },
        select: {
          id: true,
          problemId: true,
          userId: true,
          completed: true, // Only include automatic completion for teachers
          submissionTime: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      const problemsWithSubmissions = assignment.problems.map((problem: any) => ({
        ...problem,
        submissions: allSubmissions
          .filter((s: any) => s.problemId === problem.id)
          .map((s: any) => {
            // Calculate end of day for due date (23:59:59.999) in UTC
            const dueDateEndOfDay = new Date(assignment.dueDate);
            dueDateEndOfDay.setUTCHours(23, 59, 59, 999);
            
            return {
              ...s,
              isLate:
                !!s.submissionTime &&
                !!assignment.dueDate &&
                !!assignment.assignDate &&
                new Date(s.submissionTime).getTime() > dueDateEndOfDay.getTime() &&
                new Date(s.submissionTime).getTime() >= new Date(assignment.assignDate).getTime(),
            };
          }),
      }));

      res.status(200).json({
        ...assignment,
        problems: problemsWithSubmissions,
      });
    } else {
      // For students, return only their own submissions (including manual marking)
      const userSubmissions = await prisma.submission.findMany({
        where: {
          problemId: { in: problemIds },
          userId: userId,
        },
        select: {
          id: true,
          problemId: true,
          completed: true,
          manuallyMarked: true, // Only include manual marking for students
          submissionTime: true,
        },
      });

      const studentAssignmentInfo =
        await prisma.studentAssignmentInfo.findUnique({
          where: {
            userId_assignmentId: {
              userId: userId,
              assignmentId: assignmentId,
            },
          },
        });

      const problemsWithUserSubmission = assignment.problems.map((problem) => {
        const userSubmission = userSubmissions.find(
          (s) => s.problemId === problem.id
        );
        return {
          ...problem,
          submissionId: userSubmission?.id,
          completed: userSubmission?.completed || false,
          manuallyMarked: userSubmission?.manuallyMarked || false, // Only for students
          submissionTime: userSubmission?.submissionTime || null,
        };
      });

      // Calculate progress based on automatic completion only
      const completedCount = problemsWithUserSubmission.filter(
        (p) => p.completed
      ).length;
      const totalProblems = problemsWithUserSubmission.length;

      const response = {
        ...assignment,
        problems: problemsWithUserSubmission,
        progress: {
          completed: completedCount,
          total: totalProblems,
          percentage:
            totalProblems > 0
              ? Math.round((completedCount / totalProblems) * 100)
              : 0,
        },
        lastCheckedAt: studentAssignmentInfo?.lastCheckedAt || null,
      };

      // We don't need to send the full class details back for students
      // @ts-expect-error: Removing class property from response
      delete response.class;

      res.status(200).json(response);
    }
  } catch {
    logger.error("Error fetching assignment");
    res.status(500).json({ message: "Error fetching assignment" });
  }
};

export const checkAssignmentSubmissions = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { assignmentId } = req.params;
  const { userId, role } = req.user!;

  if (role !== "TEACHER") {
    res
      .status(403)
      .json({ message: "Only teachers can trigger submission checks." });
    return;
  }

  try {
    const { count } = await checkSubmissionsForAssignmentService(assignmentId);
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { lastSubmissionCheck: new Date() },
    });

    // Clear cache for this assignment to ensure fresh data on next request
    const cacheKey = `__express__/api/v1/assignments/${assignmentId}`;
    redisClient.del(cacheKey).catch(() => {
      logger.warn("Failed to clear assignment cache");
    });

    res.status(200).json({
      message: `Submission check completed. ${count} submissions updated.`,
    });
  } catch {
    logger.error("Error checking submissions for assignment");
    res.status(500).json({ message: "Error checking submissions for assignment" });
  }
};

export const checkMySubmissionsForAssignment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { assignmentId } = req.params;
  const { userId } = req.user!;

  try {
    const studentInfo = await prisma.studentAssignmentInfo.findUnique({
      where: {
        userId_assignmentId: {
          userId,
          assignmentId,
        },
      },
    });

    if (studentInfo) {
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
      if (studentInfo.lastCheckedAt > oneMinuteAgo) {
        res.status(429).json({
          message:
            "You can only check for new submissions once every 1 minute.",
        });
        return;
      }
    }

    const { count } = await checkSubmissionsForAssignmentService(
      assignmentId,
      userId
    );

    await prisma.studentAssignmentInfo.upsert({
      where: {
        userId_assignmentId: {
          userId,
          assignmentId,
        },
      },
      update: {
        lastCheckedAt: new Date(),
      },
      create: {
        userId,
        assignmentId,
        lastCheckedAt: new Date(),
      },
    });

    // Clear cache for this assignment to ensure fresh data on next request
    const cacheKey = `__express__/api/v1/assignments/${assignmentId}`;
    redisClient.del(cacheKey).catch(() => {
      logger.warn("Failed to clear assignment cache");
    });

    res.status(200).json({
      message: `Submission check completed. ${count} of your submissions were updated.`,
    });
  } catch {
    logger.error("Error checking student submissions for assignment");
    res.status(500).json({ message: "Error checking your submissions" });
  }
};

export const deleteAssignment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { assignmentId } = req.params;
  const { userId, role } = req.user!;

  if (role !== "TEACHER") {
    res.status(403).json({ message: "Only teachers can delete assignments." });
    return;
  }

  try {
    // First, verify the assignment exists and user has permission
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        class: true,
        problems: {
          select: { id: true },
        },
        studentAssignmentInfos: {
          select: { id: true },
        },
      },
    });

    if (!assignment) {
      res.status(404).json({ message: "Assignment not found." });
      return;
    }

    if (assignment.class.teacherId !== userId) {
      res
        .status(403)
        .json({ message: "You are not authorized to delete this assignment." });
      return;
    }

    // Use a transaction with timeout to ensure all related data is deleted properly
    await prisma.$transaction(
      async (tx) => {
        const problemIds = assignment.problems.map((p: any) => p.id);

        // 1. Delete all submissions for all problems in this assignment
        if (problemIds.length > 0) {
          await tx.submission.deleteMany({
            where: {
              problemId: { in: problemIds },
            },
          });
        }

        // 2. Delete all StudentAssignmentInfo records for this assignment
        await tx.studentAssignmentInfo.deleteMany({
          where: { assignmentId: assignmentId },
        });

        // 3. Delete all problems in the assignment
        if (problemIds.length > 0) {
          await tx.problem.deleteMany({
            where: { assignmentId: assignmentId },
          });
        }

        // 4. Finally, delete the assignment itself
        await tx.assignment.delete({
          where: { id: assignmentId },
        });
      },
      {
        timeout: 30000, // 30 second timeout
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    res.status(200).json({
      message: "Assignment and all related data deleted successfully",
      deletedAssignmentId: assignmentId,
    });
  } catch (error) {
    logger.error("Error deleting assignment");

    // Enhanced error handling with more specific cases
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2003":
          res.status(400).json({
            message:
              "Cannot delete assignment due to foreign key constraints. Some related data still exists.",
            error: "Foreign key constraint violation",
            code: error.code,
          });
          return;
        case "P2025":
          res.status(404).json({
            message: "Assignment not found or already deleted.",
            error: "Record not found",
            code: error.code,
          });
          return;
        case "P2034":
          res.status(409).json({
            message:
              "Transaction failed due to a write conflict. Please try again.",
            error: "Transaction conflict",
            code: error.code,
          });
          return;
        default:
          res.status(500).json({
            message: "Database error occurred while deleting assignment.",
            code: error.code,
          });
          return;
      }
    }

    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        res.status(408).json({
          message: "Delete operation timed out. Please try again.",
          error: "Operation timeout",
        });
        return;
      }
    }

    res.status(500).json({
      message: "An unexpected error occurred while deleting the assignment.",
    });
  }
};

export const updateAssignment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { assignmentId } = req.params;
  const { title, description, assignDate, dueDate, problems } = req.body;
  const { userId } = req.user!;

  try {
    const isTeacherAuthorized = await checkTeacherAuthorizationForAssignment(
      userId,
      assignmentId
    );
    if (!isTeacherAuthorized) {
      res
        .status(403)
        .json({ message: "You are not authorized to update this assignment." });
      return;
    }

    const updatedAssignment = await prisma.$transaction(async (tx) => {
      // 1. Update the assignment details
      const assignment = await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          title,
          description,
          assignDate: assignDate ? new Date(assignDate) : undefined,
          dueDate: new Date(dueDate),
        },
      });

      // 2. Handle problem updates
      if (problems) {
        // Fetch existing problems to compare against incoming data
        const existingProblems = await tx.problem.findMany({
          where: { assignmentId: assignmentId },
          select: { id: true, url: true, title: true, difficulty: true },
        });

        const existingProblemMap = new Map(
          existingProblems.map((p) => [p.url, p])
        );

        // Process incoming problems: update existing or create new
        for (const problemData of problems) {
          const existingProblem = existingProblemMap.get(problemData.url);

          if (existingProblem) {
            // This problem exists, check if an update is needed
            if (
              existingProblem.title !== problemData.title ||
              existingProblem.difficulty !== problemData.difficulty
            ) {
              await tx.problem.update({
                where: { id: existingProblem.id },
                data: {
                  title: problemData.title,
                  difficulty: problemData.difficulty,
                },
              });
            }
            // Remove from map to track which problems were processed
            existingProblemMap.delete(problemData.url);
          } else {
            // This is a new problem, create it
            const newProblem = await tx.problem.create({
              data: {
                title: problemData.title,
                url: problemData.url,
                difficulty: problemData.difficulty,
                platform: getPlatformFromUrl(problemData.url),
                assignmentId: assignmentId,
              },
            });

            // For new problems, create submissions for all students in the class
            const students = await tx.usersOnClasses.findMany({
              where: { classId: assignment.classId },
              select: { userId: true },
            });

            if (students.length > 0) {
              const newSubmissions = students.map((student) => ({
                userId: student.userId,
                problemId: newProblem.id,
              }));
              await tx.submission.createMany({
                data: newSubmissions,
              });
            }
          }
        }

        // Problems remaining in the map were not in the incoming data, so delete them
        const problemsToDelete = Array.from(existingProblemMap.values());
        if (problemsToDelete.length > 0) {
          const problemIdsToDelete = problemsToDelete.map((p) => p.id);

          // Before deleting problems, delete their associated submissions
          await tx.submission.deleteMany({
            where: { problemId: { in: problemIdsToDelete } },
          });

          await tx.problem.deleteMany({
            where: { id: { in: problemIdsToDelete } },
          });
        }
      }

      return tx.assignment.findUnique({
        where: { id: assignmentId },
        include: { problems: true },
      });
    });

    res.status(200).json(updatedAssignment);
  } catch {
    logger.error("Error updating assignment");
    res.status(500).json({ message: "Error updating assignment" });
  }
};

export const checkLeetCodeSubmissionsForAssignment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  const userId = req.user!.userId;

  try {
    // Get the assignment and verify the user is the teacher
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        class: true,
        problems: {
          include: {
            submissions: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      res.status(404).json({ message: "Assignment not found" });
      return;
    }

    if (assignment.class.teacherId !== userId) {
      res.status(403).json({
        message: "Not authorized to check submissions for this assignment",
      });
      return;
    }

    // DISABLED: Automatic system-wide user syncing
    // This was causing memory leaks and running automatically on server startup
    // User syncing should only happen when checking specific assignment submissions via checkAssignmentSubmissions
    // Import the enhanced service
    // const { syncAllLinkedLeetCodeUsers } = await import(
    //   "../../services/enhanced-leetcode.service"
    // );

    // Trigger sync for all linked users - DISABLED
    // await syncAllLinkedLeetCodeUsers();

    // Instead, use the assignment-specific check function (only checks users in this assignment's class)
    const { assignmentId } = req.params;
    await checkSubmissionsForAssignmentService(assignmentId, undefined);

    res.status(200).json({
      message: "Assignment submission check completed (system-wide syncing disabled - only checks this assignment)",
      assignmentTitle: assignment.title,
    });
  } catch {
    logger.error("Error checking LeetCode submissions");
    res.status(500).json({ message: "Error checking LeetCode submissions" });
  }
};

export const getMyAssignments = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user!.userId;

  try {
    // Get user's class IDs first
    const userClasses = await prisma.usersOnClasses.findMany({
      where: { userId },
      select: { classId: true },
    });

    const classIds = userClasses.map((uc) => uc.classId);

    // Get all assignments for those classes directly
    const allAssignments = await prisma.assignment.findMany({
      where: {
        classId: { in: classIds },
      },
      include: {
        problems: true,
      },
      orderBy: [
        {
          updatedAt: "desc", // Recently updated assignments first (for edited assignments)
        },
        {
          createdAt: "desc", // Then by actual creation/posting time
        },
      ],
    });

    // Get submission data for the user
    const assignmentIds = allAssignments.map((a) => a.id);
    const userSubmissions = await prisma.submission.findMany({
      where: {
        userId,
        problem: {
          assignmentId: { in: assignmentIds },
        },
      },
    });

    // Calculate status and progress for each assignment
    const assignmentsWithStatus = allAssignments.map((assignment) => {
      const assignmentSubmissions = userSubmissions.filter((s) =>
        (
          assignment as typeof assignment & { problems: { id: string }[] }
        ).problems.some((p: { id: string }) => p.id === s.problemId)
      );

      const completedCount = assignmentSubmissions.filter(
        (s) => s.completed
      ).length;
      const totalProblems = (
        assignment as typeof assignment & { problems: { id: string }[] }
      ).problems.length;
      const now = new Date();
      const dueDate = new Date(assignment.dueDate);
      
      // Calculate end of day for due date (23:59:59.999) in UTC
      const dueDateEndOfDay = new Date(dueDate);
      dueDateEndOfDay.setUTCHours(23, 59, 59, 999);

      let status: "completed" | "pending" | "overdue";
      if (completedCount === totalProblems) {
        status = "completed";
      } else if (now > dueDateEndOfDay) {
        status = "overdue";
      } else {
        status = "pending";
      }

      return {
        ...assignment,
        status,
        progress: {
          completed: completedCount,
          total: totalProblems,
          percentage:
            totalProblems > 0
              ? Math.round((completedCount / totalProblems) * 100)
              : 0,
        },
      };
    });

    res.status(200).json(assignmentsWithStatus);
  } catch {
    logger.error("Error fetching user assignments");
    res.status(500).json({ message: "Error fetching assignments" });
  }
};

export const markAllAsCompleted = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { assignmentId, studentId } = req.params;
  const user = req.user!;

  try {
    // Only allow students to mark their own work as manually completed
    if (user.role !== "STUDENT") {
      res.status(403).json({
        message: "Only students can mark their own work as manually completed",
      });
      return;
    }

    // Students can only mark their own submissions
    if (user.userId !== studentId) {
      res.status(403).json({
        message: "You can only mark your own submissions as manually completed",
      });
      return;
    }

    // Get all problems for this assignment
    const problems = await prisma.problem.findMany({
      where: { assignmentId },
      select: { id: true },
    });

    if (problems.length === 0) {
      res
        .status(404)
        .json({ message: "No problems found for this assignment" });
      return;
    }

    // Update all submissions for this student and assignment to be manually marked as completed
    const submissions = await prisma.submission.updateMany({
      where: {
        userId: studentId,
        problemId: { in: problems.map((p) => p.id) },
      },
      data: {
        manuallyMarked: true,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      message: `Successfully marked all ${submissions.count} problems as manually completed`,
      updatedCount: submissions.count,
    });
  } catch (dbError: unknown) {
    const error = dbError as { code?: string; message?: string };
    if (error.code === "P2025" || error.message?.includes("manuallyMarked")) {
      // Database field doesn't exist yet
      res.status(501).json({
        message:
          "Manual completion feature requires database migration. Please run the migration first.",
        migrationRequired: true,
      });
      return;
    }

    logger.error("Error marking submissions as manually completed");
    res.status(500).json({
      message: "Error marking all problems as manually completed",
    });
  }
};

/**
 * Extract problem title and details from URL
 */
export const extractProblemFromUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userRole = (req as Request & { user: { role: string } }).user.role;

    // Only teachers can extract problem details
    if (userRole !== "TEACHER") {
      res
        .status(403)
        .json({ error: "Only teachers can extract problem details" });
      return;
    }

    const { url } = req.body;

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      res.status(400).json({ error: "Invalid URL format" });
      return;
    }

    const problemDetails = await extractProblemDetailsFromUrl(url);

    if (!problemDetails) {
      res.status(404).json({
        error:
          "Could not extract problem details from the provided URL. Please enter the title manually.",
      });
      return;
    }

    // Map difficulty to match our schema if available
    let difficulty = problemDetails.difficulty;
    if (difficulty) {
      const difficultyMap: { [key: string]: string } = {
        easy: "Easy",
        medium: "Medium",
        hard: "Hard",
        Easy: "Easy",
        Medium: "Medium",
        Hard: "Hard",
      };
      difficulty = difficultyMap[difficulty] || "Easy";
    }

    res.json({
      message: "Problem details extracted successfully",
      problem: {
        title: problemDetails.title,
        difficulty: difficulty || "Easy",
        platform: problemDetails.platform,
        url: url,
      },
    });
  } catch {
    logger.error("Error extracting problem details from URL");
    res.status(500).json({
      message: "Error extracting problem details from URL",
    });
  }
};

/**
 * Debug endpoint to test URL extraction with detailed logging
 */
export const debugExtractProblemFromUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userRole = (req as Request & { user: { role: string } }).user.role;

    // Only teachers can debug extract problem details
    if (userRole !== "TEACHER") {
      res
        .status(403)
        .json({ error: "Only teachers can debug extract problem details" });
      return;
    }

    const { url } = req.body;

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      res.status(400).json({ error: "Invalid URL format" });
      return;
    }

    const problemDetails = await extractProblemDetailsFromUrl(url);

    if (!problemDetails) {
      res.status(404).json({
        error:
          "Could not extract problem details from the provided URL. Check server logs for detailed debugging information.",
        debug: {
          url: url,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Map difficulty to match our schema if available
    let difficulty = problemDetails.difficulty;
    if (difficulty) {
      const difficultyMap: { [key: string]: string } = {
        easy: "Easy",
        medium: "Medium",
        hard: "Hard",
        Easy: "Easy",
        Medium: "Medium",
        Hard: "Hard",
      };
      difficulty = difficultyMap[difficulty] || "Easy";
    }

    res.json({
      message: "Problem details extracted successfully",
      problem: {
        title: problemDetails.title,
        difficulty: difficulty || "Easy",
        platform: problemDetails.platform,
        url: url,
      },
      debug: {
        originalDifficulty: problemDetails.difficulty,
        platform: problemDetails.platform,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    logger.error("Debug extract problem details failed");
    res.status(500).json({
      message: "Error extracting problem details from URL",
    });
  }
};
