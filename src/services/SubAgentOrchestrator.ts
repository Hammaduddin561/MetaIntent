import { LLMAdapterFactory } from '../adapters/LLMAdapterFactory';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_LLM_CONFIG } from '../models/constants';

export type SubAgentType = 'scope' | 'constraints' | 'outcomes' | 'emotions';

export interface SubAgentSandbox {
  context: Record<string, any>;
  findings: string[];
  confidence: number;
  conversationHistory: Array<{
    question: string;
    answer: string;
    timestamp: number;
  }>;
}

export interface SubAgent {
  agentId: string;
  type: SubAgentType;
  status: 'active' | 'completed' | 'failed';
  sandbox: SubAgentSandbox;
  currentQuestion?: string;
  questionsAsked: number;
  maxQuestions: number;
}

export class SubAgentOrchestrator {
  private activeAgents: Map<string, SubAgent> = new Map();

  constructor() {}

  async spawnAgents(
    recommendedStrategy: string,
    userInput: string,
    ambiguityScore: number
  ): Promise<SubAgent[]> {
    const agents: SubAgent[] = [];

    // Determine which agents to spawn based on strategy
    const agentTypes = this.determineAgentTypes(recommendedStrategy, ambiguityScore);

    for (const type of agentTypes) {
      const agent = this.createAgent(type, userInput);
      agents.push(agent);
      this.activeAgents.set(agent.agentId, agent);
    }

    // Generate initial questions for each agent
    await Promise.all(agents.map(agent => this.generateNextQuestion(agent, userInput)));

    return agents;
  }

  private determineAgentTypes(strategy: string, ambiguityScore: number): SubAgentType[] {
    if (strategy === 'multi' || ambiguityScore > 70) {
      return ['scope', 'constraints', 'outcomes'];
    }

    switch (strategy) {
      case 'scope':
        return ['scope'];
      case 'constraints':
        return ['constraints'];
      case 'outcomes':
        return ['outcomes'];
      case 'emotions':
        return ['emotions', 'outcomes'];
      default:
        return ['scope', 'outcomes'];
    }
  }

  private createAgent(type: SubAgentType, initialInput: string): SubAgent {
    return {
      agentId: uuidv4(),
      type,
      status: 'active',
      sandbox: {
        context: { initialInput },
        findings: [],
        confidence: 0,
        conversationHistory: [],
      },
      questionsAsked: 0,
      maxQuestions: 2, // Reduced from 3 to 2 to avoid loops
    };
  }

  async generateNextQuestion(agent: SubAgent, userContext: string): Promise<string> {
    const prompt = this.buildQuestionPrompt(agent, userContext);

    try {
      console.log(`🤖 Using adapter for ${agent.type} question generation`);
      
      const adapter = LLMAdapterFactory.getPrimaryAdapter();
      const response = await adapter.invoke(prompt, {
        ...DEFAULT_LLM_CONFIG,
        maxTokens: 150,
        temperature: 0.7
      });

      agent.currentQuestion = response.content.trim();
      return agent.currentQuestion;
    } catch (error) {
      console.error(`⚠️ LLM failed for ${agent.type}, using fallback`);
    }

    // Fallback to smart questions
    const question = this.getSmartQuestion(agent, userContext);
    
    // Safety check
    if (!question || question.trim().length === 0) {
      agent.currentQuestion = this.getFallbackQuestion(agent.type, agent.questionsAsked);
    } else {
      agent.currentQuestion = question;
    }
    
    return agent.currentQuestion;
  }

  private buildQuestionPrompt(agent: SubAgent, userContext: string): string {
    const agentPurpose = this.getAgentPurpose(agent.type);
    const previousQA = agent.sandbox.conversationHistory
      .map(qa => `Q: ${qa.question}\nA: ${qa.answer}`)
      .join('\n\n');

    return `You are a specialized clarification agent focused on: ${agentPurpose}

User's initial input: "${userContext}"

${previousQA ? `Previous conversation:\n${previousQA}\n` : ''}

Your goal is to ask ONE targeted question that helps clarify the ${agent.type} aspect of the user's intent.

Guidelines:
- Ask open-ended questions that encourage detailed responses
- Build on previous answers if available
- Be conversational and empathetic
- Keep questions concise (1-2 sentences)

Generate the next clarifying question:`;
  }

  private getAgentPurpose(type: SubAgentType): string {
    switch (type) {
      case 'scope':
        return 'defining boundaries, scale, and what is included/excluded';
      case 'constraints':
        return 'identifying limitations, resources, and requirements';
      case 'outcomes':
        return 'clarifying success criteria, goals, and desired results';
      case 'emotions':
        return 'understanding emotional drivers, concerns, and motivations';
    }
  }

  private getSmartQuestion(agent: SubAgent, userContext: string): string {
    const lower = userContext.toLowerCase();
    const hasAnswered = agent.sandbox.conversationHistory.length > 0;
    
    // Adapt questions based on what user has said
    if (agent.type === 'scope') {
      if (!hasAnswered) {
        if (lower.includes('build') || lower.includes('create') || lower.includes('make')) {
          return 'What specific thing do you want to build or create?';
        }
        if (lower.includes('help') || lower.includes('assist')) {
          return 'Who or what do you want to help, and in what way?';
        }
        return 'Can you describe what you want to accomplish in more detail?';
      } else if (agent.questionsAsked === 1) {
        if (lower.includes('app') || lower.includes('website') || lower.includes('software')) {
          return 'What are the main features or pages this should have?';
        }
        return 'What should be included in this, and what should be left out?';
      } else {
        return 'Who is this for, and what scale are you thinking (personal, team, public)?';
      }
    }
    
    if (agent.type === 'constraints') {
      if (!hasAnswered) {
        return 'What limitations do you have (time, budget, technical skills, etc.)?';
      } else if (agent.questionsAsked === 1) {
        return 'Are there any specific requirements or rules you need to follow?';
      } else {
        return 'What tools or resources do you already have available?';
      }
    }
    
    if (agent.type === 'outcomes') {
      if (!hasAnswered) {
        return 'What would success look like? How will you know it\'s working?';
      } else if (agent.questionsAsked === 1) {
        return 'What specific results or outcomes are you hoping for?';
      } else {
        return 'How will you measure whether this is successful?';
      }
    }
    
    if (agent.type === 'emotions') {
      if (!hasAnswered) {
        if (lower.includes('frustrated') || lower.includes('stuck')) {
          return 'What\'s been frustrating you about this? What have you tried?';
        }
        if (lower.includes('excited') || lower.includes('want')) {
          return 'What excites you most about this idea?';
        }
        return 'What motivated you to start thinking about this?';
      } else if (agent.questionsAsked === 1) {
        return 'What concerns or worries do you have about moving forward?';
      } else {
        return 'What would make you feel confident that this is the right direction?';
      }
    }
    
    // Fallback
    return this.getFallbackQuestion(agent.type, agent.questionsAsked);
  }

  private getFallbackQuestion(type: SubAgentType, questionNumber: number): string {
    const questions: Record<SubAgentType, string[]> = {
      scope: [
        'What is the scale or size of what you want to accomplish?',
        'Who else is involved or affected by this?',
        'What specific areas should this focus on, and what should it avoid?',
      ],
      constraints: [
        'What limitations or restrictions do you need to work within?',
        'What resources (time, budget, tools) do you have available?',
        'Are there any requirements or rules that must be followed?',
      ],
      outcomes: [
        'What would success look like for this?',
        'How will you know when this is complete or working well?',
        'What specific results are you hoping to achieve?',
      ],
      emotions: [
        'What motivated you to pursue this?',
        'What concerns or worries do you have about this?',
        'How do you feel about the current situation?',
      ],
    };

    return questions[type][questionNumber % questions[type].length];
  }

  async processResponse(agentId: string, userResponse: string): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent || !agent.currentQuestion) return;

    // Record the Q&A
    agent.sandbox.conversationHistory.push({
      question: agent.currentQuestion,
      answer: userResponse,
      timestamp: Date.now(),
    });

    agent.questionsAsked++;

    // Check if user doesn't know or has no more info
    const lower = userResponse.toLowerCase().trim();
    const noInfoResponses = [
      'i don\'t know', 'don\'t know', 'not sure', 'no idea', 
      'idk', 'dunno', 'no', 'nothing', 'none', 'skip'
    ];
    const isNoInfo = noInfoResponses.some(phrase => lower === phrase || lower.includes(phrase));

    // Extract findings from the response (unless it's a "don't know" response)
    if (!isNoInfo) {
      const findings = await this.extractFindings(agent, userResponse);
      agent.sandbox.findings.push(...findings);
      // Update confidence
      agent.sandbox.confidence = Math.min(1, agent.sandbox.confidence + 0.4);
    } else {
      // User doesn't have info - mark as complete to avoid loop
      agent.status = 'completed';
      return;
    }

    // Check if agent should complete
    if (agent.questionsAsked >= agent.maxQuestions || agent.sandbox.confidence > 0.8) {
      agent.status = 'completed';
    }
  }

  private async extractFindings(_agent: SubAgent, response: string): Promise<string[]> {
    // Simple extraction - just use the response directly
    const findings: string[] = [];
    
    // Split by sentences and take key points
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // Take up to 3 most relevant sentences
    findings.push(...sentences.slice(0, 3).map(s => s.trim()));
    
    if (findings.length === 0) {
      findings.push(response.substring(0, 100));
    }
    
    return findings;
    
    /* Bedrock version - disabled for performance
    const prompt = `Extract key insights from this user response related to ${agent.type}:

User Response: "${response}"

Return a JSON array of 1-3 concise findings (strings). Focus on concrete information.

Example: ["User has a 2-week timeline", "Budget is limited to $500", "Must work on mobile devices"]

Return ONLY the JSON array:`;

    try {
      const result = await this.bedrockClient.send(new ConverseCommand({
        modelId: this.modelId,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: {
          maxTokens: 200,
          temperature: 0.3,
        },
      }));

      const content = result.output?.message?.content?.[0];
      if (content && 'text' in content && content.text) {
        const jsonMatch = content.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.error('Failed to extract findings:', error);
    }

    return [response.substring(0, 100)]; // Fallback
    */
  }

  async synthesizeFindings(agents: SubAgent[]): Promise<{
    summary: string;
    extractedIntent: any;
    confidence: number;
  }> {
    const avgConfidence = agents.reduce((sum: number, a: SubAgent) => sum + a.sandbox.confidence, 0) / agents.length;

    const prompt = `Synthesize these clarification findings into a coherent intent summary:

${agents.map((a: SubAgent) => `
${a.type.toUpperCase()} Agent Findings:
${a.sandbox.findings.map((f: string) => `- ${f}`).join('\n')}
`).join('\n')}

Generate a JSON response:
{
  "summary": "<concise 2-3 sentence summary of the user's refined intent>",
  "extractedIntent": {
    "goal": "<clear goal statement>",
    "scope": "<defined boundaries>",
    "constraints": [<list of constraints>],
    "successCriteria": [<list of success criteria>]
  }
}

Return ONLY valid JSON:`;

    try {
      console.log('🤖 Using adapter for findings synthesis');
      
      const adapter = LLMAdapterFactory.getPrimaryAdapter();
      const response = await adapter.invoke(prompt, {
        ...DEFAULT_LLM_CONFIG,
        maxTokens: 400,
        temperature: 0.4
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary,
          extractedIntent: parsed.extractedIntent,
          confidence: avgConfidence,
        };
      }
    } catch (error) {
      console.error('⚠️ LLM synthesis failed, using fallback:', error);
    }

    // Fast fallback synthesis
    const allFindings = agents.flatMap(a => a.sandbox.findings);
    const summary = `Based on your responses: ${allFindings.slice(0, 3).join('. ')}.`;
    
    const extractedIntent: any = {
      goal: allFindings.find(f => f.length > 20) || 'User goal clarified',
      scope: agents.find(a => a.type === 'scope')?.sandbox.findings[0] || 'Scope defined',
      constraints: agents.find(a => a.type === 'constraints')?.sandbox.findings || [],
      successCriteria: agents.find(a => a.type === 'outcomes')?.sandbox.findings || [],
    };

    return {
      summary,
      extractedIntent,
      confidence: avgConfidence,
    };
  }

  getAgent(agentId: string): SubAgent | undefined {
    return this.activeAgents.get(agentId);
  }

  getAllAgents(): SubAgent[] {
    return Array.from(this.activeAgents.values());
  }

  clearAgents(): void {
    this.activeAgents.clear();
  }
}
