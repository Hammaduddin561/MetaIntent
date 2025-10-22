const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const userInput = body.input || body.message || '';

        if (!userInput) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Input required' })
            };
        }

        const prompt = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 2000,
            temperature: 0.7,
            messages: [{
                role: 'user',
                content: `You are MetaIntent AI - an intelligent agent that understands user intent deeply. 
                
User input: ${userInput}

Respond helpfully and understand what they're trying to accomplish.`
            }]
        };

        const command = new InvokeModelCommand({
            modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(prompt)
        });

        const response = await bedrock.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                response: responseBody.content[0].text,
                sessionId: body.sessionId || Date.now().toString(),
                status: 'success'
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message,
                response: 'Sorry, I encountered an error. Please try again.'
            })
        };
    }
};
