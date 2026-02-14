import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { RouterRequest, RouterResponse } from '../models/types';
import { SessionManager } from '../services/SessionManager';
import { Logger } from '../utils/logger';
import { ValidationError } from '../models/errors';

const sessionManager = new SessionManager();
const logger = new Logger();

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  
  try {
    await logger.info(requestId, 'Router', 'Request received', { path: event.rawPath });

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const request: RouterRequest = JSON.parse(event.body);

    if (!request.input || !request.modality) {
      throw new ValidationError('Input and modality are required');
    }

    let session;
    if (request.sessionId) {
      session = await sessionManager.loadSession(request.sessionId);
      await logger.info(session.sessionId, 'Router', 'Session loaded', { status: session.status });
    } else {
      session = await sessionManager.createSession(request.userId);
      await logger.info(session.sessionId, 'Router', 'New session created');
    }

    session.metadata.inputModality = request.modality;
    await sessionManager.updateSession(session);

    let message = 'Session ready. Processing your request...';
    if (request.modality === 'voice') {
      message = '🎤 Voice input received. Processing audio data...';
    } else if (request.modality === 'document') {
      message = '📄 Document received. Extracting information...';
    } else {
      message = '✍️ Text input received. Processing your information...';
    }

    const response: RouterResponse = {
      sessionId: session.sessionId,
      status: session.status,
      nextStep: 'classify_intent',
      message,
    };

    await logger.info(session.sessionId, 'Router', 'Request routed successfully');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error: any) {
    await logger.error(requestId, 'Router', 'Request failed', { error: error.message });

    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: error.name || 'Error',
        message: error.message || 'Internal server error',
      }),
    };
  } finally {
    await logger.flush();
  }
};
