# MetaIntent Web App

Professional frontend for the MetaIntent autonomous onboarding agent.

## Features

- ✅ Multi-modal input support (Text, Voice, Document)
- ✅ Real-time API integration
- ✅ Session management and persistence
- ✅ Fallback tier visualization
- ✅ Responsive design with Tailwind CSS
- ✅ TypeScript for type safety

## Live API

**Endpoint:** https://0exoqpsrxa.execute-api.us-east-1.amazonaws.com/onboard

## Quick Start

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Build for Production
```bash
npm run build
```

## Usage

1. **Select Input Modality**: Choose between Text, Voice, or Document
2. **Enter Information**: Type your onboarding information
3. **Submit**: Click "Start Onboarding" to begin
4. **View Response**: See session status, message, and fallback tier
5. **Continue**: Use the same session or start a new one

## Example Inputs

**Text Input:**
```
My name is John Doe, born 01/15/1990, ID number: ABC123456
```

**Voice Input (simulated):**
```
Hello, I want to verify my identity for onboarding
```

**Document Input (simulated):**
```
Driver's License: John Doe, DOB: 01/15/1990
```

## API Integration

The app connects to the live MetaIntent API:

```typescript
const API_ENDPOINT = 'https://0exoqpsrxa.execute-api.us-east-1.amazonaws.com/onboard';

const response = await fetch(API_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'optional',
    input: 'user input',
    modality: 'text'
  })
});
```

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### AWS Amplify
```bash
npm install -g @aws-amplify/cli
amplify init
amplify add hosting
amplify publish
```

### Netlify
```bash
npm run build
# Drag and drop the build folder to Netlify
```

## Tech Stack

- **Framework:** React 18 with TypeScript
- **Styling:** Tailwind CSS
- **API:** Fetch API
- **Build Tool:** Create React App

## Project Structure

```
metaintent-webapp/
├── public/
├── src/
│   ├── App.tsx          # Main component
│   ├── App.css          # Custom styles
│   ├── index.tsx        # Entry point
│   └── index.css        # Tailwind imports
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Features Showcase

### Multi-Modal Input
- Text: Direct text entry
- Voice: Audio upload (simulated)
- Document: File upload (simulated)

### Session Management
- Create new sessions
- Resume existing sessions
- Session ID tracking

### Fallback Visualization
- Claude 4.5 (Bedrock) - Primary
- NVIDIA NIM - Fallback 1
- Cache - Fallback 2
- Static - Fallback 3

### Responsive Design
- Mobile-friendly
- Tablet-optimized
- Desktop-enhanced

## Environment Variables

Create `.env` file:
```
REACT_APP_API_ENDPOINT=https://0exoqpsrxa.execute-api.us-east-1.amazonaws.com/onboard
```

## Troubleshooting

**CORS Issues:**
- API Gateway has CORS enabled
- Check browser console for errors

**API Connection:**
- Verify API endpoint is accessible
- Check network tab in DevTools

**Build Errors:**
- Run `npm install` to ensure dependencies
- Clear cache: `npm cache clean --force`

## License

MIT

## Credits

Built for AWS & NVIDIA Hackathon 2025
