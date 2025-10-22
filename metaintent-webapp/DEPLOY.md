# MetaIntent WebApp Deployment Guide

## Quick Deploy

### Option 1: Vercel (Fastest)

1. **Install Vercel CLI:**
```bash
npm install -g vercel
```

2. **Deploy:**
```bash
cd metaintent-webapp
vercel
```

3. **Follow prompts:**
- Set up and deploy: Y
- Which scope: Your account
- Link to existing project: N
- Project name: metaintent-webapp
- Directory: ./
- Override settings: N

4. **Done!** Your app is live at: `https://metaintent-webapp.vercel.app`

### Option 2: Netlify

1. **Build the app:**
```bash
npm run build
```

2. **Deploy:**
- Go to https://app.netlify.com/drop
- Drag and drop the `build` folder
- Done! Your app is live

### Option 3: AWS Amplify

1. **Install Amplify CLI:**
```bash
npm install -g @aws-amplify/cli
```

2. **Initialize:**
```bash
amplify init
```

3. **Add hosting:**
```bash
amplify add hosting
```

4. **Publish:**
```bash
amplify publish
```

## Local Development

```bash
cd metaintent-webapp
npm install
npm start
```

Open http://localhost:3000

## Environment Variables

No environment variables needed! The API endpoint is hardcoded:
```
https://0exoqpsrxa.execute-api.us-east-1.amazonaws.com/onboard
```

## Build for Production

```bash
npm run build
```

Creates optimized production build in `build/` folder.

## Testing

```bash
npm test
```

## Troubleshooting

**Port 3000 already in use:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use different port
set PORT=3001 && npm start
```

**Build fails:**
```bash
npm cache clean --force
rm -rf node_modules
npm install
npm run build
```

**CORS errors:**
- API Gateway already has CORS enabled
- Check browser console for details

## Demo Video

Record your screen showing:
1. Opening the app
2. Entering text input
3. Submitting and seeing response
4. Showing session ID
5. Continuing session
6. Fallback tier badge

## Production Checklist

- [ ] Test all input modalities
- [ ] Verify API connection
- [ ] Check responsive design (mobile/tablet/desktop)
- [ ] Test error handling
- [ ] Record demo video
- [ ] Deploy to hosting platform
- [ ] Share live URL

## Live URLs

After deployment, update these:
- **Vercel:** https://metaintent-webapp.vercel.app
- **Netlify:** https://metaintent-webapp.netlify.app
- **Amplify:** https://main.xxxxx.amplifyapp.com

## Support

Issues? Check:
- Browser console for errors
- Network tab for API calls
- README.md for usage guide
