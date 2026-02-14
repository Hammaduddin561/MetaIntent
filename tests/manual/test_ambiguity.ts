import { AmbiguityDetector } from '../../src/services/AmbiguityDetector';

async function testAmbiguity() {
  console.log('--- Testing AmbiguityDetector ---');
  const detector = new AmbiguityDetector();

  const inputs = [
    {
      name: 'Vague input',
      text: 'i want to build something with stuff'
    },
    {
      name: 'Clear input',
      text: 'I want to build a React website for my bakery in Seattle with a 00 budget and 2 week timeline.'
    },
    {
      name: 'Hesitant input',
      text: 'maybe i could do some kind of project, i think it might be good'
    }
  ];

  for (const input of inputs) {
    console.log('\nTest Case: ' + input.name);
    console.log('Input: "' + input.text + '"');
    
    // We expect this to use the fallback logic since Bedrock won't be available in this environment
    const analysis = await detector.analyze(input.text);
    
    console.log('Score: ' + analysis.score);
    console.log('Strategy: ' + analysis.recommendedStrategy);
    console.log('Reasoning: ' + analysis.reasoning);
    console.log('Signals: ' + JSON.stringify(analysis.signals, null, 2));
    
    if (input.name === 'Vague input' && analysis.score < 50) {
      console.error('❌ FAIL: Vague input should have high ambiguity score');
    } else if (input.name === 'Clear input' && analysis.score > 50) {
      console.error('❌ FAIL: Clear input should have low ambiguity score');
    } else {
      console.log('✅ PASS');
    }
  }
}

testAmbiguity().catch(console.error);
