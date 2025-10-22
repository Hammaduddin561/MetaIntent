import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

export interface AmbiguitySignals {
  hedgingLanguage: string[];
  contradictions: string[];
  emotionalMarkers: Array<{
    type: 'frustration' | 'excitement' | 'confusion' | 'anxiety' | 'neutral';
    confidence: number;
    evidence: string;
  }>;
  vagueTerms: string[];
  multipleTopics: string[];
}

export interface AmbiguityAnalysis {
  score: number; // 0-100
  signals: AmbiguitySignals;
  recommendedStrategy: 'scope' | 'constraints' | 'outcomes' | 'emotions' | 'multi';
  reasoning: string;
}

export class AmbiguityDetector {
  private bedrockClient: BedrockRuntimeClient;
  private readonly modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

  constructor() {
    this.bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });
  }

  async analyze(userInput: string, conversationHistory: string[] = []): Promise<AmbiguityAnalysis> {
    const prompt = this.buildAnalysisPrompt(userInput, conversationHistory);

    try {
      console.log('🤖 Using Bedrock Claude for ambiguity detection');

      // Add timeout to prevent Lambda hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Bedrock timeout')), 5000)
      );

      const bedrockPromise = this.bedrockClient.send(new ConverseCommand({
        modelId: this.modelId,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: {
          maxTokens: 500, // Reduced from 1000
          temperature: 0.3,
        },
      }));

      const response = await Promise.race([bedrockPromise, timeoutPromise]);

      const content = response.output?.message?.content?.[0];
      if (content && 'text' in content && content.text) {
        return this.parseAnalysisResponse(content.text);
      }
    } catch (error) {
      console.error('⚠️ Bedrock failed, using fallback:', error);
    }

    // Fallback to simple detection
    return this.createDefaultAnalysis(userInput);

    /* Old disabled code
    const prompt = this.buildAnalysisPrompt(userInput, conversationHistory);
    
    try {
      const response = await this.bedrockClient.send(new ConverseCommand({
        modelId: this.modelId,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: {
          maxTokens: 1000,
          temperature: 0.3,
        },
      }));

      const content = response.output?.message?.content?.[0];
      if (content && 'text' in content && content.text) {
        return this.parseAnalysisResponse(content.text);
      }

      return this.createDefaultAnalysis(userInput);
    } catch (error) {
      console.error('Ambiguity detection failed:', error);
      return this.createDefaultAnalysis(userInput);
    }
    */
  }

  private buildAnalysisPrompt(userInput: string, history: string[]): string {
    return `You are an expert at detecting ambiguity in human communication. Analyze the following user input for vagueness, contradictions, and emotional markers.

User Input: "${userInput}"

${history.length > 0 ? `Previous Context:\n${history.join('\n')}\n` : ''}

Analyze and return a JSON response with:
{
  "score": <0-100, where 100 is extremely ambiguous>,
  "signals": {
    "hedgingLanguage": [<words like "maybe", "kind of", "sort of", "I think">],
    "contradictions": [<conflicting statements>],
    "emotionalMarkers": [
      {
        "type": <"frustration"|"excitement"|"confusion"|"anxiety"|"neutral">,
        "confidence": <0-1>,
        "evidence": <quote from input>
      }
    ],
    "vagueTerms": [<words like "stuff", "things", "something">],
    "multipleTopics": [<distinct topics mentioned>]
  },
  "recommendedStrategy": <"scope"|"constraints"|"outcomes"|"emotions"|"multi">,
  "reasoning": <brief explanation of the ambiguity>
}

Focus on:
1. Hedging language that indicates uncertainty
2. Contradictory statements or goals
3. Emotional undertones (frustration, excitement, confusion)
4. Vague or undefined terms
5. Multiple unrelated topics

Return ONLY valid JSON.`;
  }

  private parseAnalysisResponse(responseText: string): AmbiguityAnalysis {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.min(100, Math.max(0, parsed.score || 50)),
          signals: parsed.signals || this.createEmptySignals(),
          recommendedStrategy: parsed.recommendedStrategy || 'scope',
          reasoning: parsed.reasoning || 'Unable to determine specific ambiguity patterns',
        };
      }
    } catch (error) {
      console.error('Failed to parse ambiguity analysis:', error);
    }

    return this.createDefaultAnalysis('');
  }

  private createDefaultAnalysis(input: string): AmbiguityAnalysis {
    const score = this.calculateSimpleAmbiguityScore(input);
    return {
      score,
      signals: this.detectSimpleSignals(input),
      recommendedStrategy: score > 70 ? 'multi' : 'scope',
      reasoning: 'Fallback analysis based on simple heuristics',
    };
  }

  private calculateSimpleAmbiguityScore(input: string): number {
    let score = 0;
    const lower = input.toLowerCase();
    const words = input.split(' ');

    // Hedging language (strong indicator)
    const hedgingWords = ['maybe', 'perhaps', 'kind of', 'sort of', 'i think', 'not sure', 'possibly', 'might', 'could'];
    hedgingWords.forEach(word => {
      if (lower.includes(word)) score += 20;
    });

    // Vague terms (very strong indicator)
    const vagueWords = ['stuff', 'things', 'something', 'whatever', 'anything', 'somehow'];
    vagueWords.forEach(word => {
      if (lower.includes(word)) score += 25;
    });

    // Uncertainty phrases
    const uncertainPhrases = ['don\'t know', 'not sure', 'unclear', 'confused', 'unsure'];
    uncertainPhrases.forEach(phrase => {
      if (lower.includes(phrase)) score += 30;
    });

    // Questions (indicates uncertainty)
    if (input.includes('?')) score += 15;

    // Very short input (likely vague)
    if (words.length < 5) score += 30;

    // Lack of specifics (no numbers, no proper nouns, no technical terms)
    const hasNumbers = /\d/.test(input);
    const hasCapitalizedWords = /[A-Z][a-z]+/.test(input);
    if (!hasNumbers && !hasCapitalizedWords && words.length < 10) {
      score += 20;
    }

    // Generic action words without specifics
    const genericActions = ['build', 'make', 'create', 'do', 'help', 'work'];
    const hasGenericAction = genericActions.some(action => lower.includes(action));
    const hasSpecificDetails = words.length > 8 || hasNumbers || lower.includes('for') || lower.includes('with');
    if (hasGenericAction && !hasSpecificDetails) {
      score += 25;
    }

    return Math.min(100, score);
  }

  private detectSimpleSignals(input: string): AmbiguitySignals {
    const lower = input.toLowerCase();
    const signals: AmbiguitySignals = {
      hedgingLanguage: [],
      contradictions: [],
      emotionalMarkers: [],
      vagueTerms: [],
      multipleTopics: [],
    };

    // Detect hedging
    ['maybe', 'perhaps', 'kind of', 'sort of', 'i think', 'not sure'].forEach(word => {
      if (lower.includes(word)) signals.hedgingLanguage.push(word);
    });

    // Detect vague terms
    ['stuff', 'things', 'something', 'whatever'].forEach(word => {
      if (lower.includes(word)) signals.vagueTerms.push(word);
    });

    // Detect emotional markers
    if (lower.includes('frustrated') || lower.includes('annoying')) {
      signals.emotionalMarkers.push({
        type: 'frustration',
        confidence: 0.7,
        evidence: 'frustrated/annoying language detected',
      });
    }
    if (lower.includes('excited') || lower.includes('amazing')) {
      signals.emotionalMarkers.push({
        type: 'excitement',
        confidence: 0.7,
        evidence: 'excited/positive language detected',
      });
    }
    if (lower.includes('confused') || lower.includes('not sure')) {
      signals.emotionalMarkers.push({
        type: 'confusion',
        confidence: 0.8,
        evidence: 'confusion indicators detected',
      });
    }

    return signals;
  }

  private createEmptySignals(): AmbiguitySignals {
    return {
      hedgingLanguage: [],
      contradictions: [],
      emotionalMarkers: [],
      vagueTerms: [],
      multipleTopics: [],
    };
  }
}
