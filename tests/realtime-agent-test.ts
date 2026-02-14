/**
 * 🚀 MetaIntent Real-Time Agent Test
 * 
 * Exercises the FULL self-evolving agent pipeline with live output:
 *   User Input → Ambiguity Detection → Sub-Agent Orchestration →
 *   Goal Echo → Agent Generation → Execution
 * 
 * Run: npx ts-node tests/realtime-agent-test.ts
 */

import { LLMAdapterFactory } from '../src/adapters/LLMAdapterFactory';
import { LLMAdapter, LLMConfig, LLMResponse } from '../src/models/types';
import { MetaLoopEngine } from '../src/services/MetaLoopEngine';
import { AgentGenerator, AgentSpecification } from '../src/services/AgentGenerator';

// ─── Colors ──────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgMagenta: '\x1b[45m',
  bgYellow: '\x1b[43m',
};

// ─── Helpers ─────────────────────────────────────────────────────────
function banner(text: string) {
  const line = '═'.repeat(60);
  console.log(`\n${C.cyan}${C.bold}╔${line}╗`);
  console.log(`║  ${text.padEnd(58)}║`);
  console.log(`╚${line}╝${C.reset}\n`);
}

function step(icon: string, label: string) {
  console.log(`${C.yellow}${C.bold}  ▶ ${icon}  ${label}${C.reset}`);
}

function info(label: string, value: string) {
  console.log(`${C.dim}     ${label}: ${C.reset}${value}`);
}

function success(msg: string) {
  console.log(`${C.green}${C.bold}  ✅ ${msg}${C.reset}`);
}

function _warn(msg: string) {
  console.log(`${C.yellow}  ⚠️  ${msg}${C.reset}`);
}

function separator() {
  console.log(`${C.dim}  ${'─'.repeat(56)}${C.reset}`);
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function elapsed(start: number): string {
  return `${Date.now() - start}ms`;
}

// ─── Mock LLM that returns smart contextual responses ────────────────
class RealtimeMockLLM implements LLMAdapter {
  private callCount = 0;

  async invoke(prompt: string, _config: LLMConfig): Promise<LLMResponse> {
    this.callCount++;
    const lower = prompt.toLowerCase();
    await sleep(50 + Math.random() * 80); // simulate latency

    // Ambiguity analysis — extract the actual user input from the prompt
    if (lower.includes('detecting ambiguity') || lower.includes('analyze the following')) {
      const inputMatch = prompt.match(/User Input:\s*"([^"]+)"/i);
      const userText = inputMatch ? inputMatch[1].toLowerCase() : lower;
      // Ambiguous if vague terms, short, or generic "help me" style
      const vagueSignals = ['help me', 'something', 'stuff', 'things', 'my project'];
      const isAmbiguous = vagueSignals.some(s => userText.includes(s)) || userText.split(' ').length < 8;
      // Clear if has specific tech terms
      const clearSignals = ['deploy', 'lambda', 'dynamodb', 'rest api', 'node.js', 'dashboard with live charts'];
      const isClear = clearSignals.some(s => userText.includes(s));
      const finalAmbiguous = isClear ? false : isAmbiguous;

      return this.respond(JSON.stringify({
        score: finalAmbiguous ? 78 : 22,
        signals: {
          hedgingLanguage: finalAmbiguous ? ['want to', 'something'] : [],
          contradictions: [],
          emotionalMarkers: [{ type: finalAmbiguous ? 'confusion' : 'neutral', confidence: 0.7, evidence: userText.slice(0, 40) }],
          vagueTerms: finalAmbiguous ? ['something', 'data'] : [],
          multipleTopics: [],
        },
        recommendedStrategy: finalAmbiguous ? 'multi' : 'scope',
        reasoning: finalAmbiguous
          ? 'Input uses vague terms without specific technical details or measurable outcomes'
          : 'Input contains specific technologies, clear action verb, and defined scope',
      }));
    }

    // Sub-agent question generation
    if (lower.includes('scope') && lower.includes('question')) {
      return this.respond('What specific type of data do you want to visualize, and who is the target audience?');
    }
    if (lower.includes('constraints') && lower.includes('question')) {
      return this.respond('What are your performance requirements (latency, throughput) and any technology constraints?');
    }
    if (lower.includes('outcomes') && lower.includes('question')) {
      return this.respond('What does success look like? How will you measure if this solution is working?');
    }

    // Synthesis of findings
    if (lower.includes('synthesize') || lower.includes('findings')) {
      return this.respond(JSON.stringify({
        summary: 'User wants to build a real-time data dashboard with live metrics and alerts.',
        extractedIntent: {
          goal: 'Build a real-time monitoring dashboard',
          scope: 'Web-based dashboard with live data feeds, charts, and alerting',
          constraints: ['Must handle 1000+ events/sec', 'Sub-second latency', 'Mobile responsive'],
          successCriteria: ['Dashboard loads in <2s', 'Real-time updates every 500ms', 'Alert delivery <5s'],
          emotionalContext: 'Excited and motivated',
        },
        confidence: 0.87,
      }));
    }

    // Agent generation
    if (lower.includes('agent architect') || lower.includes('agent specification')) {
      // Detect what kind of agent from the goal in the prompt
      const goalMatch = prompt.match(/Goal:\s*(.+)/i);
      const goal = goalMatch ? goalMatch[1].trim() : '';
      const isDashboard = goal.toLowerCase().includes('dashboard') || goal.toLowerCase().includes('monitor');
      const isDeploy = goal.toLowerCase().includes('deploy') || goal.toLowerCase().includes('lambda');

      if (isDeploy) {
        return this.respond(JSON.stringify({
          name: 'AWS Deployment Agent',
          purpose: 'Deploy and manage a Node.js REST API on AWS Lambda with DynamoDB backend',
          capabilities: ['SAM/CloudFormation deployment', 'Lambda function packaging', 'DynamoDB table provisioning', 'API Gateway configuration', 'CI/CD pipeline setup'],
          scope: { included: ['Lambda deployment', 'DynamoDB setup', 'API Gateway routing', 'IAM roles'], excluded: ['Frontend hosting', 'DNS management', 'Monitoring setup'] },
          constraints: ['Use AWS SAM for IaC', 'Node.js 18+ runtime', 'Pay-per-use pricing model'],
          successCriteria: ['API responds in <200ms', 'Zero-downtime deployments', 'All CRUD endpoints functional'],
          estimatedComplexity: 'moderate',
          suggestedArchitecture: 'single',
          systemPrompt: 'You are an AWS deployment specialist. Package Node.js Lambda functions, provision DynamoDB tables, configure API Gateway routes, and manage IAM permissions. Ensure infrastructure-as-code best practices.',
        }));
      }

      return this.respond(JSON.stringify({
        name: 'RealTime Dashboard Agent',
        purpose: 'Build and manage a real-time monitoring dashboard with live data visualization and alerting',
        capabilities: ['WebSocket data ingestion', 'Real-time chart rendering (D3.js/Chart.js)', 'Threshold-based alerting', 'Auto-scaling data pipelines', 'Dashboard layout management'],
        scope: { included: ['Data ingestion', 'Visualization', 'Alerting', 'User preferences'], excluded: ['Data storage backend', 'Authentication', 'Billing'] },
        constraints: ['Sub-second latency', 'Handle 1000+ events/sec', 'Mobile responsive'],
        successCriteria: ['Dashboard loads <2s', 'Updates every 500ms', 'Alert delivery <5s'],
        estimatedComplexity: 'complex',
        suggestedArchitecture: 'multi-agent',
        systemPrompt: 'You are a real-time dashboard agent. Monitor incoming data streams, render live visualizations, and trigger alerts when thresholds are breached. Prioritize low-latency delivery and clear visual presentation.',
      }));
    }

    // Agent execution
    if (lower.includes('set up') || lower.includes('deploy') || lower.includes('monitoring')) {
      return this.respond(
        '✅ Agent initialized successfully.\n' +
        '📡 WebSocket connection established on ws://localhost:8080\n' +
        '📊 Dashboard template loaded (3 panels: Metrics, Alerts, Logs)\n' +
        '⚡ Processing pipeline ready — throughput: 1,247 events/sec\n' +
        '🔔 Alert rules configured: CPU > 90%, Memory > 85%, Latency > 500ms\n' +
        '🟢 Agent is LIVE and monitoring.'
      );
    }

    // Default fallback
    return this.respond('Acknowledged. Processing your request.');
  }

  async invokeWithRetry(prompt: string, config: LLMConfig, _retries: number): Promise<LLMResponse> {
    return this.invoke(prompt, config);
  }

  estimateCost(): number { return 0.002; }

  private respond(content: string): LLMResponse {
    return {
      content,
      usage: { inputTokens: 150 + Math.floor(Math.random() * 100), outputTokens: 80 + Math.floor(Math.random() * 60) },
    };
  }
}

// ─── Install mock ────────────────────────────────────────────────────
function installMock() {
  const mock = new RealtimeMockLLM();
  (LLMAdapterFactory as any).bedrockInstance = mock;
  (LLMAdapterFactory as any).nimInstance = mock;
  LLMAdapterFactory.getPrimaryAdapter = () => mock;
  LLMAdapterFactory.getFallbackAdapter = () => mock;

  // Mock DynamoDB-dependent methods to avoid AWS credential errors
  const { IntentSnapshotManager } = require('../src/services/IntentSnapshot');
  IntentSnapshotManager.prototype.saveSnapshot = async function () { /* no-op */ };
  IntentSnapshotManager.prototype.getSnapshot = async function () { return null; };
  IntentSnapshotManager.prototype.getSessionSnapshots = async function () { return []; };
  IntentSnapshotManager.prototype.getLatestSnapshot = async function () { return null; };

  // Mock MetaLoopEngine's DynamoDB persistence
  const { MetaLoopEngine: MLE } = require('../src/services/MetaLoopEngine');
  MLE.prototype.saveSessionState = async function () { /* no-op */ };
  MLE.prototype.loadSessionState = async function () { return null; };
}

// ═══════════════════════════════════════════════════════════════════════
//  SCENARIO 1 — Ambiguous Input (full clarification loop)
// ═══════════════════════════════════════════════════════════════════════
async function scenario1() {
  banner('SCENARIO 1: Ambiguous Input → Clarification → Agent');
  const engine = new MetaLoopEngine();
  const sessionId = `realtime-${Date.now()}`;
  const userInput = 'I want to build something that shows me data in real time';

  // Step 1: Start session
  step('📥', 'USER INPUT');
  info('Text', `"${userInput}"`);
  info('Session', sessionId);
  separator();

  let t = Date.now();
  step('🔍', 'AMBIGUITY DETECTION');
  const result1 = await engine.startSession(sessionId, userInput);
  info('Ambiguity Score', `${result1.state.currentAmbiguityScore}/100`);
  info('Status', result1.state.status);
  info('Sub-Agents Spawned', `${result1.state.activeSubAgents.length}`);
  result1.state.activeSubAgents.forEach((a, i) => {
    info(`  Agent[${i}]`, `${a.agentId.slice(0, 8)}… type=${a.type} status=${a.status}`);
  });
  info('Needs Clarification', result1.needsClarification ? 'YES' : 'NO');
  info('Time', elapsed(t));
  separator();

  step('💬', 'ASSISTANT RESPONSE (clarification)');
  console.log(`${C.blue}${result1.response.split('\n').map((l: string) => `     ${l}`).join('\n')}${C.reset}`);
  separator();

  // Step 2: User provides clarification
  const clarification = 'I want a real-time monitoring dashboard with live charts and alerts for server metrics';
  step('📥', 'USER CLARIFICATION');
  info('Text', `"${clarification}"`);
  separator();

  t = Date.now();
  step('🔄', 'CONTINUE SESSION (re-analysis + synthesis)');
  const result2 = await engine.continueSession(sessionId, clarification);
  info('New Ambiguity Score', `${result2.state.currentAmbiguityScore}/100`);
  info('Previous Score', `${result2.state.previousAmbiguityScore ?? 'N/A'}`);
  info('Iteration', `${result2.state.iteration}`);
  info('Snapshots', `${result2.state.intentSnapshots.length}`);
  info('Status', result2.state.status);
  info('Time', elapsed(t));
  separator();

  step('🎯', 'GOAL ECHO');
  if (result2.state.currentGoalEcho) {
    const echo = result2.state.currentGoalEcho;
    info('Confidence', `${(echo.confidence * 100).toFixed(0)}%`);
    info('Ambiguity Reduction', `${result2.state.previousAmbiguityScore ?? '?'} → ${result2.state.currentAmbiguityScore}`);
    console.log(`${C.magenta}${echo.formattedDisplay.split('\n').map((l: string) => `     ${l}`).join('\n')}${C.reset}`);
  } else {
    console.log(`${C.blue}${result2.response.split('\n').map((l: string) => `     ${l}`).join('\n')}${C.reset}`);
  }
  separator();

  // Step 3: Generate agent
  t = Date.now();
  step('🤖', 'AGENT GENERATION');
  const generator = new AgentGenerator();
  const latestSnapshot = result2.state.intentSnapshots[result2.state.intentSnapshots.length - 1];
  const agent = await generator.generateAgent(
    latestSnapshot.extractedIntent,
    result2.state.conversationHistory.map(m => m.content)
  );
  printAgent(agent, t);

  // Step 4: Execute agent
  t = Date.now();
  step('⚡', 'AGENT EXECUTION');
  const execOutput = await generator.executeAgent(agent, 'Set up the real-time monitoring dashboard');
  info('Time', elapsed(t));
  console.log(`${C.green}${execOutput.split('\n').map((l: string) => `     ${l}`).join('\n')}${C.reset}`);

  success('Scenario 1 complete — full self-evolving cycle executed!');
}

// ═══════════════════════════════════════════════════════════════════════
//  SCENARIO 2 — Clear Input (direct to agent)
// ═══════════════════════════════════════════════════════════════════════
async function scenario2() {
  banner('SCENARIO 2: Clear Input → Direct Agent Generation');
  const engine = new MetaLoopEngine();
  const sessionId = `realtime-clear-${Date.now()}`;
  const userInput = 'Deploy a Node.js REST API to AWS Lambda with DynamoDB backend';

  step('📥', 'USER INPUT');
  info('Text', `"${userInput}"`);
  separator();

  let t = Date.now();
  step('🔍', 'AMBIGUITY DETECTION');
  const result = await engine.startSession(sessionId, userInput);
  info('Ambiguity Score', `${result.state.currentAmbiguityScore}/100`);
  info('Needs Clarification', result.needsClarification ? 'YES' : 'NO');
  info('Status', result.state.status);
  info('Time', elapsed(t));
  separator();

  step('🎯', 'GOAL ECHO (immediate)');
  if (result.state.currentGoalEcho) {
    const echo = result.state.currentGoalEcho;
    info('Confidence', `${(echo.confidence * 100).toFixed(0)}%`);
    console.log(`${C.magenta}${echo.formattedDisplay.split('\n').map((l: string) => `     ${l}`).join('\n')}${C.reset}`);
  }
  separator();

  t = Date.now();
  step('🤖', 'AGENT GENERATION');
  const generator = new AgentGenerator();
  const snapshot = result.state.intentSnapshots[result.state.intentSnapshots.length - 1];
  const agent = await generator.generateAgent(
    snapshot.extractedIntent,
    result.state.conversationHistory.map(m => m.content)
  );
  printAgent(agent, t);

  t = Date.now();
  step('⚡', 'AGENT EXECUTION');
  const execOutput = await generator.executeAgent(agent, 'Deploy the Node.js REST API');
  info('Time', elapsed(t));
  console.log(`${C.green}${execOutput.split('\n').map((l: string) => `     ${l}`).join('\n')}${C.reset}`);

  success('Scenario 2 complete — clear input fast-tracked to agent!');
}

// ═══════════════════════════════════════════════════════════════════════
//  SCENARIO 3 — Skip clarification (user says "skip")
// ═══════════════════════════════════════════════════════════════════════
async function scenario3() {
  banner('SCENARIO 3: Ambiguous Input → User Skips → Best-Effort Agent');
  const engine = new MetaLoopEngine();
  const sessionId = `realtime-skip-${Date.now()}`;
  const userInput = 'Help me with my project';

  step('📥', 'USER INPUT');
  info('Text', `"${userInput}"`);
  separator();

  let t = Date.now();
  step('🔍', 'AMBIGUITY DETECTION');
  const result1 = await engine.startSession(sessionId, userInput);
  info('Ambiguity Score', `${result1.state.currentAmbiguityScore}/100`);
  info('Needs Clarification', result1.needsClarification ? 'YES' : 'NO');
  info('Time', elapsed(t));
  separator();

  step('💬', 'ASSISTANT asks for clarification');
  console.log(`${C.blue}${result1.response.split('\n').map((l: string) => `     ${l}`).join('\n')}${C.reset}`);
  separator();

  // User skips
  step('📥', 'USER RESPONSE');
  info('Text', '"skip"');
  separator();

  t = Date.now();
  step('⏭️', 'SKIP DETECTED — proceeding with best-effort');
  const result2 = await engine.continueSession(sessionId, 'skip');
  info('New Ambiguity Score', `${result2.state.currentAmbiguityScore}/100`);
  info('Status', result2.state.status);
  info('Time', elapsed(t));
  separator();

  if (result2.state.currentGoalEcho) {
    step('🎯', 'GOAL ECHO (best-effort)');
    console.log(`${C.magenta}${result2.state.currentGoalEcho.formattedDisplay.split('\n').map((l: string) => `     ${l}`).join('\n')}${C.reset}`);
    separator();
  }

  t = Date.now();
  step('🤖', 'AGENT GENERATION (best-effort)');
  const generator = new AgentGenerator();
  const snapshot = result2.state.intentSnapshots[result2.state.intentSnapshots.length - 1];
  const agent = await generator.generateAgent(
    snapshot.extractedIntent,
    result2.state.conversationHistory.map(m => m.content)
  );
  printAgent(agent, t);

  success('Scenario 3 complete — best-effort agent generated despite skip!');
}

// ─── Print agent spec ────────────────────────────────────────────────
function printAgent(agent: AgentSpecification, startTime: number) {
  info('Agent ID', agent.agentId);
  info('Name', `${C.bold}${agent.name}${C.reset}`);
  info('Purpose', agent.purpose);
  info('Complexity', agent.estimatedComplexity);
  info('Architecture', agent.suggestedArchitecture);
  info('Capabilities', '');
  agent.capabilities.forEach(c => console.log(`${C.green}       • ${c}${C.reset}`));
  info('Scope (included)', agent.scope.included.join(', '));
  info('Scope (excluded)', agent.scope.excluded.join(', '));
  info('Constraints', agent.constraints.join(', '));
  info('Success Criteria', agent.successCriteria.join(', '));
  info('System Prompt', agent.systemPrompt.slice(0, 100) + '…');
  info('Generation Time', elapsed(startTime));
  separator();
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${C.bgBlue}${C.white}${C.bold}  🤖 MetaIntent — Real-Time Self-Evolving Agent Test  ${C.reset}`);
  console.log(`${C.dim}  ${new Date().toISOString()}${C.reset}\n`);

  installMock();

  const t0 = Date.now();

  await scenario1();
  await scenario2();
  await scenario3();

  console.log(`\n${C.bgGreen}${C.white}${C.bold}  ✅ ALL 3 SCENARIOS COMPLETED in ${Date.now() - t0}ms  ${C.reset}\n`);
}

main().catch(err => {
  console.error(`${C.red}${C.bold}FATAL:${C.reset}`, err);
  process.exit(1);
});
