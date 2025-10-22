# MetaIntent Agent

Modular, autonomous onboarding agent designed for low-bandwidth environments with dual deployment on AWS Bedrock and NVIDIA NIM.

## Features

- **Multi-Modal Identity Verification**: Voice, text, and document inputs
- **Graceful Fallback Logic**: Bedrock → NIM → Cache → Static flow
- **Autonomous API Chaining**: Self-orchestrating API calls
- **Low-Bandwidth Optimization**: Aggressive caching and token efficiency
- **Cost-Efficient**: Stays within $100 AWS budget
- **Modular Backend Switching**: Easy LLM provider swapping

## Architecture

- **Serverless**: AWS Lambda + API Gateway
- **State Management**: DynamoDB with TTL
- **Caching & Logging**: S3
- **LLM Backends**: AWS Bedrock (Claude 4.5) + NVIDIA NIM

## Quick Start

### Prerequisites

- Node.js 20+
- AWS CLI configured
- AWS SAM CLI (optional, for local testing)

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Build

```bash
npm run build
```

### Local Testing

```bash
sam local start-api
```

### Deploy to AWS

```bash
npm run deploy
```

Or manually:

```bash
sam build
sam deploy --guided
```

## Project Structure

```
metaintent-agent/
├── src/
│   ├── adapters/        # LLM backend adapters
│   ├── lambdas/         # Lambda function handlers
│   ├── models/          # Type definitions and data models
│   ├── utils/           # Utility functions (retry, cache, logging)
│   └── services/        # Business logic services
├── .kiro/
│   └── specs/           # Feature specifications
├── dist/                # Compiled TypeScript output
├── package.json
├── tsconfig.json
└── README.md
```

## Documentation

- [Requirements](.kiro/specs/meta-intent-agent/requirements.md)
- [Design](.kiro/specs/meta-intent-agent/design.md)
- [Tasks](.kiro/specs/meta-intent-agent/tasks.md)
- [Deployment Guide](.kiro/specs/meta-intent-agent/DEPLOYMENT.md)

## Testing

Test the deployed API:

```bash
curl -X POST https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/onboard \
  -H "Content-Type: application/json" \
  -d '{"input": "My name is John Doe", "modality": "text"}'
```

## Cost Monitoring

Estimated monthly costs: ~$59 (well under $100 budget)

- Lambda: ~$5
- DynamoDB: ~$2
- S3: ~$1
- SageMaker (NIM): ~$30
- Bedrock: ~$20
- API Gateway: ~$1

## License

MIT
