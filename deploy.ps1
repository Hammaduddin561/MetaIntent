# MetaIntent Deployment Script

Write-Host "`n=== MetaIntent AWS Deployment ===" -ForegroundColor Cyan

# Step 1: Check AWS CLI
Write-Host "`n[1/6] Checking AWS CLI..." -ForegroundColor Yellow
try {
    $awsVersion = aws --version 2>&1
    Write-Host "✓ AWS CLI found: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ AWS CLI not installed" -ForegroundColor Red
    Write-Host "`nInstalling AWS CLI..." -ForegroundColor Yellow
    
    $url = "https://awscli.amazonaws.com/AWSCLIV2.msi"
    $output = "$env:TEMP\AWSCLIV2.msi"
    
    Write-Host "Downloading AWS CLI installer..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $url -OutFile $output
    
    Write-Host "Installing AWS CLI (this may take a minute)..." -ForegroundColor Cyan
    Start-Process msiexec.exe -ArgumentList "/i $output /quiet" -Wait
    
    Write-Host "✓ AWS CLI installed" -ForegroundColor Green
    Write-Host "`nPlease restart your terminal and run this script again." -ForegroundColor Yellow
    exit 0
}

# Step 2: Check AWS credentials
Write-Host "`n[2/6] Checking AWS credentials..." -ForegroundColor Yellow
try {
    $identity = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -eq 0) {
        $accountId = (aws sts get-caller-identity --query Account --output text)
        Write-Host "✓ AWS credentials configured" -ForegroundColor Green
        Write-Host "  Account ID: $accountId" -ForegroundColor Cyan
    } else {
        Write-Host "✗ AWS credentials not configured" -ForegroundColor Red
        Write-Host "`nPlease run: aws configure" -ForegroundColor Yellow
        Write-Host "You'll need your AWS Access Key ID and Secret Access Key" -ForegroundColor White
        exit 1
    }
} catch {
    Write-Host "✗ AWS credentials not configured" -ForegroundColor Red
    Write-Host "`nPlease run: aws configure" -ForegroundColor Yellow
    exit 1
}

# Step 3: Check if project is built
Write-Host "`n[3/6] Checking build..." -ForegroundColor Yellow
if (Test-Path "dist/adapters/BedrockAdapter.js") {
    Write-Host "✓ Project already built" -ForegroundColor Green
} else {
    Write-Host "Building project..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Build successful" -ForegroundColor Green
    } else {
        Write-Host "✗ Build failed" -ForegroundColor Red
        exit 1
    }
}

# Step 4: Check SAM CLI
Write-Host "`n[4/6] Checking SAM CLI..." -ForegroundColor Yellow
try {
    $samVersion = sam --version 2>&1
    Write-Host "✓ SAM CLI found: $samVersion" -ForegroundColor Green
    $useSAM = $true
} catch {
    Write-Host "⚠ SAM CLI not found - will use manual deployment" -ForegroundColor Yellow
    $useSAM = $false
}

# Step 5: Deploy
Write-Host "`n[5/6] Deploying to AWS..." -ForegroundColor Yellow

if ($useSAM) {
    Write-Host "Using SAM for deployment..." -ForegroundColor Cyan
    
    # Build with SAM
    Write-Host "Building SAM application..." -ForegroundColor Cyan
    sam build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ SAM build failed" -ForegroundColor Red
        exit 1
    }
    
    # Check if samconfig.toml exists
    if (Test-Path "samconfig.toml") {
        Write-Host "Using existing SAM configuration..." -ForegroundColor Cyan
        sam deploy
    } else {
        Write-Host "Running guided deployment..." -ForegroundColor Cyan
        sam deploy --guided
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Deployment successful!" -ForegroundColor Green
    } else {
        Write-Host "✗ Deployment failed" -ForegroundColor Red
        exit 1
    }
    
} else {
    Write-Host "Using manual CloudFormation deployment..." -ForegroundColor Cyan
    
    # Create S3 bucket for deployment artifacts
    $bucketName = "metaintent-deploy-$(Get-Random -Minimum 1000 -Maximum 9999)"
    Write-Host "Creating deployment bucket: $bucketName" -ForegroundColor Cyan
    aws s3 mb "s3://$bucketName" --region us-east-1
    
    # Package CloudFormation template
    Write-Host "Packaging application..." -ForegroundColor Cyan
    aws cloudformation package `
        --template-file template.yaml `
        --s3-bucket $bucketName `
        --output-template-file packaged.yaml `
        --region us-east-1
    
    # Deploy CloudFormation stack
    Write-Host "Deploying stack..." -ForegroundColor Cyan
    aws cloudformation deploy `
        --template-file packaged.yaml `
        --stack-name metaintent-stack `
        --capabilities CAPABILITY_IAM `
        --region us-east-1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Deployment successful!" -ForegroundColor Green
    } else {
        Write-Host "✗ Deployment failed" -ForegroundColor Red
        exit 1
    }
}

# Step 6: Get outputs
Write-Host "`n[6/6] Getting deployment information..." -ForegroundColor Yellow

$apiEndpoint = aws cloudformation describe-stacks `
    --stack-name metaintent-stack `
    --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" `
    --output text `
    --region us-east-1

if ($apiEndpoint) {
    Write-Host "`n=== Deployment Complete! ===" -ForegroundColor Green
    Write-Host "`nAPI Endpoint:" -ForegroundColor Cyan
    Write-Host "  $apiEndpoint" -ForegroundColor White
    
    Write-Host "`nTest your API:" -ForegroundColor Cyan
    Write-Host "  curl -X POST $apiEndpoint/onboard ``" -ForegroundColor White
    Write-Host "    -H `"Content-Type: application/json`" ``" -ForegroundColor White
    Write-Host "    -d `"{\\`"input\\`": \\`"My name is John Doe\\`", \\`"modality\\`": \\`"text\\`"}`"" -ForegroundColor White
    
    Write-Host "`nView logs:" -ForegroundColor Cyan
    Write-Host "  aws logs tail /aws/lambda/metaintent-stack-RouterFunction --follow" -ForegroundColor White
    
    Write-Host "`nCleanup (when done):" -ForegroundColor Cyan
    Write-Host "  sam delete --stack-name metaintent-stack" -ForegroundColor White
} else {
    Write-Host "⚠ Could not retrieve API endpoint" -ForegroundColor Yellow
    Write-Host "Check AWS Console: https://console.aws.amazon.com/cloudformation/" -ForegroundColor White
}

Write-Host "`n✓ Done!" -ForegroundColor Green
