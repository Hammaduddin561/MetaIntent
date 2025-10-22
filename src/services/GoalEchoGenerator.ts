import { ExtractedIntent } from './IntentSnapshot';

export interface GoalEcho {
  summary: string;
  confidence: number;
  needsConfirmation: boolean;
  formattedDisplay: string;
}

export class GoalEchoGenerator {
  generateEcho(
    extractedIntent: ExtractedIntent,
    confidence: number,
    ambiguityScore: number
  ): GoalEcho {
    const needsConfirmation = confidence > 0.7 && ambiguityScore < 40;
    
    const formattedDisplay = this.formatEcho(extractedIntent, confidence);
    const summary = this.generateSummary(extractedIntent);

    return {
      summary,
      confidence,
      needsConfirmation,
      formattedDisplay,
    };
  }

  private formatEcho(intent: ExtractedIntent, confidence: number): string {
    const stars = this.getConfidenceStars(confidence);
    
    let echo = '🎯 **Here\'s what I understand so far:**\n\n';
    
    if (intent.goal) {
      echo += `**Goal:** ${intent.goal}\n\n`;
    }
    
    if (intent.scope) {
      echo += `**Scope:** ${intent.scope}\n\n`;
    }
    
    if (intent.constraints && intent.constraints.length > 0) {
      echo += `**Constraints:**\n`;
      intent.constraints.forEach(c => {
        echo += `  • ${c}\n`;
      });
      echo += '\n';
    }
    
    if (intent.successCriteria && intent.successCriteria.length > 0) {
      echo += `**Success Looks Like:**\n`;
      intent.successCriteria.forEach(c => {
        echo += `  • ${c}\n`;
      });
      echo += '\n';
    }
    
    if (intent.emotionalContext) {
      echo += `**Context:** ${intent.emotionalContext}\n\n`;
    }
    
    echo += `**Confidence:** ${(confidence * 100).toFixed(0)}% ${stars}\n\n`;
    
    if (confidence > 0.7) {
      echo += '✅ This looks pretty clear! Should we proceed with generating your agent?';
    } else if (confidence > 0.4) {
      echo += '🔄 We\'re making progress! Let\'s refine this a bit more.';
    } else {
      echo += '🤔 Let\'s clarify a few more things to get this just right.';
    }
    
    return echo;
  }

  private getConfidenceStars(confidence: number): string {
    const starCount = Math.round(confidence * 5);
    return '⭐'.repeat(starCount) + '☆'.repeat(5 - starCount);
  }

  private generateSummary(intent: ExtractedIntent): string {
    const parts: string[] = [];
    
    if (intent.goal) {
      parts.push(intent.goal);
    }
    
    if (intent.scope) {
      parts.push(`with scope: ${intent.scope}`);
    }
    
    if (intent.constraints && intent.constraints.length > 0) {
      parts.push(`considering: ${intent.constraints.join(', ')}`);
    }
    
    return parts.join(' ') || 'Intent being clarified';
  }

  generateProgressUpdate(
    previousAmbiguity: number,
    currentAmbiguity: number,
    questionsAsked: number
  ): string {
    const improvement = previousAmbiguity - currentAmbiguity;
    
    let message = `📊 **Progress Update** (Question ${questionsAsked}):\n\n`;
    
    if (improvement > 20) {
      message += `🎉 Great progress! Clarity improved by ${improvement.toFixed(0)} points.\n`;
    } else if (improvement > 10) {
      message += `✨ Good! We're getting clearer (${improvement.toFixed(0)} points better).\n`;
    } else if (improvement > 0) {
      message += `👍 Making progress (${improvement.toFixed(0)} points clearer).\n`;
    } else {
      message += `🤔 Let's try a different angle to improve clarity.\n`;
    }
    
    const clarityPercent = Math.max(0, 100 - currentAmbiguity);
    message += `\n**Current Clarity:** ${clarityPercent.toFixed(0)}%\n`;
    
    const progressBar = this.generateProgressBar(clarityPercent);
    message += `${progressBar}\n`;
    
    return message;
  }

  private generateProgressBar(percent: number): string {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent.toFixed(0)}%`;
  }

  generateClarificationPrompt(agentType: string, question: string): string {
    const icons: Record<string, string> = {
      scope: '🎯',
      constraints: '⚙️',
      outcomes: '🏆',
      emotions: '💭',
    };
    
    const icon = icons[agentType] || '❓';
    
    return `${icon} **${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Clarification:**\n\n${question}`;
  }
}
