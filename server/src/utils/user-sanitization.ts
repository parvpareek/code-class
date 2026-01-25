import { User } from '@prisma/client';

// Define safe fields that can be exposed to the frontend
const SAFE_USER_FIELDS = [
  'id',
  'email',
  'name',
  'role',
  'createdAt',
  'updatedAt',
  'hackerrankUsername',
  'hackerrankCookieStatus',
  'gfgUsername',
  'gfgCookieStatus',
  'leetcodeUsername',
  'leetcodeCookieStatus',
  'leetcodeTotalSolved',
  'leetcodeEasySolved',
  'leetcodeMediumSolved',
  'leetcodeHardSolved',
  'judge0KeyStatus',
  'judge0QuotaUsed',
  'judge0LastReset',
] as const;

// Define sensitive fields that should NEVER be exposed to the frontend
const SENSITIVE_FIELDS = [
  'password',
  'hackerrankCookie',
  'leetcodeCookie',
  'judge0ApiKey',
  'geminiApiKey',
] as const;

export type SafeUser = Pick<User, typeof SAFE_USER_FIELDS[number]>;

/**
 * Sanitize a single user object by removing sensitive fields
 */
export function sanitizeUser(user: any | null): any | null {
  if (!user) return null;

  // Create a new object with only safe fields
  const sanitizedUser: any = {};
  
  SAFE_USER_FIELDS.forEach(field => {
    if (field in user) {
      sanitizedUser[field] = user[field];
    }
  });

  return sanitizedUser;
}

/**
 * Sanitize an array of user objects
 */
export function sanitizeUsers(users: any[]): any[] {
  return users.map(user => sanitizeUser(user)!).filter(Boolean);
}

/**
 * Sanitize user data in complex objects (e.g., class details with nested users)
 */
export function sanitizeUserInObject(
  obj: any,
  userPath: string
): any {
  const result = { ...obj };
  const pathSegments = userPath.split('.');
  
  let current = result;
  for (let i = 0; i < pathSegments.length - 1; i++) {
    if (current[pathSegments[i]]) {
      current = current[pathSegments[i]];
    } else {
      return result;
    }
  }
  
  const lastSegment = pathSegments[pathSegments.length - 1];
  if (current[lastSegment]) {
    if (Array.isArray(current[lastSegment])) {
      current[lastSegment] = sanitizeUsers(current[lastSegment]);
    } else {
      current[lastSegment] = sanitizeUser(current[lastSegment]);
    }
  }
  
  return result;
}

/**
 * Remove sensitive fields from any object
 */
export function removeSensitiveFields(obj: any): any {
  const result = { ...obj };
  
  SENSITIVE_FIELDS.forEach(field => {
    if (field in result) {
      delete result[field];
    }
  });
  
  return result;
} 