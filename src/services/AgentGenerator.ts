import { LLMAdapterFactory } from '../adapters/LLMAdapterFactory';
import { ExtractedIntent } from './IntentSnapshot';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_LLM_CONFIG } from '../models/constants';

export interface AgentSpecification {
  agentId: string;
  name: string;
  purpose: string;
  capabilities: string[];
  scope: {
    included: string[];
    excluded: string[];
  };
  constraints: string[];
  successCriteria: string[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  suggestedArchitecture: 'single' | 'multi-agent';
  components?: AgentSpecification[];
  systemPrompt: string;
}

export class AgentGenerator {
  constructor() {}

  async generateAgent(
    extractedIntent: ExtractedIntent,
    conversationHistory: string[]
  ): Promise<AgentSpecification> {
    const prompt = this.buildGenerationPrompt(extractedIntent, conversationHistory);

    try {
      const adapter = LLMAdapterFactory.getPrimaryAdapter();
      const response = await adapter.invoke(prompt, { 
        ...DEFAULT_LLM_CONFIG, 
        maxTokens: 2000,
        temperature: 0.5 
      });

      return this.parseAgentSpec(response.content, extractedIntent);
    } catch (error) {
      console.error('Failed to generate agent:', error);
    }

    return this.createFallbackAgent(extractedIntent);
  }

  private buildGenerationPrompt(intent: ExtractedIntent, history: string[]): string {
    const safeIntent = intent || {};
    return `You are an expert AI agent architect. Based on the clarified user intent, design a complete agent specification.

**User's Refined Intent:**
- Goal: ${safeIntent.goal || 'Not specified'}
- Scope: ${safeIntent.scope || 'Not specified'}
- Constraints: ${safeIntent.constraints?.join(', ') || 'None specified'}
- Success Criteria: ${safeIntent.successCriteria?.join(', ') || 'Not specified'}
- Emotional Context: ${safeIntent.emotionalContext || 'None'}

**Conversation Context:**
${history.slice(-5).join('\n')}

Design an agent specification in JSON format:

{
  "name": "<descriptive agent name>",
  "purpose": "<clear one-sentence purpose>",
  "capabilities": [<list of specific capabilities the agent needs>],
  "scope": {
    "included": [<what the agent should handle>],
    "excluded": [<what the agent should NOT handle>]
  },
  "constraints": [<technical or operational constraints>],
  "successCriteria": [<measurable success indicators>],
  "estimatedComplexity": "<simple|moderate|complex>",
  "suggestedArchitecture": "<single|multi-agent>",
  "systemPrompt": "<detailed system prompt for the agent>"
}

Guidelines:
- Be specific and actionable
- Match the user's language and style
- Consider the emotional context
- Ensure success criteria are measurable
- Make the system prompt comprehensive

Return ONLY valid JSON:`;
  }

  private parseAgentSpec(responseText: string, intent: ExtractedIntent): AgentSpecification {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          agentId: uuidv4(),
          name: parsed.name || 'Custom Agent',
          purpose: parsed.purpose || intent.goal || 'Assist user with their goal',
          capabilities: parsed.capabilities || [],
          scope: parsed.scope || { included: [], excluded: [] },
          constraints: parsed.constraints || intent.constraints || [],
          successCriteria: parsed.successCriteria || intent.successCriteria || [],
          estimatedComplexity: parsed.estimatedComplexity || 'moderate',
          suggestedArchitecture: parsed.suggestedArchitecture || 'single',
          systemPrompt: parsed.systemPrompt || this.generateDefaultSystemPrompt(intent),
        };
      }
    } catch (error) {
      console.error('Failed to parse agent spec:', error);
    }

    return this.createFallbackAgent(intent);
  }

  private createFallbackAgent(intent: ExtractedIntent): AgentSpecification {
    const safeIntent = intent || {};
    return {
      agentId: uuidv4(),
      name: 'Custom Task Agent',
      purpose: safeIntent.goal || 'Assist with user-defined task',
      capabilities: [
        'Understand user requirements',
        'Execute defined tasks',
        'Provide progress updates',
        'Handle errors gracefully',
      ],
      scope: {
        included: [safeIntent.scope || 'User-defined scope'],
        excluded: ['Tasks outside defined scope'],
      },
      constraints: safeIntent.constraints || [],
      successCriteria: safeIntent.successCriteria || ['Task completed successfully'],
      estimatedComplexity: 'moderate',
      suggestedArchitecture: 'single',
      systemPrompt: this.generateDefaultSystemPrompt(safeIntent),
    };
  }

  private generateDefaultSystemPrompt(intent: ExtractedIntent): string {
    const safeIntent = intent || {};
    return `You are a specialized AI agent designed to help with: ${safeIntent.goal || 'user-defined tasks'}.

Your scope includes:
${safeIntent.scope || 'Working within user-defined boundaries'}

Constraints you must follow:
${safeIntent.constraints?.map(c => `- ${c}`).join('\n') || '- Follow user guidance'}

Success criteria:
${safeIntent.successCriteria?.map(c => `- ${c}`).join('\n') || '- Complete the task effectively'}

${safeIntent.emotionalContext ? `\nEmotional context: ${safeIntent.emotionalContext}\nBe empathetic and supportive in your responses.` : ''}

Always:
- Be clear and concise
- Ask for clarification when needed
- Provide progress updates
- Stay within your defined scope
- Acknowledge limitations honestly`;
  }

  formatSpecificationForDisplay(spec: AgentSpecification): string {
    let display = `🤖 **Agent Specification**\n\n`;
    display += `**Name:** ${spec.name}\n`;
    display += `**Purpose:** ${spec.purpose}\n\n`;
    
    display += `**Capabilities:**\n`;
    spec.capabilities.forEach(cap => {
      display += `  ✓ ${cap}\n`;
    });
    display += '\n';
    
    display += `**Scope:**\n`;
    display += `  Included:\n`;
    spec.scope.included.forEach(item => {
      display += `    • ${item}\n`;
    });
    if (spec.scope.excluded.length > 0) {
      display += `  Excluded:\n`;
      spec.scope.excluded.forEach(item => {
        display += `    • ${item}\n`;
      });
    }
    display += '\n';
    
    if (spec.constraints.length > 0) {
      display += `**Constraints:**\n`;
      spec.constraints.forEach(con => {
        display += `  ⚠️ ${con}\n`;
      });
      display += '\n';
    }
    
    display += `**Success Criteria:**\n`;
    spec.successCriteria.forEach(crit => {
      display += `  🎯 ${crit}\n`;
    });
    display += '\n';
    
    display += `**Complexity:** ${spec.estimatedComplexity}\n`;
    display += `**Architecture:** ${spec.suggestedArchitecture}\n\n`;
    
    display += `---\n\n`;
    display += `**System Prompt:**\n\`\`\`\n${spec.systemPrompt}\n\`\`\`\n\n`;
    
    display += `✅ Ready to deploy this agent?`;
    
    return display;
  }

  async executeAgent(spec: AgentSpecification, userTask: string): Promise<string> {
    try {
      const adapter = LLMAdapterFactory.getPrimaryAdapter();
      const response = await adapter.invoke(userTask, {
        ...DEFAULT_LLM_CONFIG,
        systemPrompt: spec.systemPrompt,
        maxTokens: 2000,
        temperature: 0.7
      });

      return response.content;
    } catch (error) {
      console.error('Agent execution failed:', error);
      return `Error executing agent: ${error}`;
    }
  }
}
