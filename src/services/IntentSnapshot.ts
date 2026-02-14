import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';

export interface ExtractedIntent {
  goal?: string;
  scope?: string;
  constraints?: string[];
  successCriteria?: string[];
  emotionalContext?: string;
}

export interface DriftVector {
  from: string; // previous snapshot ID
  changes: string[];
  reason: string;
  magnitude: number; // 0-1
}

export interface IntentSnapshot {
  snapshotId: string;
  sessionId: string;
  timestamp: number;
  ambiguityScore: number;
  userInput: string;
  extractedIntent: ExtractedIntent;
  confidence: number;
  driftVector?: DriftVector;
}

export class IntentSnapshotManager {
  private dynamoClient: DynamoDBClient;
  private tableName: string;

  constructor(tableName: string = process.env.SESSION_TABLE || 'MetaIntent-Sessions') {
    this.dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
    this.tableName = tableName;
  }

  async createSnapshot(
    sessionId: string,
    userInput: string,
    ambiguityScore: number,
    extractedIntent: ExtractedIntent,
    confidence: number,
    previousSnapshotId?: string
  ): Promise<IntentSnapshot> {
    const snapshot: IntentSnapshot = {
      snapshotId: uuidv4(),
      sessionId,
      timestamp: Date.now(),
      ambiguityScore,
      userInput,
      extractedIntent,
      confidence,
    };

    // Calculate drift if there's a previous snapshot
    if (previousSnapshotId) {
      const previousSnapshot = await this.getSnapshot(sessionId, previousSnapshotId);
      if (previousSnapshot) {
        snapshot.driftVector = this.calculateDrift(previousSnapshot, snapshot);
      }
    }

    await this.saveSnapshot(snapshot);
    return snapshot;
  }

  private async saveSnapshot(snapshot: IntentSnapshot): Promise<void> {
    const item = {
      sessionId: snapshot.sessionId,
      snapshotId: snapshot.snapshotId,
      type: 'SNAPSHOT',
      timestamp: snapshot.timestamp,
      data: JSON.stringify(snapshot),
      ttl: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    };

    await this.dynamoClient.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(item),
    }));
  }

  async getSnapshot(sessionId: string, snapshotId: string): Promise<IntentSnapshot | null> {
    const snapshots = await this.getSessionSnapshots(sessionId);
    return snapshots.find(s => s.snapshotId === snapshotId) || null;
  }

  async getSessionSnapshots(sessionId: string): Promise<IntentSnapshot[]> {
    try {
      const response = await this.dynamoClient.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'sessionId = :sid',
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'type',
        },
        ExpressionAttributeValues: marshall({
          ':sid': sessionId,
          ':type': 'SNAPSHOT',
        }),
      }));

      if (!response.Items) return [];

      return response.Items
        .map(item => {
          const unmarshalled = unmarshall(item);
          return JSON.parse(unmarshalled.data) as IntentSnapshot;
        })
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Failed to get snapshots:', error);
      return [];
    }
  }

  private calculateDrift(previous: IntentSnapshot, current: IntentSnapshot): DriftVector {
    const changes: string[] = [];
    let magnitude = 0;

    // Compare goals
    if (previous.extractedIntent.goal !== current.extractedIntent.goal) {
      changes.push(`Goal changed from "${previous.extractedIntent.goal}" to "${current.extractedIntent.goal}"`);
      magnitude += 0.4;
    }

    // Compare scope
    if (previous.extractedIntent.scope !== current.extractedIntent.scope) {
      changes.push(`Scope refined: ${current.extractedIntent.scope}`);
      magnitude += 0.2;
    }

    // Compare constraints
    const prevConstraints = previous.extractedIntent.constraints || [];
    const currConstraints = current.extractedIntent.constraints || [];
    const newConstraints = currConstraints.filter(c => !prevConstraints.includes(c));
    if (newConstraints.length > 0) {
      changes.push(`Added constraints: ${newConstraints.join(', ')}`);
      magnitude += 0.15 * newConstraints.length;
    }

    // Compare success criteria
    const prevCriteria = previous.extractedIntent.successCriteria || [];
    const currCriteria = current.extractedIntent.successCriteria || [];
    const newCriteria = currCriteria.filter(c => !prevCriteria.includes(c));
    if (newCriteria.length > 0) {
      changes.push(`Added success criteria: ${newCriteria.join(', ')}`);
      magnitude += 0.15 * newCriteria.length;
    }

    // Ambiguity score change
    const scoreDelta = Math.abs(current.ambiguityScore - previous.ambiguityScore);
    if (scoreDelta > 20) {
      changes.push(`Clarity ${current.ambiguityScore < previous.ambiguityScore ? 'improved' : 'decreased'} by ${scoreDelta.toFixed(0)} points`);
      magnitude += scoreDelta / 200;
    }

    return {
      from: previous.snapshotId,
      changes,
      reason: this.inferDriftReason(changes),
      magnitude: Math.min(1, magnitude),
    };
  }

  private inferDriftReason(changes: string[]): string {
    if (changes.length === 0) return 'No significant changes';
    if (changes.some(c => c.includes('Goal changed'))) return 'User refined or pivoted their goal';
    if (changes.some(c => c.includes('Clarity improved'))) return 'Clarification process working';
    if (changes.some(c => c.includes('constraints'))) return 'User added more context about limitations';
    if (changes.some(c => c.includes('success criteria'))) return 'User clarified desired outcomes';
    return 'Intent evolved through conversation';
  }

  async getLatestSnapshot(sessionId: string): Promise<IntentSnapshot | null> {
    const snapshots = await this.getSessionSnapshots(sessionId);
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }
}
