import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MetaLoopEngine } from '../services/MetaLoopEngine';
import { AgentGenerator } from '../services/AgentGenerator';
import { v4 as uuidv4 } from 'uuid';

const metaLoop = new MetaLoopEngine();
const agentGenerator = new AgentGenerator();

interface MetaIntentRequest {
  sessionId?: string;
  action: 'start' | 'clarify' | 'generate' | 'execute' | 'replay' | 'intent-map';
  input?: string;
  confirmed?: boolean;
  task?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('MetaIntent request:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body: MetaIntentRequest = JSON.parse(event.body || '{}');

    switch (body.action) {
      case 'start':
        return await handleStart(body, headers);
      
      case 'clarify':
        return await handleClarify(body, headers);
      
      case 'generate':
        return await handleGenerate(body, headers);
      
      case 'execute':
        return await handleExecute(body, headers);
      
      case 'replay':
        return await handleReplay(body, headers);
      
      case 'intent-map':
        return await handleIntentMap(body, headers);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action' }),
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

async function handleStart(
  body: MetaIntentRequest,
  headers: Record<string, string>
): Promise<APIGatewayProxyResult> {
  if (!body.input) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Input is required' }),
    };
  }

  const sessionId = body.sessionId || uuidv4();
  const result = await metaLoop.startSession(sessionId, body.input);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      sessionId,
      status: result.state.status,
      ambiguityScore: result.state.currentAmbiguityScore,
      response: result.response,
      needsClarification: result.needsClarification,
      activeAgents: result.state.activeSubAgents.map(a => ({
        type: a.type,
        status: a.status,
        questionsAsked: a.questionsAsked,
      })),
      iteration: result.state.iteration,
    }),
  };
}

async function handleClarify(
  body: MetaIntentRequest,
  headers: Record<string, string>
): Promise<APIGatewayProxyResult> {
  if (!body.sessionId || !body.input) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'SessionId and input are required' }),
    };
  }

  const result = await metaLoop.continueSession(body.sessionId, body.input);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      sessionId: body.sessionId,
      status: result.state.status,
      ambiguityScore: result.state.currentAmbiguityScore,
      response: result.response,
      needsClarification: result.needsClarification,
      goalEcho: result.state.currentGoalEcho,
      activeAgents: result.state.activeSubAgents.map(a => ({
        type: a.type,
        status: a.status,
        questionsAsked: a.questionsAsked,
        findings: a.sandbox.findings,
      })),
      iteration: result.state.iteration,
      progress: {
        previousScore: result.state.previousAmbiguityScore,
        currentScore: result.state.currentAmbiguityScore,
        improvement: result.state.previousAmbiguityScore 
          ? result.state.previousAmbiguityScore - result.state.currentAmbiguityScore 
          : 0,
      },
    }),
  };
}

async function handleGenerate(
  body: MetaIntentRequest,
  headers: Record<string, string>
): Promise<APIGatewayProxyResult> {
  if (!body.sessionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'SessionId is required' }),
    };
  }

  const state = metaLoop.getSession(body.sessionId);
  if (!state) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Session not found' }),
    };
  }

  if (state.status !== 'ready') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'Session not ready for agent generation',
        currentStatus: state.status,
      }),
    };
  }

  // Get latest intent
  const latestSnapshot = state.intentSnapshots[state.intentSnapshots.length - 1];
  
  // Generate agent specification
  const agentSpec = await agentGenerator.generateAgent(
    latestSnapshot.extractedIntent,
    state.conversationHistory.map(m => m.content)
  );

  const formattedSpec = agentGenerator.formatSpecificationForDisplay(agentSpec);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      sessionId: body.sessionId,
      agentSpec,
      formattedDisplay: formattedSpec,
      message: 'Agent specification generated! Review and confirm to deploy.',
    }),
  };
}

async function handleExecute(
  body: MetaIntentRequest,
  headers: Record<string, string>
): Promise<APIGatewayProxyResult> {
  if (!body.sessionId || !body.task) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'SessionId and task are required' }),
    };
  }

  const state = metaLoop.getSession(body.sessionId);
  if (!state) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Session not found' }),
    };
  }

  // Get latest intent and generate agent
  const latestSnapshot = state.intentSnapshots[state.intentSnapshots.length - 1];
  const agentSpec = await agentGenerator.generateAgent(
    latestSnapshot.extractedIntent,
    state.conversationHistory.map(m => m.content)
  );

  // Execute the task
  const result = await agentGenerator.executeAgent(agentSpec, body.task);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      sessionId: body.sessionId,
      agentId: agentSpec.agentId,
      agentName: agentSpec.name,
      task: body.task,
      result,
      message: 'Task executed successfully!',
    }),
  };
}

async function handleReplay(
  body: MetaIntentRequest,
  headers: Record<string, string>
): Promise<APIGatewayProxyResult> {
  if (!body.sessionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'SessionId is required' }),
    };
  }

  const state = metaLoop.getSession(body.sessionId);
  if (!state) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Session not found' }),
    };
  }

  // Build replay data
  const replay = {
    sessionId: body.sessionId,
    totalIterations: state.iteration,
    conversationHistory: state.conversationHistory,
    ambiguityProgression: state.intentSnapshots.map(s => ({
      timestamp: s.timestamp,
      score: s.ambiguityScore,
      confidence: s.confidence,
    })),
    intentEvolution: state.intentSnapshots.map(s => ({
      timestamp: s.timestamp,
      intent: s.extractedIntent,
      driftVector: s.driftVector,
    })),
    keyMoments: identifyKeyMoments(state),
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(replay),
  };
}

async function handleIntentMap(
  body: MetaIntentRequest,
  headers: Record<string, string>
): Promise<APIGatewayProxyResult> {
  if (!body.sessionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'SessionId is required' }),
    };
  }

  const snapshots = await metaLoop.getIntentMap(body.sessionId);
  
  // Generate SVG visualization
  const svg = generateIntentMapSVG(snapshots);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      sessionId: body.sessionId,
      snapshots,
      visualization: svg,
      driftVectors: snapshots
        .filter(s => s.driftVector)
        .map(s => s.driftVector),
    }),
  };
}

function identifyKeyMoments(state: any): Array<{ timestamp: number; description: string }> {
  const moments: Array<{ timestamp: number; description: string }> = [];

  // First message
  if (state.conversationHistory.length > 0) {
    moments.push({
      timestamp: state.conversationHistory[0].timestamp,
      description: 'Session started',
    });
  }

  // Significant ambiguity drops
  for (let i = 1; i < state.intentSnapshots.length; i++) {
    const prev = state.intentSnapshots[i - 1];
    const curr = state.intentSnapshots[i];
    const drop = prev.ambiguityScore - curr.ambiguityScore;
    
    if (drop > 20) {
      moments.push({
        timestamp: curr.timestamp,
        description: `Major clarity breakthrough (${drop.toFixed(0)} point improvement)`,
      });
    }
  }

  // Goal changes
  state.intentSnapshots.forEach((snapshot: any) => {
    if (snapshot.driftVector?.changes.some((c: string) => c.includes('Goal changed'))) {
      moments.push({
        timestamp: snapshot.timestamp,
        description: 'User pivoted their goal',
      });
    }
  });

  return moments.sort((a, b) => a.timestamp - b.timestamp);
}

function generateIntentMapSVG(snapshots: any[]): string {
  if (snapshots.length === 0) return '';

  const width = 800;
  const height = 400;
  const padding = 50;
  const nodeRadius = 20;

  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<style>
    .timeline { stroke: #ccc; stroke-width: 2; }
    .node { fill: #667eea; stroke: white; stroke-width: 2; }
    .node-text { fill: white; font-size: 12px; text-anchor: middle; }
    .drift-arrow { stroke: #764ba2; stroke-width: 2; fill: none; }
    .label { font-size: 10px; fill: #666; }
  </style>`;

  // Timeline
  svg += `<line x1="${padding}" y1="${height / 2}" x2="${width - padding}" y2="${height / 2}" class="timeline"/>`;

  // Nodes
  const spacing = (width - 2 * padding) / Math.max(1, snapshots.length - 1);
  snapshots.forEach((snapshot, i) => {
    const x = padding + i * spacing;
    const y = height / 2;
    
    // Node circle
    svg += `<circle cx="${x}" cy="${y}" r="${nodeRadius}" class="node"/>`;
    
    // Ambiguity score
    svg += `<text x="${x}" y="${y + 5}" class="node-text">${snapshot.ambiguityScore.toFixed(0)}</text>`;
    
    // Timestamp label
    const date = new Date(snapshot.timestamp);
    svg += `<text x="${x}" y="${y + 40}" class="label" text-anchor="middle">${date.toLocaleTimeString()}</text>`;
    
    // Drift arrow
    if (i > 0 && snapshot.driftVector) {
      const prevX = padding + (i - 1) * spacing;
      const magnitude = snapshot.driftVector.magnitude * 50;
      svg += `<path d="M ${prevX + nodeRadius} ${y} Q ${(prevX + x) / 2} ${y - magnitude} ${x - nodeRadius} ${y}" class="drift-arrow"/>`;
    }
  });

  svg += '</svg>';
  return svg;
}
