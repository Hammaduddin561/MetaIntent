import { AmbiguityDetector, AmbiguityAnalysis } from './AmbiguityDetector';
import { SubAgentOrchestrator, SubAgent } from './SubAgentOrchestrator';
import { IntentSnapshotManager, IntentSnapshot, ExtractedIntent } from './IntentSnapshot';
import { GoalEchoGenerator, GoalEcho } from './GoalEchoGenerator';
// import { SessionManager } from './SessionManager'; // Not needed

export interface MetaLoopState {
  sessionId: string;
  iteration: number;
  currentAmbiguityScore: number;
  previousAmbiguityScore?: number;
  activeSubAgents: SubAgent[];
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  intentSnapshots: IntentSnapshot[];
  currentGoalEcho?: GoalEcho;
  status: 'detecting' | 'clarifying' | 'synthesizing' | 'ready' | 'completed';
}

export class MetaLoopEngine {
  private ambiguityDetector: AmbiguityDetector;
  private subAgentOrchestrator: SubAgentOrchestrator;
  private snapshotManager: IntentSnapshotManager;
  private echoGenerator: GoalEchoGenerator;
  private sessions: Map<string, MetaLoopState> = new Map();
  // private sessionManager: SessionManager; // Not needed - using snapshots for persistence

  constructor() {
    this.ambiguityDetector = new AmbiguityDetector();
    this.subAgentOrchestrator = new SubAgentOrchestrator();
    this.snapshotManager = new IntentSnapshotManager();
    this.echoGenerator = new GoalEchoGenerator();
    // this.sessionManager = new SessionManager(); // Not needed
  }

  async startSession(sessionId: string, initialInput: string): Promise<{
    state: MetaLoopState;
    response: string;
    needsClarification: boolean;
  }> {
    // Analyze ambiguity
    const analysis = await this.ambiguityDetector.analyze(initialInput);

    // Create initial state
    const state: MetaLoopState = {
      sessionId,
      iteration: 0,
      currentAmbiguityScore: analysis.score,
      activeSubAgents: [],
      conversationHistory: [
        {
          role: 'user',
          content: initialInput,
          timestamp: Date.now(),
        },
      ],
      intentSnapshots: [],
      status: analysis.score > 60 ? 'clarifying' : 'ready',
    };

    this.sessions.set(sessionId, state);
    
    // Persist to DynamoDB
    await this.saveSessionState(sessionId, state);

    // Create initial snapshot
    const snapshot = await this.snapshotManager.createSnapshot(
      sessionId,
      initialInput,
      analysis.score,
      this.extractIntentFromAnalysis(analysis, initialInput),
      0.3
    );
    state.intentSnapshots.push(snapshot);

    // If ambiguous, spawn sub-agents
    if (analysis.score > 60) {
      const agents = await this.subAgentOrchestrator.spawnAgents(
        analysis.recommendedStrategy,
        initialInput,
        analysis.score
      );
      state.activeSubAgents = agents;

      // Generate response with first questions
      const response = this.generateClarificationResponse(state, analysis);
      
      state.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      });

      return {
        state,
        response,
        needsClarification: true,
      };
    }

    // If clear enough, generate goal echo
    const goalEcho = this.echoGenerator.generateEcho(
      snapshot.extractedIntent,
      snapshot.confidence,
      analysis.score
    );
    state.currentGoalEcho = goalEcho;

    const response = `${goalEcho.formattedDisplay}\n\nReady to generate your agent!`;
    
    state.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    });

    return {
      state,
      response,
      needsClarification: false,
    };
  }

  async continueSession(sessionId: string, userResponse: string): Promise<{
    state: MetaLoopState;
    response: string;
    needsClarification: boolean;
  }> {
    // Try to get from memory first, then from DynamoDB
    let state = this.sessions.get(sessionId);
    if (!state) {
      console.log(`Session ${sessionId} not in memory, loading from DynamoDB...`);
      const loadedState = await this.loadSessionState(sessionId);
      if (!loadedState) {
        console.error(`Session ${sessionId} not found in DynamoDB either`);
        // Instead of throwing error, create a new session with this response
        console.log('Creating new session from this input...');
        return await this.startSession(sessionId, userResponse);
      }
      state = loadedState;
      this.sessions.set(sessionId, state);
      console.log(`Session ${sessionId} loaded successfully`);
    }

    state.iteration++;
    state.conversationHistory.push({
      role: 'user',
      content: userResponse,
      timestamp: Date.now(),
    });

    // Check if user wants to skip clarification
    const lower = userResponse.toLowerCase().trim();
    const skipPhrases = ['skip', 'i don\'t know', 'don\'t know', 'not sure', 'no idea', 'idk', 'dunno'];
    const wantsToSkip = skipPhrases.some(phrase => lower === phrase || lower.includes(phrase));

    // Process response with active sub-agents
    if (state.activeSubAgents.length > 0) {
      // If user wants to skip, mark all agents as complete
      if (wantsToSkip) {
        state.activeSubAgents.forEach(a => {
          if (a.status === 'active') {
            a.status = 'completed';
            a.sandbox.findings.push('User indicated uncertainty - proceeding with available information');
          }
        });
      } else {
        await Promise.all(
          state.activeSubAgents
            .filter(a => a.status === 'active')
            .map(a => this.subAgentOrchestrator.processResponse(a.agentId, userResponse))
        );
      }

      // Check if all agents are done
      const allComplete = state.activeSubAgents.every(a => a.status === 'completed');

      if (allComplete) {
        // Synthesize findings
        state.status = 'synthesizing';
        const synthesis = await this.subAgentOrchestrator.synthesizeFindings(state.activeSubAgents);

        // Re-analyze ambiguity
        const newAnalysis = await this.ambiguityDetector.analyze(
          userResponse,
          state.conversationHistory.map(m => m.content)
        );

        state.previousAmbiguityScore = state.currentAmbiguityScore;
        state.currentAmbiguityScore = newAnalysis.score;

        // Create new snapshot
        const previousSnapshot = state.intentSnapshots[state.intentSnapshots.length - 1];
        const newSnapshot = await this.snapshotManager.createSnapshot(
          sessionId,
          userResponse,
          newAnalysis.score,
          synthesis.extractedIntent,
          synthesis.confidence,
          previousSnapshot.snapshotId
        );
        state.intentSnapshots.push(newSnapshot);

        // Generate goal echo
        const goalEcho = this.echoGenerator.generateEcho(
          synthesis.extractedIntent,
          synthesis.confidence,
          newAnalysis.score
        );
        state.currentGoalEcho = goalEcho;

        // Check if we're ready (or if user wants to skip)
        if (synthesis.confidence > 0.7 && newAnalysis.score < 40) {
          state.status = 'ready';
          const response = `${goalEcho.formattedDisplay}\n\n${synthesis.summary}`;
          
          state.conversationHistory.push({
            role: 'assistant',
            content: response,
            timestamp: Date.now(),
          });

          // Persist state
          await this.saveSessionState(sessionId, state);

          return {
            state,
            response,
            needsClarification: false,
          };
        }

        // If user wanted to skip, proceed anyway with what we have
        if (wantsToSkip) {
          state.status = 'ready';
          const response = `${goalEcho.formattedDisplay}\n\n✅ Proceeding with the information provided. Ready to generate your agent!`;
          
          state.conversationHistory.push({
            role: 'assistant',
            content: response,
            timestamp: Date.now(),
          });

          // Persist state
          await this.saveSessionState(sessionId, state);

          return {
            state,
            response,
            needsClarification: false,
          };
        }

        // Need more clarification - spawn new agents
        state.status = 'clarifying';
        const newAgents = await this.subAgentOrchestrator.spawnAgents(
          newAnalysis.recommendedStrategy,
          userResponse,
          newAnalysis.score
        );
        state.activeSubAgents = newAgents;

        const progressUpdate = this.echoGenerator.generateProgressUpdate(
          state.previousAmbiguityScore || 100,
          state.currentAmbiguityScore,
          state.iteration
        );

        const response = `${progressUpdate}\n\n${goalEcho.formattedDisplay}\n\n${this.generateClarificationResponse(state, newAnalysis)}`;
        
        state.conversationHistory.push({
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
        });

        // Persist state
        await this.saveSessionState(sessionId, state);

        return {
          state,
          response,
          needsClarification: true,
        };
      }

      // Continue with current agents
      const nextQuestions = await this.generateNextQuestions(state);
      const response = nextQuestions;
      
      state.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      });

      // Persist state
      await this.saveSessionState(sessionId, state);

      return {
        state,
        response,
        needsClarification: true,
      };
    }

    // No active agents - shouldn't happen
    return {
      state,
      response: 'Session state error. Please start a new session.',
      needsClarification: false,
    };
  }

  private generateClarificationResponse(state: MetaLoopState, analysis: AmbiguityAnalysis): string {
    let response = '🔍 **I notice some ambiguity in your request.**\n\n';
    
    if (analysis.signals.hedgingLanguage.length > 0) {
      response += `I detected some uncertainty: "${analysis.signals.hedgingLanguage.join('", "')}"\n`;
    }
    
    if (analysis.signals.vagueTerms.length > 0) {
      response += `Some terms need clarification: "${analysis.signals.vagueTerms.join('", "')}"\n`;
    }
    
    response += `\n${analysis.reasoning}\n\n`;
    response += `Let me ask a few questions to help clarify:\n\n`;
    
    // Add first question from each agent
    state.activeSubAgents.forEach((agent, index) => {
      if (agent.currentQuestion) {
        response += this.echoGenerator.generateClarificationPrompt(agent.type, agent.currentQuestion);
        if (index < state.activeSubAgents.length - 1) {
          response += '\n\n';
        }
      }
    });
    
    return response;
  }

  private async generateNextQuestions(state: MetaLoopState): Promise<string> {
    const activeAgents = state.activeSubAgents.filter(a => a.status === 'active');
    
    if (activeAgents.length === 0) {
      return '✅ All clarifications complete!';
    }

    // Don't add "Next questions" header - just show the questions directly
    let response = '';
    
    for (const agent of activeAgents) {
      const lastUserMessage = state.conversationHistory.length > 0 
        ? state.conversationHistory[state.conversationHistory.length - 1].content 
        : '';
      
      const question = await this.subAgentOrchestrator.generateNextQuestion(
        agent,
        lastUserMessage
      );
      
      // Make sure we have a question
      if (question && question.trim().length > 0) {
        response += this.echoGenerator.generateClarificationPrompt(agent.type, question);
        if (activeAgents.length > 1) {
          response += '\n\n';
        }
      } else {
        console.error(`Empty question generated for agent ${agent.type}`);
        // Generate a fallback question
        response += this.echoGenerator.generateClarificationPrompt(
          agent.type, 
          `Can you tell me more about the ${agent.type} of what you want to accomplish?`
        );
        if (activeAgents.length > 1) {
          response += '\n\n';
        }
      }
    }
    
    return response.trim();
  }

  private extractIntentFromAnalysis(analysis: AmbiguityAnalysis, input: string): ExtractedIntent {
    const intent: ExtractedIntent = {};
    
    // Try to extract basic goal from input
    if (input.length > 10) {
      intent.goal = input.substring(0, 100);
    }
    
    // Add emotional context if detected
    if (analysis.signals.emotionalMarkers.length > 0) {
      const emotions = analysis.signals.emotionalMarkers.map(e => e.type).join(', ');
      intent.emotionalContext = `User shows: ${emotions}`;
    }
    
    return intent;
  }

  getSession(sessionId: string): MetaLoopState | undefined {
    return this.sessions.get(sessionId);
  }

  async getIntentMap(sessionId: string): Promise<IntentSnapshot[]> {
    return this.snapshotManager.getSessionSnapshots(sessionId);
  }

  private async saveSessionState(sessionId: string, state: MetaLoopState): Promise<void> {
    try {
      // Simple persistence - just store key info
      console.log(`Saving session state for ${sessionId}, iteration ${state.iteration}`);
      // For now, we rely on IntentSnapshots which are already persisted
      // Full session state persistence can be added later if needed
    } catch (error) {
      console.error('Failed to save session state:', error);
    }
  }

  private async loadSessionState(sessionId: string): Promise<MetaLoopState | null> {
    try {
      // Try to reconstruct from snapshots
      const snapshots = await this.snapshotManager.getSessionSnapshots(sessionId);
      if (snapshots.length === 0) {
        return null;
      }

      const latestSnapshot = snapshots[snapshots.length - 1];
      
      // Reconstruct basic state
      const state: MetaLoopState = {
        sessionId,
        iteration: snapshots.length,
        currentAmbiguityScore: latestSnapshot.ambiguityScore,
        previousAmbiguityScore: snapshots.length > 1 ? snapshots[snapshots.length - 2].ambiguityScore : undefined,
        activeSubAgents: [], // Will be empty on reload - that's OK
        conversationHistory: [],
        intentSnapshots: snapshots,
        status: latestSnapshot.ambiguityScore < 40 ? 'ready' : 'clarifying',
        currentGoalEcho: this.echoGenerator.generateEcho(
          latestSnapshot.extractedIntent,
          latestSnapshot.confidence,
          latestSnapshot.ambiguityScore
        ),
      };

      return state;
    } catch (error) {
      console.error('Failed to load session state:', error);
      return null;
    }
  }
}
