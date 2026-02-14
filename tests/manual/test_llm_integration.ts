import { BedrockAdapter } from '../../src/adapters/BedrockAdapter';

async function testLLMIntegration() {
    console.log('🚀 Starting LLM Integration Test...');

    const modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    const region = 'us-east-1';
    
    const adapter = new BedrockAdapter(modelId, region);

    const testPrompt = 'Hello, are you working properly? Please respond with a short sentence.';
    const config = {
        maxTokens: 50,
        temperature: 0.7
    };

    console.log(`📡 Sending test prompt to Bedrock (${modelId})...`);
    
    try {
        const response = await adapter.invoke(testPrompt, config);
        console.log('✅ LLM Response received:');
        console.log('--------------------------');
        console.log(response.content);
        console.log('--------------------------');
        console.log('📊 Usage:', response.usage);
        
        const cost = adapter.estimateCost(testPrompt, config);
        console.log(`💰 Estimated cost: $${cost.toFixed(6)}`);
        
        console.log('\n✨ LLM integration is working properly!');
    } catch (error: any) {
        console.error('❌ LLM Integration Test FAILED');
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        
        if (error.name === 'CredentialsProviderError' || error.message.includes('credentials')) {
            console.log('\nℹ️  Note: This failure is likely due to missing AWS credentials in the current environment.');
            console.log('The code integration itself seems correct, but it cannot reach the AWS service without valid credentials.');
        } else if (error.name === 'AccessDeniedException') {
            console.log('\nℹ️  Note: Access denied. Check if your IAM user/role has bedrock:InvokeModel permission.');
        }
    }
}

testLLMIntegration();
