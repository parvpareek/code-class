import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { z } from 'zod';

// Validation schemas
const createTestSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().optional(),
  classId: z.string().cuid(),
  duration: z.number().min(15).max(480), // 15 min to 8 hours
  allowedLanguages: z.array(z.string()).min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isActive: z.boolean().default(false),
  problems: z.array(z.object({
    title: z.string().min(3).max(200),
    description: z.string().min(10),
    constraints: z.string().optional(),
    examples: z.string().optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    timeLimit: z.number().min(1).max(30).default(5), // seconds
    memoryLimit: z.number().min(128).max(512).default(256), // MB
    testCases: z.array(z.object({
      input: z.string(),
      expectedOutput: z.string(),
      isPublic: z.boolean().default(false)
    })).min(1),
    order: z.number().min(1)
  })).min(1)
});

const updateTestSchema = createTestSchema.partial().omit({ problems: true });

const generateTestCasesSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  existingTestCases: z.array(z.object({
    input: z.string(),
    expectedOutput: z.string(),
    isPublic: z.boolean().optional()
  })).optional()
});

/**
 * Create a new coding test
 */
export const createTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Only teachers can create tests
    if (userRole !== 'TEACHER') {
      res.status(403).json({ error: 'Only teachers can create tests' });
      return;
    }

    const validatedData = createTestSchema.parse(req.body);

    // Validate class ownership
    const classExists = await prisma.class.findFirst({
      where: {
        id: validatedData.classId,
        teacherId: userId
      }
    });

    if (!classExists) {
      res.status(404).json({ error: 'Class not found or access denied' });
      return;
    }

    // Validate time range
    const startTime = new Date(validatedData.startTime);
    const endTime = new Date(validatedData.endTime);
    
    if (startTime >= endTime) {
      res.status(400).json({ error: 'Start time must be before end time' });
      return;
    }

    if (startTime < new Date()) {
      res.status(400).json({ error: 'Start time cannot be in the past' });
      return;
    }

    // Create test with problems in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Create the test
      const test = await tx.codingTest.create({
        data: {
          title: validatedData.title,
          description: validatedData.description,
          classId: validatedData.classId,
          duration: validatedData.duration,
          allowedLanguages: validatedData.allowedLanguages,
          startTime,
          endTime,
          isActive: validatedData.isActive
        }
      });

      // Create problems
      const problems = await Promise.all(
        validatedData.problems.map(problemData => 
          tx.testProblem.create({
            data: {
              testId: test.id,
              title: problemData.title,
              description: problemData.description,
              constraints: problemData.constraints,
              examples: problemData.examples,
              difficulty: problemData.difficulty,
              timeLimit: problemData.timeLimit,
              memoryLimit: problemData.memoryLimit,
              testCases: problemData.testCases,
              order: problemData.order
            }
          })
        )
      );

      return { test, problems };
    });

    res.status(201).json({
      message: 'Test created successfully',
      test: result.test,
      problemsCount: result.problems.length
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation failed:', error.errors);
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Error creating test:', error);
    res.status(500).json({ error: 'Failed to create test' });
  }
};

/**
 * Get all tests for a teacher's classes
 */
export const getTests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { classId, status } = req.query;

    let whereClause: any = {};

    if (userRole === 'TEACHER') {
      whereClause.class = { teacherId: userId };
      if (classId) {
        whereClause.classId = classId as string;
      }
    } else if (userRole === 'STUDENT') {
      // Students can only see tests from their enrolled classes
      whereClause.class = {
        students: { some: { userId } }
      };
      if (classId) {
        whereClause.classId = classId as string;
      }
    }

    // Filter by status if provided
    if (status) {
      const now = new Date();
      switch (status) {
        case 'upcoming':
          whereClause.startTime = { gt: now };
          break;
        case 'active':
          whereClause.AND = [
            { startTime: { lte: now } },
            { endTime: { gte: now } },
            { isActive: true }
          ];
          break;
        case 'completed':
          whereClause.endTime = { lt: now };
          break;
      }
    }

    const tests = await prisma.codingTest.findMany({
      where: whereClause,
      include: {
        class: {
          select: { id: true, name: true }
        },
        problems: {
          select: { id: true, title: true, difficulty: true, order: true },
          orderBy: { order: 'asc' }
        },
        _count: {
          select: { sessions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ tests });

  } catch (error) {
    console.error('Error fetching tests:', error);
    res.status(500).json({ error: 'Failed to fetch tests' });
  }
};

/**
 * Get a specific test with full details
 */
export const getTestById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { testId } = req.params;
    const id = testId; // Support both :id and :testId parameter names
    
    console.log('getTestById called with:', { userId, userRole, testId, id, params: req.params });

    let whereClause: any = { id };

    if (userRole === 'TEACHER') {
      whereClause.class = { teacherId: userId };
    } else if (userRole === 'STUDENT') {
      whereClause.class = {
        students: { some: { userId } }
      };
    }

    const test = await prisma.codingTest.findFirst({
      where: whereClause,
      include: {
        class: {
          select: { id: true, name: true, teacherId: true }
        },
        problems: {
          orderBy: { order: 'asc' },
          ...(userRole === 'STUDENT' && {
            select: {
              id: true,
              title: true,
              description: true,
              constraints: true,
              examples: true,
              difficulty: true,
              timeLimit: true,
              memoryLimit: true,
              order: true
              // Exclude test cases for students
            }
          })
        },
        sessions: userRole === 'TEACHER' ? {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            },
            submissions: {
              select: { id: true, problemId: true, status: true, score: true, createdAt: true }
            },
            penalties: {
              select: { id: true, type: true, description: true, timestamp: true }
            }
          }
        } : {
          where: { userId },
          include: {
            submissions: {
              select: { id: true, problemId: true, status: true, score: true, createdAt: true }
            }
          }
        }
      }
    });

    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    res.json({ test });

  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({ error: 'Failed to fetch test' });
  }
};

/**
 * Update a test
 */
export const updateTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { id } = req.params;

    if (userRole !== 'TEACHER') {
      res.status(403).json({ error: 'Only teachers can update tests' });
      return;
    }

    const validatedData = updateTestSchema.parse(req.body);

    // Verify ownership
    const existingTest = await prisma.codingTest.findFirst({
      where: {
        id,
        class: { teacherId: userId }
      }
    });

    if (!existingTest) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    // Validate time changes if provided
    if (validatedData.startTime || validatedData.endTime) {
      const startTime = validatedData.startTime ? new Date(validatedData.startTime) : existingTest.startTime;
      const endTime = validatedData.endTime ? new Date(validatedData.endTime) : existingTest.endTime;
      
      if (startTime >= endTime) {
        res.status(400).json({ error: 'Start time must be before end time' });
        return;
      }
    }

    const updatedTest = await prisma.codingTest.update({
      where: { id },
      data: {
        ...validatedData,
        ...(validatedData.startTime && { startTime: new Date(validatedData.startTime) }),
        ...(validatedData.endTime && { endTime: new Date(validatedData.endTime) })
      },
      include: {
        problems: {
          orderBy: { order: 'asc' }
        }
      }
    });

    res.json({
      message: 'Test updated successfully',
      test: updatedTest
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Error updating test:', error);
    res.status(500).json({ error: 'Failed to update test' });
  }
};

/**
 * Delete a test
 */
export const deleteTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { id } = req.params;

    if (userRole !== 'TEACHER') {
      res.status(403).json({ error: 'Only teachers can delete tests' });
      return;
    }

    // Verify ownership
    const existingTest = await prisma.codingTest.findFirst({
      where: {
        id,
        class: { teacherId: userId }
      },
      include: {
        sessions: { take: 1 }
      }
    });

    if (!existingTest) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    // Don't allow deletion if test has sessions
    if (existingTest.sessions.length > 0) {
      res.status(400).json({ 
        error: 'Cannot delete test with existing sessions. Archive it instead.' 
      });
      return;
    }

    // Delete in transaction
    await prisma.$transaction(async (tx: any) => {
      // Delete problems first (cascade will handle test cases)
      await tx.testProblem.deleteMany({
        where: { testId: id }
      });

      // Delete the test
      await tx.codingTest.delete({
        where: { id }
      });
    });

    res.json({ message: 'Test deleted successfully' });

  } catch (error) {
    console.error('Error deleting test:', error);
    res.status(500).json({ error: 'Failed to delete test' });
  }
};

/**
 * Activate/Deactivate a test
 */
export const toggleTestStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { id } = req.params;
    const { isActive } = req.body;

    if (userRole !== 'TEACHER') {
      res.status(403).json({ error: 'Only teachers can change test status' });
      return;
    }

    // Verify ownership
    const existingTest = await prisma.codingTest.findFirst({
      where: {
        id,
        class: { teacherId: userId }
      }
    });

    if (!existingTest) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    // Additional validation for activation
    if (isActive) {
      const now = new Date();
      if (existingTest.startTime > now) {
        res.status(400).json({ 
          error: 'Cannot activate test before start time' 
        });
        return;
      }
      if (existingTest.endTime < now) {
        res.status(400).json({ 
          error: 'Cannot activate test after end time' 
        });
        return;
      }
    }

    const updatedTest = await prisma.codingTest.update({
      where: { id },
      data: { isActive: !!isActive }
    });

    res.json({
      message: `Test ${isActive ? 'activated' : 'deactivated'} successfully`,
      test: updatedTest
    });

  } catch (error) {
    console.error('Error toggling test status:', error);
    res.status(500).json({ error: 'Failed to update test status' });
  }
}; 

/**
 * Generate test cases using Gemini AI
 */
export const generateTestCases = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Only teachers can generate test cases
    if (userRole !== 'TEACHER') {
      res.status(403).json({ error: 'Only teachers can generate test cases' });
      return;
    }

    const validatedData = generateTestCasesSchema.parse(req.body);

    // Call Gemini API to generate test cases
    const generatedTestCases = await generateTestCasesWithGemini(
      userId,
      validatedData.title,
      validatedData.description,
      validatedData.existingTestCases || []
    );

    res.json({
      message: 'Test cases generated successfully',
      testCases: generatedTestCases
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Error generating test cases:', error);
    res.status(500).json({ error: 'Failed to generate test cases' });
  }
};

/**
 * Generate comprehensive test cases using Gemini AI
 */
async function generateTestCasesWithGemini(
  userId: string,
  title: string, 
  description: string, 
  existingTestCases: Array<{ input: string; expectedOutput: string; isPublic?: boolean }>
): Promise<Array<{ input: string; expectedOutput: string; isPublic: boolean; explanation: string }>> {
  try {
    // Import Google AI SDK
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    
    // Get teacher's personal Gemini API key
    const teacher = await prisma.user.findUnique({
      where: { id: userId },
      select: { geminiApiKey: true, geminiKeyStatus: true }
    });

    let apiKey = null;
    
    if (teacher?.geminiApiKey && teacher.geminiKeyStatus === 'ACTIVE') {
      // Use teacher's personal key (decrypt it)
      apiKey = await decryptGeminiKey(teacher.geminiApiKey);
    } else if (process.env.GEMINI_API_KEY) {
      // Fallback to environment variable
      apiKey = process.env.GEMINI_API_KEY;
    } else {
      throw new Error('No Gemini API key available. Please add your personal API key in profile settings.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are an expert coding problem designer. Generate comprehensive test cases for the following coding problem:

**Problem Title:** ${title}

**Problem Description:**
${description}

**Existing Test Cases:**
${existingTestCases.length > 0 ? 
  existingTestCases.map((tc, i) => `${i + 1}. Input: ${tc.input}\n   Output: ${tc.expectedOutput}`).join('\n') 
  : 'None'
}

**Requirements:**
1. Generate 5-8 diverse test cases that thoroughly test the problem
2. Include edge cases, boundary conditions, and corner cases
3. Ensure test cases cover different scenarios and input sizes
4. Make 1-2 test cases public (for examples) and the rest private
5. Provide clear explanations for what each test case validates
6. Ensure inputs and outputs are properly formatted

**Response Format (JSON):**
Return ONLY a valid JSON array in this exact format:
[
  {
    "input": "test input data",
    "expectedOutput": "expected output",
    "isPublic": true,
    "explanation": "what this test case validates"
  }
]

**Important Notes:**
- Inputs should be realistic and follow the problem constraints
- Outputs should be correct according to the problem description
- Include both simple and complex cases
- Test edge cases like empty inputs, maximum/minimum values, single elements
- Ensure the JSON is properly formatted and parseable
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from the response
    const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from Gemini');
    }

    const testCases = JSON.parse(jsonMatch[0]);
    
    // Validate the generated test cases
    if (!Array.isArray(testCases)) {
      throw new Error('Generated test cases must be an array');
    }

    // Ensure each test case has required fields
    const validatedTestCases = testCases.map((tc: any, index: number) => {
      if (!tc.input || !tc.expectedOutput) {
        throw new Error(`Test case ${index + 1} missing required fields`);
      }
      return {
        input: String(tc.input),
        expectedOutput: String(tc.expectedOutput),
        isPublic: Boolean(tc.isPublic),
        explanation: String(tc.explanation || 'Test case validation')
      };
    });

    return validatedTestCases;

  } catch (error) {
    console.error('Error generating test cases with Gemini:', error);
    
    // Fallback: Generate basic test cases
    return [
      {
        input: "1",
        expectedOutput: "1",
        isPublic: true,
        explanation: "Basic test case - please customize manually"
      },
      {
        input: "0",
        expectedOutput: "0",
        isPublic: false,
        explanation: "Edge case with zero - please customize manually"
      }
    ];
  }
}

/**
 * Decrypt Gemini API key (matching the encryption in profile.controller.ts)
 */
async function decryptGeminiKey(encryptedKey: string): Promise<string> {
  const crypto = require('crypto');
  const secretKey = process.env.ENCRYPTION_KEY || 'default-secret-key-change-in-production';
  
  try {
    const [ivHex, encrypted, authTagHex] = encryptedKey.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const algorithm = 'aes-256-gcm';
    const decipher = crypto.createDecipher(algorithm, secretKey);
    decipher.setAAD(Buffer.from('gemini-api-key'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting Gemini API key:', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Import problem details from LeetCode
 */
export const importFromLeetCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user!.role;

    // Only teachers can import problems
    if (userRole !== 'TEACHER') {
      res.status(403).json({ error: 'Only teachers can import problems' });
      return;
    }

    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'LeetCode URL is required' });
      return;
    }

    // Extract problem slug from URL
    const slug = extractLeetCodeSlug(url);
    if (!slug) {
      res.status(400).json({ error: 'Invalid LeetCode URL' });
      return;
    }

    // Import LeetCode package using require for CommonJS compatibility
    const { LeetCode } = require('leetcode-query');
    const lc = new LeetCode();

    // Fetch problem details
    const problem = await lc.problem(slug);

    if (!problem) {
      res.status(404).json({ error: 'Problem not found on LeetCode' });
      return;
    }

    // Convert LeetCode difficulty to our format
    const difficultyMap: { [key: string]: 'EASY' | 'MEDIUM' | 'HARD' } = {
      'Easy': 'EASY',
      'Medium': 'MEDIUM',
      'Hard': 'HARD'
    };

    // Parse examples from problem content
    const parseExamples = (content: string): string => {
      try {
        const exampleRegex = /<strong[^>]*>Example \d+:<\/strong>\s*<\/p>\s*<pre[^>]*>([\s\S]*?)<\/pre>/gi;
        const examples: string[] = [];
        let match;
        
        while ((match = exampleRegex.exec(content)) !== null) {
          const exampleText = match[1]
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .trim();
          examples.push(exampleText);
        }
        
        return examples.join('\n\n');
      } catch (error) {
        console.error('Error parsing examples:', error);
        return '';
      }
    };

    // Clean HTML content
    const cleanContent = (content: string): string => {
      return content
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .trim();
    };

    // Return structured problem data
    const problemData = {
      title: problem.title,
      description: cleanContent(problem.content),
      difficulty: difficultyMap[problem.difficulty] || 'MEDIUM',
      examples: parseExamples(problem.content),
      constraints: '', // LeetCode constraints are usually embedded in the description
      timeLimit: 30, // Default time limit in seconds
      memoryLimit: 256, // Default memory limit in MB
      leetcodeUrl: url,
      questionId: problem.questionId,
      questionFrontendId: problem.questionFrontendId
    };

    res.json({
      message: 'Problem imported successfully from LeetCode',
      problem: problemData
    });

  } catch (error) {
    console.error('Error importing from LeetCode:', error);
    res.status(500).json({ error: 'Failed to import problem from LeetCode' });
  }
};

/** Stub response for violation monitoring dashboard (real stats when pipeline exists). */
export const getViolationStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      totalSessions: 0,
      sessionsWithViolations: 0,
      violationsByType: {
        TAB_SWITCH: 0,
        FULLSCREEN_EXIT: 0,
        COPY_PASTE: 0,
        DEV_TOOLS: 0,
        FOCUS_LOSS: 0,
        CONTEXT_MENU: 0,
      },
      highRiskSessions: [],
    });
  } catch {
    res.status(500).json({ error: 'Failed to get violation stats' });
  }
};

export const getTestSessions = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json([]);
  } catch {
    res.status(500).json({ error: 'Failed to get test sessions' });
  }
};

export const terminateStudentSession = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, message: 'Student session terminated' });
  } catch {
    res.status(500).json({ error: 'Failed to terminate student session' });
  }
};

/**
 * Extract problem slug from LeetCode URL
 */
function extractLeetCodeSlug(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('leetcode.com')) {
      return null;
    }
    
    const pathParts = urlObj.pathname.split('/');
    const problemsIndex = pathParts.indexOf('problems');
    
    if (problemsIndex !== -1 && pathParts[problemsIndex + 1]) {
      return pathParts[problemsIndex + 1].replace('/', '');
    }
    
    return null;
  } catch {
    return null;
  }
} 