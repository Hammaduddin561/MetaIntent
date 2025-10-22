import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { SessionState, SessionStatus, SessionContext } from '../models/types';
import { ENV, SESSION_TTL_SECONDS } from '../models/constants';
import { SessionNotFoundError, DynamoDBError } from '../models/errors';
import { v4 as uuidv4 } from 'uuid';

export class SessionManager {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const client = new DynamoDBClient({ region: ENV.AWS_REGION });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = ENV.SESSION_TABLE_NAME;
  }

  async createSession(userId?: string): Promise<SessionState> {
    const now = Date.now();
    const session: SessionState = {
      sessionId: uuidv4(),
      userId,
      createdAt: now,
      updatedAt: now,
      ttl: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
      status: 'initiated',
      currentStep: 'start',
      completedSteps: [],
      fallbackHistory: [],
      metadata: {
        inputModality: 'text',
        llmBackend: ENV.PRIMARY_LLM_BACKEND,
        totalCost: 0,
        apiCallCount: 0,
      },
    };

    await this.putSession(session);
    return session;
  }

  async loadSession(sessionId: string): Promise<SessionState> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: { sessionId },
    });

    const response = await this.docClient.send(command);
    
    if (!response.Item) {
      throw new SessionNotFoundError(sessionId);
    }

    return response.Item as SessionState;
  }

  async updateSession(session: SessionState): Promise<void> {
    session.updatedAt = Date.now();
    await this.putSession(session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: { sessionId },
    });

    await this.docClient.send(command);
  }

  async updateStatus(sessionId: string, status: SessionStatus): Promise<void> {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { sessionId },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': Date.now(),
      },
    });

    await this.docClient.send(command);
  }

  async addCompletedStep(sessionId: string, step: string): Promise<void> {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { sessionId },
      UpdateExpression: 'SET completedSteps = list_append(if_not_exists(completedSteps, :empty), :step), updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':step': [step],
        ':empty': [],
        ':updatedAt': Date.now(),
      },
    });

    await this.docClient.send(command);
  }

  getContext(session: SessionState): SessionContext {
    return {
      sessionId: session.sessionId,
      status: session.status,
      currentStep: session.currentStep,
      completedSteps: session.completedSteps,
      identityData: session.identityData,
      metadata: session.metadata,
    };
  }

  private async putSession(session: SessionState): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: session,
    });

    try {
      await this.docClient.send(command);
    } catch (error: any) {
      throw new DynamoDBError(`Failed to save session: ${error.message}`);
    }
  }
}
