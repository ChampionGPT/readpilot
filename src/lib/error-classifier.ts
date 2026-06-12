/**
 * Error classification and user-friendly formatting for Claude SDK errors.
 * Provides categorized error messages with actionable hints.
 */

export interface ClassifiedError {
  category: 'auth' | 'network' | 'rate_limit' | 'session' | 'tool' | 'unknown';
  userMessage: string;
  actionHint: string;
  retryable: boolean;
  details?: string;
  rawMessage: string;
  providerName?: string;
}

interface ClassifyErrorParams {
  error: unknown;
  stderr?: string;
  providerName?: string;
  baseUrl?: string;
  hasImages?: boolean;
  thinkingEnabled?: boolean;
  context1mEnabled?: boolean;
  effortSet?: boolean;
}

/**
 * Classify an error by examining its message and characteristics.
 */
export function classifyError(params: ClassifyErrorParams): ClassifiedError {
  const { error, stderr, providerName } = params;

  // Extract error message
  const rawMessage = error instanceof Error
    ? error.message
    : String(error);

  const lowerMessage = rawMessage.toLowerCase();

  // Auth errors
  if (
    lowerMessage.includes('api key') ||
    lowerMessage.includes('authentication') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('invalid credentials') ||
    lowerMessage.includes('invalid api key') ||
    lowerMessage.includes('api_key') ||
    lowerMessage.includes('auth token')
  ) {
    return {
      category: 'auth',
      userMessage: 'API authentication failed',
      actionHint: 'Check your API key in settings and ensure it is valid',
      retryable: false,
      rawMessage,
      providerName,
    };
  }

  // Network errors
  if (
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('etimedout') ||
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch failed') ||
    lowerMessage.includes('connect') ||
    lowerMessage.includes('socket')
  ) {
    return {
      category: 'network',
      userMessage: 'Network connection failed',
      actionHint: 'Check your internet connection and try again',
      retryable: true,
      rawMessage,
      providerName,
    };
  }

  // Rate limit errors
  if (
    lowerMessage.includes('rate_limit') ||
    lowerMessage.includes('too many requests') ||
    lowerMessage.includes('429') ||
    lowerMessage.includes('rate limit')
  ) {
    return {
      category: 'rate_limit',
      userMessage: 'Rate limit exceeded',
      actionHint: 'Wait a moment before sending another message',
      retryable: true,
      rawMessage,
      providerName,
    };
  }

  // Session errors
  if (
    lowerMessage.includes('session') ||
    lowerMessage.includes('resume') ||
    lowerMessage.includes('enoent') ||
    lowerMessage.includes('not found') ||
    lowerMessage.includes('working directory')
  ) {
    return {
      category: 'session',
      userMessage: 'Session error',
      actionHint: 'Starting a new conversation. Your previous session may have expired.',
      retryable: true,
      rawMessage,
      providerName,
    };
  }

  // Tool/Spawn errors
  if (
    lowerMessage.includes('spawn') ||
    lowerMessage.includes('tool') ||
    lowerMessage.includes('einval') ||
    lowerMessage.includes('enoexec') ||
    lowerMessage.includes('claude not found') ||
    lowerMessage.includes('cannot find')
  ) {
    return {
      category: 'tool',
      userMessage: 'Failed to start Claude CLI',
      actionHint: 'Ensure Claude Code is installed and in your PATH',
      retryable: true,
      rawMessage,
      providerName,
    };
  }

  // Default unknown error
  return {
    category: 'unknown',
    userMessage: 'An unexpected error occurred',
    actionHint: 'Please try again. If the problem persists, restart the application.',
    retryable: true,
    rawMessage,
    providerName,
  };
}

/**
 * Format a classified error into a user-friendly message.
 */
export function formatClassifiedError(classified: ClassifiedError): string {
  return `${classified.userMessage}. ${classified.actionHint}`;
}