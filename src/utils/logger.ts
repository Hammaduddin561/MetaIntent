// Logger utility for S3-based logging

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { LogEntry, LogLevel } from '../models/types';
import { ENV } from '../models/constants';

export class Logger {
  private client: S3Client;
  private bucketName: string;
  private logBuffer: LogEntry[] = [];
  private bufferSize = 10;

  constructor() {
    this.client = new S3Client({ region: ENV.AWS_REGION });
    this.bucketName = ENV.LOG_BUCKET_NAME;
  }

  /**
   * Log info message
   */
  async info(sessionId: string, component: string, message: string, data?: any): Promise<void> {
    await this.log('info', sessionId, component, message, data);
  }

  /**
   * Log warning message
   */
  async warn(sessionId: string, component: string, message: string, data?: any): Promise<void> {
    await this.log('warn', sessionId, component, message, data);
  }

  /**
   * Log error message
   */
  async error(sessionId: string, component: string, message: string, data?: any): Promise<void> {
    await this.log('error', sessionId, component, message, data);
  }

  /**
   * Log with cost and duration tracking
   */
  async logWithMetrics(
    level: LogLevel,
    sessionId: string,
    component: string,
    message: string,
    cost?: number,
    duration?: number,
    data?: any
  ): Promise<void> {
    await this.log(level, sessionId, component, message, data, cost, duration);
  }

  /**
   * Core logging function
   */
  private async log(
    level: LogLevel,
    sessionId: string,
    component: string,
    message: string,
    data?: any,
    cost?: number,
    duration?: number
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: Date.now(),
      sessionId,
      component,
      level,
      message,
      data,
      cost,
      duration,
    };

    // Console log for immediate visibility
    console.log(JSON.stringify(entry));

    // Add to buffer
    this.logBuffer.push(entry);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Flush log buffer to S3
   */
  async flush(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const timestamp = Date.now();
      const key = `logs/${new Date().toISOString().split('T')[0]}/${timestamp}.json`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify(logs),
        ContentType: 'application/json',
      });

      await this.client.send(command);
    } catch (error: any) {
      console.error('Failed to flush logs to S3:', error.message);
      // Don't throw - logging failures shouldn't break the application
    }
  }
}
