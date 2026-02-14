import { MetaLoopEngine } from '../../src/services/MetaLoopEngine';

async function testMetaLoop() {
  console.log('--- Testing MetaLoopEngine ---');
  const engine = new MetaLoopEngine();
  const sessionId = 'test-session-' + Date.now();

  console.log('\n1. Starting session with vague input...');
  const startResult = await engine.startSession(sessionId, 'i want to build something');
  
  console.log('Status: ' + startResult.state.status);
  console.log('Ambiguity Score: ' + startResult.state.currentAmbiguityScore);
  console.log('Response:\n' + startResult.response);
  console.log('Needs Clarification: ' + startResult.needsClarification);

  if (startResult.needsClarification) {
    console.log('\n2. Continuing session with clarification...');
    const continueResult = await engine.continueSession(sessionId, 'I want to build a small mobile app for tracking my workouts at the gym.');
    
    console.log('Status: ' + continueResult.state.status);
    console.log('Ambiguity Score: ' + continueResult.state.currentAmbiguityScore);
    console.log('Response:\n' + continueResult.response);
    console.log('Needs Clarification: ' + continueResult.needsClarification);
  } else {
    console.log('Skipping clarification because not needed (unexpected for vague input)');
  }
}

// Mock DynamoDB-related methods since we don't have AWS credentials
// @ts-ignore
import { IntentSnapshotManager } from '../../src/services/IntentSnapshot';
IntentSnapshotManager.prototype.createSnapshot = async function(sid, input, score, intent, conf, prevId) {
  const snapshot = {
    snapshotId: 'mock-snap-' + Date.now(),
    sessionId: sid,
    timestamp: Date.now(),
    ambiguityScore: score,
    userInput: input,
    extractedIntent: intent,
    confidence: conf,
    driftVector: prevId ? { from: prevId, changes: ['clarified'], reason: 'test', magnitude: 0.1 } : undefined
  };
  console.log('  [Mock] Created snapshot for ' + sid + ' with score ' + score);
  return snapshot;
};

// @ts-ignore
IntentSnapshotManager.prototype.getSessionSnapshots = async function(sid) {
  return [];
};

testMetaLoop().catch(console.error);
