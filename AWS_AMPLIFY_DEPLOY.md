# 🚀 AWS Amplify Deployment Guide - MetaIntent

## Quick Deploy to AWS Amplify

Your MetaIntent project is now ready to deploy to AWS Amplify! Follow these simple steps:

---

## 📋 Prerequisites

1. **AWS Account** - [Sign up here](https://aws.amazon.com/free/) if you don't have one
2. **GitHub Repository** - ✅ Already done! (https://github.com/Hammaduddin561/MetaIntent)
3. **amplify.yml** - ✅ Already added to your repository!

---

## 🎯 Step-by-Step Deployment

### Step 1: Access AWS Amplify Console

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Sign in with your AWS account
3. Click **"New app"** → **"Host web app"**

### Step 2: Connect Your GitHub Repository

1. Select **"GitHub"** as your Git provider
2. Click **"Continue"**
3. Authorize AWS Amplify to access your GitHub account (first time only)
4. Select:
   - **Repository**: `MetaIntent`
   - **Branch**: `main`
5. Click **"Next"**

### Step 3: Configure Build Settings

AWS Amplify will automatically detect your `amplify.yml` file!

1. **App name**: `MetaIntent` (or your preferred name)
2. **Environment**: `production` (default)
3. **Build settings**: Should auto-populate from `amplify.yml`
4. Review the configuration - it should look like this:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - echo "Installing dependencies..."
        - npm ci
    build:
      commands:
        - echo "Building project..."
        - npm run build || echo "No build step required"
  artifacts:
    baseDirectory: /
    files:
      - '**/*'
```

5. Click **"Next"**

### Step 4: Review and Deploy

1. Review all settings
2. Click **"Save and deploy"**
3. ⏳ Wait for the deployment to complete (usually 2-5 minutes)

### Step 5: Access Your Live Site! 🎉

Once deployment is complete, you'll see:
- **✅ Provision** - Infrastructure setup
- **✅ Build** - Application build process
- **✅ Deploy** - Deployment to CDN
- **✅ Verify** - Final verification

Your live URL will be displayed at the top, formatted like:
```
https://main.xxxxxx.amplifyapp.com
```

---

## 🔧 Post-Deployment Configuration

### Custom Domain (Optional)

1. In Amplify Console, go to **"Domain management"**
2. Click **"Add domain"**
3. Follow the wizard to connect your custom domain

### Environment Variables (If Needed)

If your app needs API keys or environment variables:

1. Go to **"Environment variables"** in the left sidebar
2. Click **"Manage variables"**
3. Add your variables:
   - `AWS_REGION` - Your AWS region (e.g., `us-east-1`)
   - `BEDROCK_MODEL_ID` - Your Bedrock model ID
   - Any other API keys

### Continuous Deployment ✨

AWS Amplify automatically sets up CI/CD:
- Every push to `main` branch triggers automatic deployment
- Pull requests create preview environments
- Build status updates show in GitHub

---

## 🌐 Your Live URLs

After deployment, you'll have:

1. **Main URL**: `https://main.xxxxxx.amplifyapp.com`
2. **GitHub Repository**: https://github.com/Hammaduddin561/MetaIntent
3. **AWS Amplify Console**: Access from AWS Console

---

## 📊 Monitoring Your App

In the Amplify Console, you can:
- View build logs
- Monitor app performance
- Check visitor analytics
- View error logs
- Set up alerts

---

## 🔄 Making Updates

To update your live site:

```bash
# Make your changes locally
git add .
git commit -m "Your update message"
git push

# AWS Amplify will automatically deploy! 🚀
```

---

## 🐛 Troubleshooting

### Build Fails
- Check build logs in Amplify Console
- Ensure all dependencies are in `package.json`
- Verify `amplify.yml` configuration

### Files Not Loading
- Check that all files are committed to Git
- Verify file paths are relative (not absolute)
- Clear browser cache and try again

### API Issues
- Ensure environment variables are set correctly
- Check AWS service permissions
- Verify API Gateway endpoints

---

## 💡 Best Practices

1. **Branch Protection**: Enable branch protection on `main` in GitHub
2. **Preview Environments**: Enable preview deployments for pull requests
3. **Custom Domain**: Set up a custom domain for professional branding
4. **HTTPS**: Amplify provides SSL certificates automatically
5. **CDN**: Your site is distributed globally via CloudFront

---

## 📞 Support Resources

- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [Amplify Hosting Guide](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html)
- [AWS Support](https://console.aws.amazon.com/support/)

---

## 🎯 What's Deployed?

Your MetaIntent project includes:
- ✅ Modern responsive UI (`index.html`, `style.css`, `script.js`)
- ✅ Architecture documentation and diagrams
- ✅ TypeScript source code (`src/` directory)
- ✅ Lambda functions (`lambda-deploy/`)
- ✅ React webapp (`metaintent-webapp/`)
- ✅ Voice and document upload features
- ✅ GitHub repository integration

---

## 🚀 Ready to Deploy!

Your project is fully configured and ready for AWS Amplify deployment. Simply follow the steps above to make your MetaIntent project live!

**Estimated Deployment Time**: 3-5 minutes ⏱️

---

**Good luck with your deployment!** 🎉

