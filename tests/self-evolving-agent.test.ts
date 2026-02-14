/**
 * Comprehensive tests for the MetaIntent Self-Evolving AI Agent System.
 * 
 * Tests the full pipeline:
 *   Ambiguity Detection → Sub-Agent Orchestration → Intent Snapshots →
 *   Goal Echo → Agent Generation → Agent Execution
 */

// Mock AWS SDK before any imports
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ Items: [] }),
  })),
  PutItemCommand: jest.fn(),
  QueryCommand: jest.fn(),
}));

jest.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: jest.fn((obj: any) => obj),
  unmarshall: jest.fn((obj: any) => obj),
}));

// Mock LLMAdapterFactory to avoid real API calls
jest.mock('../src/adapters/LLMAdapterFactory', () => ({
  LLMAdapterFactory: {
    getPrimaryAdapter: jest.fn(() => ({
      invoke: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          score: 75,
          signals: {
            hedgingLanguage: ['maybe'],
            contradictions: [],
            emotionalMarkers: [],
            vagueTerms: ['something'],
            multipleTopics: [],
          },
          recommendedStrategy: 'scope',
          reasoning: 'Input is vague',
        }),
        usage: { inputTokens: 10, outputTokens: 20 },
      }),
      invokeWithRetry: jest.fn(),
      estimateCost: jest.fn().mockReturnValue(0.001),
    })),
    getFallbackAdapter: jest.fn(),
    reset: jest.fn(),
  },
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substring(7)),
}));

import { AmbiguityDetector } from '../src/services/AmbiguityDetector';
import { SubAgentOrchestrator } from '../src/services/SubAgentOrchestrator';
import { GoalEchoGenerator } from '../src/services/GoalEchoGenerator';
import { AgentGenerator } from '../src/services/AgentGenerator';
import { MetaLoopEngine } from '../src/services/MetaLoopEngine';
import { LLMAdapterFactory } from '../src/adapters/LLMAdapterFactory';

describe('Self-Evolving AI Agent System', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── AmbiguityDetector ───────────────────────────────────────────

  describe('AmbiguityDetector', () => {
    let detector: AmbiguityDetector;

    beforeEach(() => {
      detector = new AmbiguityDetector();
    });

    it('should detect high ambiguity in vague input', async () => {
      // Force fallback by making LLM throw
      (LLMAdapterFactory.getPrimaryAdapter as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockRejectedValue(new Error('LLM unavailable')),
      });

      const result = await detector.analyze('help me build something');
      expect(result.score).toBeGreaterThan(50);
      expect(result.signals.vagueTerms).toContain('something');
    });

    it('should detect low ambiguity in specific input', async () => {
      (LLMAdapterFactory.getPrimaryAdapter as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockRejectedValue(new Error('LLM unavailable')),
      });

      const result = await detector.analyze(
        'Build a REST API with Node.js and Express for managing 500 user accounts with JWT authentication'
      );
      expect(result.score).toBeLessThan(50);
    });

    it('should detect hedging language', async () => {
      (LLMAdapterFactory.getPrimaryAdapter as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockRejectedValue(new Error('LLM unavailable')),
      });

      const result = await detector.analyze('maybe I sort of want to build something');
      expect(result.signals.hedgingLanguage.length).toBeGreaterThan(0);
      expect(result.signals.hedgingLanguage).toContain('maybe');
      expect(result.signals.hedgingLanguage).toContain('sort of');
    });

    it('should detect emotional markers', async () => {
      (LLMAdapterFactory.getPrimaryAdapter as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockRejectedValue(new Error('LLM unavailable')),
      });

      const result = await detector.analyze('I am frustrated and confused about this');
      expect(result.signals.emotionalMarkers.length).toBeGreaterThan(0);
      const types = result.signals.emotionalMarkers.map(e => e.type);
      expect(types).toContain('frustration');
      expect(types).toContain('confusion');
    });

    it('should use LLM when available and parse response', async () => {
      const result = await detector.analyze('I want to maybe build something');
      // LLM mock returns score 75
      expect(result.score).toBe(75);
      expect(result.recommendedStrategy).toBe('scope');
    });

    it('should handle conversation history context', async () => {
      const result = await detector.analyze('yes, that one', ['What do you want to build?']);
      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  // ─── SubAgentOrchestrator ────────────────────────────────────────

  describe('SubAgentOrchestrator', () => {
    let orchestrator: SubAgentOrchestrator;

    beforeEach(() => {
      orchestrator = new SubAgentOrchestrator();
    });

    it('should spawn multiple agents for high ambiguity', async () => {
      const agents = await orchestrator.spawnAgents('multi', 'build something', 80);
      expect(agents.length).toBeGreaterThanOrEqual(2);
      const types = agents.map(a => a.type);
      expect(types).toContain('scope');
      expect(types).toContain('outcomes');
    });

    it('should spawn single agent for targeted strategy', async () => {
      const agents = await orchestrator.spawnAgents('scope', 'build an app', 50);
      expect(agents.length).toBe(1);
      expect(agents[0].type).toBe('scope');
    });

    it('should generate initial questions for spawned agents', async () => {
      const agents = await orchestrator.spawnAgents('scope', 'build something', 50);
      expect(agents[0].currentQuestion).toBeDefined();
      expect(agents[0].currentQuestion!.length).toBeGreaterThan(0);
    });

    it('should process user responses and extract findings', async () => {
      const agents = await orchestrator.spawnAgents('scope', 'build an app', 50);
      const agent = agents[0];

      await orchestrator.processResponse(agent.agentId, 'I want a mobile app for tracking fitness goals');
      
      expect(agent.sandbox.findings.length).toBeGreaterThan(0);
      expect(agent.sandbox.confidence).toBeGreaterThan(0);
      expect(agent.questionsAsked).toBe(1);
    });

    it('should mark agent complete when user says "skip"', async () => {
      const agents = await orchestrator.spawnAgents('scope', 'build something', 50);
      const agent = agents[0];

      await orchestrator.processResponse(agent.agentId, 'skip');
      expect(agent.status).toBe('completed');
    });

    it('should mark agent complete after max questions', async () => {
      const agents = await orchestrator.spawnAgents('scope', 'build something', 50);
      const agent = agents[0];

      await orchestrator.processResponse(agent.agentId, 'A fitness tracking mobile app');
      await orchestrator.processResponse(agent.agentId, 'For personal use, iOS and Android');
      
      expect(agent.status).toBe('completed');
    });

    it('should synthesize findings from multiple agents', async () => {
      const agents = await orchestrator.spawnAgents('multi', 'build something', 80);
      
      // Process responses for each agent
      for (const agent of agents) {
        await orchestrator.processResponse(agent.agentId, 'A fitness app with social features');
        if (agent.status === 'active') {
          await orchestrator.processResponse(agent.agentId, 'Budget is $5000, 3 month timeline');
        }
      }

      // Mock LLM to return synthesis JSON
      (LLMAdapterFactory.getPrimaryAdapter as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            summary: 'User wants a fitness app with social features, $5000 budget, 3 months.',
            extractedIntent: {
              goal: 'Build a fitness app with social features',
              scope: 'Mobile app',
              constraints: ['$5000 budget', '3 month timeline'],
              successCriteria: ['Users can track fitness and connect socially'],
            },
          }),
          usage: { inputTokens: 50, outputTokens: 100 },
        }),
      });

      const synthesis = await orchestrator.synthesizeFindings(agents);
      expect(synthesis.summary).toBeDefined();
      expect(synthesis.extractedIntent).toBeDefined();
      expect(synthesis.confidence).toBeGreaterThan(0);
    });
  });

  // ─── GoalEchoGenerator ──────────────────────────────────────────

  describe('GoalEchoGenerator', () => {
    let echoGen: GoalEchoGenerator;

    beforeEach(() => {
      echoGen = new GoalEchoGenerator();
    });

    it('should generate echo with high confidence', () => {
      const echo = echoGen.generateEcho(
        { goal: 'Build a fitness app', scope: 'Mobile iOS/Android' },
        0.85,
        20
      );
      expect(echo.needsConfirmation).toBe(true);
      expect(echo.confidence).toBe(0.85);
      expect(echo.formattedDisplay).toContain('Build a fitness app');
      expect(echo.formattedDisplay).toContain('proceed');
    });

    it('should generate echo with low confidence', () => {
      const echo = echoGen.generateEcho(
        { goal: 'something' },
        0.3,
        70
      );
      expect(echo.needsConfirmation).toBe(false);
      expect(echo.formattedDisplay).toContain('clarify');
    });

    it('should generate progress update showing improvement', () => {
      const update = echoGen.generateProgressUpdate(80, 40, 2);
      expect(update).toContain('Progress Update');
      expect(update).toContain('40');
    });

    it('should generate progress update for no improvement', () => {
      const update = echoGen.generateProgressUpdate(50, 55, 3);
      expect(update).toContain('different angle');
    });

    it('should generate clarification prompts with correct icons', () => {
      const scopePrompt = echoGen.generateClarificationPrompt('scope', 'What is the scale?');
      expect(scopePrompt).toContain('🎯');
      expect(scopePrompt).toContain('Scope');

      const constraintsPrompt = echoGen.generateClarificationPrompt('constraints', 'Any limits?');
      expect(constraintsPrompt).toContain('⚙️');
    });

    it('should include emotional context in echo when present', () => {
      const echo = echoGen.generateEcho(
        { goal: 'Build app', emotionalContext: 'User is frustrated' },
        0.5,
        50
      );
      expect(echo.formattedDisplay).toContain('frustrated');
    });
  });

  // ─── AgentGenerator ──────────────────────────────────────────────

  describe('AgentGenerator', () => {
    let generator: AgentGenerator;

    beforeEach(() => {
      generator = new AgentGenerator();
    });

    it('should generate agent spec from extracted intent', async () => {
      // Mock LLM to return a valid agent spec
      (LLMAdapterFactory.getPrimaryAdapter as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            name: 'Fitness Tracker Agent',
            purpose: 'Help users track fitness goals',
            capabilities: ['Track workouts', 'Set goals'],
            scope: { included: ['Fitness tracking'], excluded: ['Medical advice'] },
            constraints: ['Mobile-first'],
            successCriteria: ['Users log workouts daily'],
            estimatedComplexity: 'moderate',
            suggestedArchitecture: 'single',
            systemPrompt: 'You are a fitness tracking assistant.',
          }),
          usage: { inputTokens: 100, outputTokens: 200 },
        }),
      });

      const spec = await generator.generateAgent(
        { goal: 'Build a fitness tracker', scope: 'Mobile app' },
        ['I want a fitness app', 'For tracking workouts']
      );

      expect(spec.name).toBe('Fitness Tracker Agent');
      expect(spec.purpose).toContain('fitness');
      expect(spec.capabilities.length).toBeGreaterThan(0);
      expect(spec.agentId).toBeDefined();
    });

    it('should create fallback agent when LLM fails', async () => {
      (LLMAdapterFactory.getPrimaryAdapter as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockRejectedValue(new Error('LLM unavailable')),
      });

      const spec = await generator.generateAgent(
        { goal: 'Build a fitness tracker' },
        []
      );

      expect(spec.name).toBe('Custom Task Agent');
      expect(spec.purpose).toContain('fitness tracker');
      expect(spec.capabilities.length).toBeGreaterThan(0);
    });

    it('should format specification for display', async () => {
      (LLMAdapterFactory.getPrimaryAdapter as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockRejectedValue(new Error('LLM unavailable')),
      });

      const spec = await generator.generateAgent(
        { goal: 'Test agent', constraints: ['Fast', 'Cheap'] },
        []
      );

      const display = generator.formatSpecificationForDisplay(spec);
      expect(display).toContain('Agent Specification');
      expect(display).toContain('Capabilities');
      expect(display).toContain('Ready to deploy');
    });

    it('should execute agent with system prompt', async () => {
      (LLMAdapterFactory.getPrimaryAdapter as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockResolvedValue({
          content: 'Here is your workout plan for today...',
          usage: { inputTokens: 50, outputTokens: 100 },
        }),
      });

      const spec = await generator.generateAgent({ goal: 'Fitness' }, []);
      
      (LLMAdapterFactory.getPrimaryAdapter as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockResolvedValue({
          content: 'Workout plan generated successfully.',
          usage: { inputTokens: 50, outputTokens: 100 },
        }),
      });

      const result = await generator.executeAgent(spec, 'Create a workout plan');
      expect(result).toContain('Workout plan');
    });
  });

  // ─── MetaLoopEngine (Full Pipeline) ─────────────────────────────

  describe('MetaLoopEngine - Full Self-Evolving Pipeline', () => {
    let engine: MetaLoopEngine;

    beforeEach(() => {
      engine = new MetaLoopEngine();
    });

    it('should start session and detect ambiguity', async () => {
      const result = await engine.startSession('session-1', 'I want to build something');
      
      expect(result.state.sessionId).toBe('session-1');
      expect(result.state.iteration).toBe(0);
      expect(result.state.currentAmbiguityScore).toBeGreaterThanOrEqual(0);
      expect(result.response.length).toBeGreaterThan(0);
      expect(result.state.intentSnapshots.length).toBe(1);
    });

    it('should request clarification for ambiguous input', async () => {
      const result = await engine.startSession('session-2', 'I want to build something');
      
      // With LLM mock returning score 75, should need clarification
      expect(result.needsClarification).toBe(true);
      expect(result.state.status).toBe('clarifying');
      expect(result.state.activeSubAgents.length).toBeGreaterThan(0);
    });

    it('should proceed directly for clear input', async () => {
      // Mock LLM to return low ambiguity
      (LLMAdapterFactory.getPrimaryAdapter as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            score: 20,
            signals: { hedgingLanguage: [], contradictions: [], emotionalMarkers: [], vagueTerms: [], multipleTopics: [] },
            recommendedStrategy: 'scope',
            reasoning: 'Clear input',
          }),
          usage: { inputTokens: 10, outputTokens: 20 },
        }),
      });

      const result = await engine.startSession('session-3', 'Build a REST API with Express.js for user management with JWT auth');
      
      expect(result.needsClarification).toBe(false);
      expect(result.state.status).toBe('ready');
      expect(result.state.currentGoalEcho).toBeDefined();
    });

    it('should continue session with clarification responses', async () => {
      // Start with ambiguous input
      await engine.startSession('session-4', 'help me with something');

      // Continue with clarification
      const result = await engine.continueSession('session-4', 'I want to build a mobile fitness app');
      
      expect(result.state.iteration).toBe(1);
      expect(result.response.length).toBeGreaterThan(0);
    });

    it('should handle skip responses gracefully', async () => {
      await engine.startSession('session-5', 'build something');

      const result = await engine.continueSession('session-5', 'skip');
      
      expect(result.state.status).toBe('ready');
      expect(result.needsClarification).toBe(false);
      expect(result.response).toContain('Proceeding');
    });

    it('should track intent evolution across iterations', async () => {
      await engine.startSession('session-6', 'build something');
      await engine.continueSession('session-6', 'A mobile app for fitness tracking');

      const state = engine.getSession('session-6');
      expect(state).toBeDefined();
      expect(state!.intentSnapshots.length).toBeGreaterThanOrEqual(1);
    });

    it('should create new session when continuing unknown session', async () => {
      const result = await engine.continueSession('unknown-session', 'Build a fitness app');
      
      // Should create a new session instead of throwing
      expect(result.state.sessionId).toBe('unknown-session');
      expect(result.state.iteration).toBe(0);
    });

    it('should retrieve intent map for session', async () => {
      await engine.startSession('session-7', 'build something');
      
      const intentMap = await engine.getIntentMap('session-7');
      expect(intentMap).toBeDefined();
    });
  });

  // ─── Integration: End-to-End Self-Evolving Flow ──────────────────

  describe('End-to-End Self-Evolving Flow', () => {
    it('should complete full cycle: ambiguous input → clarification → agent generation', async () => {
      const engine = new MetaLoopEngine();
      const agentGen = new AgentGenerator();

      // Step 1: Start with vague input
      const start = await engine.startSession('e2e-session', 'I want to build something cool');
      expect(start.needsClarification).toBe(true);

      // Step 2: Provide clarification
      const clarify = await engine.continueSession('e2e-session', 'A fitness tracking mobile app with social features');
      expect(clarify.state.iteration).toBe(1);

      // Step 3: Skip remaining clarification
      const skip = await engine.continueSession('e2e-session', 'skip');
      expect(skip.state.status).toBe('ready');

      // Step 4: Generate agent from clarified intent
      const state = engine.getSession('e2e-session');
      expect(state).toBeDefined();
      
      const latestSnapshot = state!.intentSnapshots[state!.intentSnapshots.length - 1];
      
      // Mock for agent generation
      (LLMAdapterFactory.getPrimaryAdapter as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockRejectedValue(new Error('Use fallback')),
      });

      const agentSpec = await agentGen.generateAgent(
        latestSnapshot.extractedIntent,
        state!.conversationHistory.map(m => m.content)
      );

      expect(agentSpec.agentId).toBeDefined();
      expect(agentSpec.systemPrompt.length).toBeGreaterThan(0);
      expect(agentSpec.capabilities.length).toBeGreaterThan(0);

      // Step 5: Verify the agent spec can be displayed
      const display = agentGen.formatSpecificationForDisplay(agentSpec);
      expect(display).toContain('Agent Specification');
      expect(display).toContain('Ready to deploy');
    });
  });
});
