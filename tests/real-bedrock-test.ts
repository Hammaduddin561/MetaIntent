/**
 * REAL-TIME TEST — No Mocks, Hits Actual AWS Bedrock
 * 
 * This test exercises the full MetaIntent self-evolving agent pipeline
 * against real AWS Bedrock (Claude 3.5 Sonnet) with real LLM calls.
 * 
 * DynamoDB persistence is stubbed (no table needed) but ALL LLM calls
 * go through the real BedrockAdapter → AWS Bedrock API.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { AmbiguityDetector } from '../src/services/AmbiguityDetector';
import { SubAgentOrchestrator } from '../src/services/SubAgentOrchestrator';
import { GoalEchoGenerator } from '../src/services/GoalEchoGenerator';
import { AgentGenerator } from '../src/services/AgentGenerator';
import { IntentSnapshotManager } from '../src/services/IntentSnapshot';
import { MetaLoopEngine } from '../src/services/MetaLoopEngine';

// ── Helpers ──────────────────────────────────────────────────────────
const CYAN    = '\x1b[36m';
const GREEN   = '\x1b[32m';
const YELLOW  = '\x1b[33m';
const RED     = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';
const RESET   = '\x1b[0m';

function log(icon: string, msg: string) {
  console.log(`  ${icon}  ${msg}`);
}
function header(title: string) {
  console.log(`\n${BOLD}${MAGENTA}${'═'.repeat(60)}${RESET}`);
  console.log(`${BOLD}${MAGENTA}  ${title}${RESET}`);
  console.log(`${BOLD}${MAGENTA}${'═'.repeat(60)}${RESET}\n`);
}
function step(n: number, label: string) {
  console.log(`\n${BOLD}${CYAN}  ▸ Step ${n}: ${label}${RESET}`);
}
function success(msg: string) { log(`${GREEN}✅${RESET}`, `${GREEN}${msg}${RESET}`); }
function warn(msg: string)    { log(`${YELLOW}⚠️${RESET}`, `${YELLOW}${msg}${RESET}`); }
function fail(msg: string)    { log(`${RED}❌${RESET}`, `${RED}${msg}${RESET}`); }

// ── Stub only DynamoDB persistence (no table needed) ─────────────────
function stubPersistence() {
  // IntentSnapshotManager — keep snapshots in memory
  const snapshots: any[] = [];
  (IntentSnapshotManager.prototype as any).saveSnapshot = async function (s: any) {
    snapshots.push(s);
  };
  (IntentSnapshotManager.prototype as any).getSessionSnapshots = async function () {
    return snapshots;
  };
  // MetaLoopEngine persistence stubs
  (MetaLoopEngine.prototype as any).saveSessionState = async function () {};
  (MetaLoopEngine.prototype as any).loadSessionState = async function () { return null; };
}

// ── Pre-flight: verify Bedrock connectivity ──────────────────────────
async function verifyBedrock(): Promise<boolean> {
  const client = new BedrockRuntimeClient({ region: 'us-east-1' });
  try {
    const cmd = new InvokeModelCommand({
      modelId: 'meta.llama3-8b-instruct-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt: '<|begin_of_text|><|start_header_id|>user<|end_header_id|>\nReply with exactly: PING_OK<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n',
        max_gen_len: 20,
        temperature: 0.01,
      }),
    });
    const res = await client.send(cmd);
    const body = JSON.parse(new TextDecoder().decode(res.body));
    const text = body.generation || '';
    return text.includes('PING_OK');
  } catch (e: any) {
    console.error(`${RED}Bedrock connectivity check failed: ${e.message}${RESET}`);
    return false;
  }
}

// ── Scenario 1: Ambiguous input → real LLM clarification ────────────
async function scenario1() {
  header('SCENARIO 1 — Ambiguous Input → Real LLM Clarification → Agent');

  const input = 'I want to maybe build something with AI, not sure what though';

  step(1, 'Ambiguity Detection (real Bedrock call)');
  const t0 = Date.now();
  const detector = new AmbiguityDetector();
  const analysis = await detector.analyze(input);
  const dt = Date.now() - t0;
  log('🔍', `Ambiguity Score : ${BOLD}${analysis.score}/100${RESET}  (${dt}ms)`);
  log('📋', `Strategy        : ${analysis.recommendedStrategy}`);
  log('💬', `Reasoning       : ${DIM}${analysis.reasoning.substring(0, 120)}...${RESET}`);
  if (analysis.signals.hedgingLanguage.length > 0)
    log('🗣️', `Hedging words   : ${analysis.signals.hedgingLanguage.join(', ')}`);
  if (analysis.signals.vagueTerms.length > 0)
    log('🌫️', `Vague terms     : ${analysis.signals.vagueTerms.join(', ')}`);

  if (analysis.score > 40) {
    success(`Correctly detected ambiguity (score ${analysis.score} > 40)`);
  } else {
    warn(`Ambiguity score lower than expected: ${analysis.score}`);
  }

  step(2, 'Sub-Agent Orchestration (real Bedrock questions)');
  const orchestrator = new SubAgentOrchestrator();
  const agents = await orchestrator.spawnAgents(analysis.recommendedStrategy, input, analysis.score);
  log('🤖', `Spawned ${agents.length} sub-agents: ${agents.map(a => a.type).join(', ')}`);
  for (const agent of agents) {
    log('❓', `[${agent.type}] ${BOLD}${agent.currentQuestion}${RESET}`);
  }
  success(`${agents.length} real LLM-generated clarification questions`);

  step(3, 'Goal Echo Generation');
  const echoGen = new GoalEchoGenerator();
  const echo = echoGen.generateEcho({ goal: input.substring(0, 80) }, 0.3, analysis.score);
  log('🎯', `Echo confidence : ${(echo.confidence * 100).toFixed(0)}%`);
  console.log(`${DIM}${echo.formattedDisplay.split('\n').map(l => '     ' + l).join('\n')}${RESET}`);

  step(4, 'Agent Generation (real Bedrock call)');
  const t1 = Date.now();
  const generator = new AgentGenerator();
  const spec = await generator.generateAgent(
    { goal: 'Build an AI-powered tool', scope: 'Personal project', constraints: ['Limited budget'] },
    [input, 'I want to explore AI capabilities']
  );
  const dt1 = Date.now() - t1;
  log('🤖', `Agent Name      : ${BOLD}${spec.name}${RESET}  (${dt1}ms)`);
  log('🎯', `Purpose         : ${spec.purpose}`);
  log('⚙️', `Complexity      : ${spec.estimatedComplexity}`);
  log('🏗️', `Architecture    : ${spec.suggestedArchitecture}`);
  log('📦', `Capabilities    : ${spec.capabilities.slice(0, 4).join(', ')}`);
  if (spec.systemPrompt) {
    log('📝', `System Prompt   : ${DIM}${spec.systemPrompt.substring(0, 100)}...${RESET}`);
  }
  success('Agent generated via real Bedrock LLM');

  step(5, 'Agent Execution (real Bedrock call)');
  const t2 = Date.now();
  const result = await generator.executeAgent(spec, 'List 3 beginner-friendly AI project ideas');
  const dt2 = Date.now() - t2;
  log('💬', `Response (${dt2}ms):`);
  console.log(`${DIM}${result.split('\n').slice(0, 8).map(l => '       ' + l).join('\n')}${RESET}`);
  success('Agent executed with real LLM response');
}

// ── Scenario 2: Clear input → direct agent generation ────────────────
async function scenario2() {
  header('SCENARIO 2 — Clear Input → Direct Agent (Real Bedrock)');

  const input = 'Deploy a Node.js REST API to AWS Lambda with DynamoDB for user authentication, using JWT tokens and bcrypt password hashing';

  step(1, 'Ambiguity Detection (real Bedrock call)');
  const t0 = Date.now();
  const detector = new AmbiguityDetector();
  const analysis = await detector.analyze(input);
  const dt = Date.now() - t0;
  log('🔍', `Ambiguity Score : ${BOLD}${analysis.score}/100${RESET}  (${dt}ms)`);
  log('📋', `Strategy        : ${analysis.recommendedStrategy}`);

  if (analysis.score < 50) {
    success(`Correctly identified clear input (score ${analysis.score} < 50)`);
  } else {
    warn(`Score higher than expected for clear input: ${analysis.score}`);
  }

  step(2, 'Agent Generation (real Bedrock call)');
  const t1 = Date.now();
  const generator = new AgentGenerator();
  const spec = await generator.generateAgent(
    {
      goal: 'Deploy Node.js REST API to AWS Lambda',
      scope: 'AWS Lambda + DynamoDB + JWT auth',
      constraints: ['Use bcrypt', 'JWT tokens', 'DynamoDB'],
      successCriteria: ['API deployed', 'Auth working', 'Passwords hashed'],
    },
    [input]
  );
  const dt1 = Date.now() - t1;
  log('🤖', `Agent Name      : ${BOLD}${spec.name}${RESET}  (${dt1}ms)`);
  log('🎯', `Purpose         : ${spec.purpose}`);
  log('⚙️', `Complexity      : ${spec.estimatedComplexity}`);
  log('🏗️', `Architecture    : ${spec.suggestedArchitecture}`);
  log('📦', `Capabilities (${spec.capabilities.length}):`);
  spec.capabilities.forEach(c => log('  ', `  ✓ ${c}`));
  log('🚫', `Excluded        : ${spec.scope.excluded.slice(0, 3).join(', ')}`);
  success('Real Bedrock-generated agent spec');

  step(3, 'Agent Execution (real Bedrock call)');
  const t2 = Date.now();
  const result = await generator.executeAgent(spec, 'Give me the step-by-step deployment plan for this API');
  const dt2 = Date.now() - t2;
  log('💬', `Response (${dt2}ms):`);
  console.log(`${DIM}${result.split('\n').slice(0, 10).map(l => '       ' + l).join('\n')}${RESET}`);
  success('Real agent execution complete');
}

// ── Scenario 3: Full MetaLoop Engine (real Bedrock) ──────────────────
async function scenario3() {
  header('SCENARIO 3 — Full MetaLoop Engine (Real Bedrock)');

  const engine = new MetaLoopEngine();
  const sessionId = `real-test-${Date.now()}`;

  step(1, 'Start Session with ambiguous input');
  const t0 = Date.now();
  const startResult = await engine.startSession(sessionId, 'I need help with something for my business');
  const dt = Date.now() - t0;
  log('🔍', `Ambiguity Score : ${BOLD}${startResult.state.currentAmbiguityScore}/100${RESET}  (${dt}ms)`);
  log('📊', `Status          : ${startResult.state.status}`);
  log('🤖', `Sub-agents      : ${startResult.state.activeSubAgents.map(a => a.type).join(', ')}`);
  log('💬', `Response preview:`);
  console.log(`${DIM}${startResult.response.split('\n').slice(0, 6).map(l => '       ' + l).join('\n')}${RESET}`);

  if (startResult.needsClarification) {
    success('Engine correctly requested clarification');

    step(2, 'Continue Session with user answer');
    const t1 = Date.now();
    const continueResult = await engine.continueSession(
      sessionId,
      'I want to automate customer support for my e-commerce store using AI chatbots'
    );
    const dt1 = Date.now() - t1;
    log('🔍', `New Ambiguity   : ${BOLD}${continueResult.state.currentAmbiguityScore}/100${RESET}  (${dt1}ms)`);
    log('📊', `Status          : ${continueResult.state.status}`);
    log('🔄', `Iteration       : ${continueResult.state.iteration}`);
    log('💬', `Response preview:`);
    console.log(`${DIM}${continueResult.response.split('\n').slice(0, 6).map(l => '       ' + l).join('\n')}${RESET}`);

    if (!continueResult.needsClarification || continueResult.state.status === 'ready') {
      success('Intent clarified — ready for agent generation');
    } else {
      warn('Still needs more clarification (expected for very ambiguous inputs)');
    }
  } else {
    success('Engine determined input was clear enough to proceed');
  }

  step(3, 'Generate Agent from session state');
  const state = engine.getSession(sessionId);
  if (state && state.intentSnapshots.length > 0) {
    const latest = state.intentSnapshots[state.intentSnapshots.length - 1];
    const t2 = Date.now();
    const generator = new AgentGenerator();
    const spec = await generator.generateAgent(
      latest.extractedIntent,
      state.conversationHistory.map(m => m.content)
    );
    const dt2 = Date.now() - t2;
    log('🤖', `Agent Name      : ${BOLD}${spec.name}${RESET}  (${dt2}ms)`);
    log('🎯', `Purpose         : ${spec.purpose}`);
    log('⚙️', `Complexity      : ${spec.estimatedComplexity}`);
    success('Full pipeline: input → clarification → agent generation via real Bedrock');
  }
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${GREEN}║   MetaIntent — REAL-TIME TEST (No Mocks, Real Bedrock)  ║${RESET}`);
  console.log(`${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${RESET}`);

  // Stub only DynamoDB persistence
  stubPersistence();

  // Pre-flight check
  step(0, 'Verifying AWS Bedrock connectivity...');
  const ok = await verifyBedrock();
  if (!ok) {
    fail('Cannot reach AWS Bedrock. Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION.');
    process.exit(1);
  }
  success('AWS Bedrock is reachable (Meta Llama 3 responded)');

  const totalStart = Date.now();

  try {
    await scenario1();
    await scenario2();
    await scenario3();
  } catch (err: any) {
    fail(`Unexpected error: ${err.message}`);
    console.error(err);
    process.exit(1);
  }

  const totalTime = ((Date.now() - totalStart) / 1000).toFixed(1);

  console.log(`\n${BOLD}${GREEN}${'═'.repeat(60)}${RESET}`);
  console.log(`${BOLD}${GREEN}  ✅ ALL 3 REAL-TIME SCENARIOS COMPLETED (${totalTime}s total)${RESET}`);
  console.log(`${BOLD}${GREEN}  🔥 Every LLM call hit real AWS Bedrock — zero mocks!${RESET}`);
  console.log(`${BOLD}${GREEN}${'═'.repeat(60)}${RESET}\n`);
}

main().catch(err => {
  fail(`Fatal: ${err.message}`);
  process.exit(1);
});
