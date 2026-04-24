/**
 * errors.ts — Centralized error handling
 *
 * PROBLEM: Raw Supabase/PostgreSQL errors expose internal details
 * (table names, constraint names, query structure) to the UI.
 * This is both a security risk and a poor UX.
 *
 * FIX: All errors pass through sanitizeError() before reaching
 * the user. Internal details are logged only to the console.
 */

// Structured error codes thrown by our PostgreSQL functions
const DB_ERROR_CODES: Record<string, string> = {
  SESSION_NOT_FOUND: 'الجلسة غير موجودة أو تم إغلاقها بالفعل',
  DEVICE_UNAVAILABLE: 'الجهاز غير متاح حالياً',
  DUPLICATE_SESSION: 'يوجد جلسة نشطة بالفعل على هذا الجهاز',
};

const POSTGRES_ERROR_CODES: Record<string, string> = {
  '23505': 'يوجد تكرار في البيانات — يرجى المحاولة مرة أخرى',
  '23503': 'خطأ في البيانات المرتبطة',
  '23514': 'البيانات المدخلة تنتهك قواعد النظام',
  '40001': 'يرجى المحاولة مرة أخرى — تضارع في العمليات',
  '40P01': 'يرجى المحاولة مرة أخرى — تضارع في الوصول',
  '42501': 'غير مصرح بإجراء هذه العملية',
};

export interface AppError {
  message: string; // User-facing Arabic message
  code?: string; // Internal code for programmatic handling
  isRetryable: boolean; // Should the UI offer a retry button?
}

/**
 * Sanitize any error into a user-friendly AppError with Arabic message.
 * Internal details are logged to console for debugging.
 */
export function sanitizeError(error: unknown): AppError {
  // Log full error internally for debugging
  console.error('[PS Lounge Error]', error);

  if (error instanceof Error) {
    const msg = error.message;

    // Check for our custom PostgreSQL function error codes
    for (const [code, arabicMsg] of Object.entries(DB_ERROR_CODES)) {
      if (msg.includes(code)) {
        return { message: arabicMsg, code, isRetryable: false };
      }
    }

    // Check for PostgreSQL error codes (from Supabase error objects)
    const pgCodeMatch = msg.match(/(\d{5})/);
    if (pgCodeMatch && POSTGRES_ERROR_CODES[pgCodeMatch[1]]) {
      const code = pgCodeMatch[1];
      return {
        message: POSTGRES_ERROR_CODES[code],
        code,
        isRetryable: ['40001', '40P01'].includes(code),
      };
    }

    // Supabase-specific errors
    if (msg.includes('JWT') || msg.includes('token')) {
      return {
        message: 'يرجى تسجيل الدخول مجدداً — انتهت صلاحية الجلسة',
        code: 'AUTH_EXPIRED',
        isRetryable: false,
      };
    }

    if (msg.includes('network') || msg.includes('fetch')) {
      return {
        message: 'خطأ في الاتصال بالشبكة — تحقق من الإنترنت وحاول مرة أخرى',
        code: 'NETWORK_ERROR',
        isRetryable: true,
      };
    }
  }

  // Supabase PostgrestError shape
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const supabaseErr = error as { code: string; message: string; details?: string };
    if (POSTGRES_ERROR_CODES[supabaseErr.code]) {
      return {
        message: POSTGRES_ERROR_CODES[supabaseErr.code],
        code: supabaseErr.code,
        isRetryable: ['40001', '40P01'].includes(supabaseErr.code),
      };
    }
  }

  // Safe fallback — never expose internals
  return {
    message: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
    isRetryable: true,
  };
}

/**
 * Check if an error is retryable (transient failure)
 */
export function isRetryableError(error: unknown): boolean {
  return sanitizeError(error).isRetryable;
}

/**
 * Type guard to check if a value is an AppError
 */
export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'isRetryable' in value
  );
}
