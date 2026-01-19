/**
 * API Error Handling Utilities
 * 
 * Provides robust wrappers for HTTP requests with:
 * - Automatic timeout protection
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern for failing services
 * - Request/response logging
 */

export interface FetchOptions {
  timeout?: number;           // Default: 10000ms
  retries?: number;          // Default: 3
  backoffMs?: number;        // Default: 1000ms
  onRetry?: (attempt: number, error: Error) => void;
}

export interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  statusCode?: number;
  attempts: number;
}

/**
 * Fetch with timeout protection
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<any>> {
  const {
    timeout = 10000,
    retries = 3,
    backoffMs = 1000,
    onRetry
  } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return {
          success: true,
          data,
          statusCode: response.status,
          attempts: attempt
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < retries) {
        const waitMs = backoffMs * Math.pow(2, attempt - 1);
        onRetry?.(attempt, lastError);
        
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }
  
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: retries
  };
}

/**
 * Circuit breaker for failing endpoints
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private failureThreshold = 5,
    private resetTimeoutMs = 60000
  ) {}
  
  async execute<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    // Check if should reset
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }
    
    try {
      const result = await fn();
      
      // Success - reset on half-open
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
      
      return result;
    } catch (err) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
      }
      
      throw err;
    }
  }
  
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      isHealthy: this.state === 'CLOSED'
    };
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < maxAttempts) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Timeout wrapper for any promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

/**
 * Request logger for debugging
 */
export class RequestLogger {
  private requests: Array<{
    url: string;
    timestamp: Date;
    duration: number;
    status: 'success' | 'failure';
    statusCode?: number;
    errorMessage?: string;
  }> = [];
  
  log(
    url: string,
    duration: number,
    status: 'success' | 'failure',
    statusCode?: number,
    errorMessage?: string
  ) {
    this.requests.push({
      url,
      timestamp: new Date(),
      duration,
      status,
      statusCode,
      errorMessage
    });
  }
  
  getStats() {
    const total = this.requests.length;
    const successes = this.requests.filter(r => r.status === 'success').length;
    const failures = this.requests.filter(r => r.status === 'failure').length;
    const avgDuration = this.requests.length > 0
      ? this.requests.reduce((s, r) => s + r.duration, 0) / this.requests.length
      : 0;
    
    return {
      totalRequests: total,
      successes,
      failures,
      successRate: total > 0 ? (successes / total) * 100 : 0,
      avgDurationMs: avgDuration,
      slowestMs: Math.max(...this.requests.map(r => r.duration), 0),
      recentErrors: this.requests
        .filter(r => r.status === 'failure')
        .slice(-5)
        .map(r => ({ url: r.url, error: r.errorMessage }))
    };
  }
  
  exportCsv() {
    const header = 'timestamp,url,duration_ms,status,status_code,error\n';
    const rows = this.requests
      .map(r => [
        r.timestamp.toISOString(),
        r.url,
        r.duration,
        r.status,
        r.statusCode || '',
        r.errorMessage || ''
      ].join(','))
      .join('\n');
    
    return header + rows;
  }
}

export default {
  fetchWithTimeout,
  retryWithBackoff,
  withTimeout,
  CircuitBreaker,
  RequestLogger
};
