# Everything At Hand - CDK Infrastructure

This directory contains the AWS CDK infrastructure code for the Everything At Hand application.

## Environment Configuration

The infrastructure supports two environments:
- **preprod**: Development/testing environment
- **prod**: Production environment

Each environment is configured in `bin/config/environments.ts` with environment-specific settings.

## Prerequisites

1. **AWS CLI**: Install and configure AWS CLI v2
2. **AWS CDK**: Install globally with `npm install -g aws-cdk`
3. **Node.js**: Version 18 or higher
4. **AWS Accounts**: Separate AWS accounts for preprod and prod

## Environment Setup

### 1. Configure AWS Accounts

Update the account IDs in `bin/config/environments.ts`:

```typescript
export const environments: Record<string, EnvironmentConfig> = {
  preprod: {
    account: 'YOUR_PREPROD_ACCOUNT_ID', // Replace this
    // ... other config
  },
  prod: {
    account: 'YOUR_PROD_ACCOUNT_ID', // Replace this
    // ... other config
  },
};
```

### 2. Configure AWS Profiles

Set up AWS profiles for each environment:

```bash
# Configure preprod profile
aws configure --profile eah-preprod
# Enter your preprod AWS credentials

# Configure prod profile  
aws configure --profile eah-prod
# Enter your prod AWS credentials
```

### 3. GitHub Actions OIDC Setup

For GitHub Actions deployments, you need to create the initial deployment roles manually (one-time setup), then CDK will manage their permissions programmatically:

**Required IAM Roles (Manual Creation - One Time Only):**
- Deployment role for preprod environment with OIDC trust policy
- Role name should follow pattern: `Eah{Environment}Role` (e.g., `EahPreprodRole`)

**Initial Role Setup:**
1. Create the roles manually in AWS Console or CLI
2. Configure OIDC trust relationship for GitHub Actions
3. Attach minimal bootstrap permissions (see below)
4. Deploy the `BaseCdkPermissionsStack` to add comprehensive permissions

**Trust Policy for GitHub OIDC (replace `YOUR_ORG` and `YOUR_REPO`):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:YOUR_ORG/YOUR_REPO:ref:refs/heads/main",
            "repo:YOUR_ORG/YOUR_REPO:ref:refs/heads/develop"
          ]
        }
      }
    }
  ]
}
```

**Initial Bootstrap Permissions (attach to role manually):**
- `arn:aws:iam::aws:policy/PowerUserAccess` (temporary - will be replaced by least-privilege policies)

After the initial deployment, the CDK will manage all permissions programmatically following least-privilege principles.

## CDK Bootstrap

Bootstrap CDK in each account (only needed once per account/region):

```bash
# Bootstrap preprod account
AWS_PROFILE=eah-preprod cdk bootstrap aws://YOUR_PREPROD_ACCOUNT_ID/sa-east-1

# Bootstrap prod account
AWS_PROFILE=eah-prod cdk bootstrap aws://YOUR_PROD_ACCOUNT_ID/sa-east-1
```

## Deployment Commands

### Via GitHub Actions:

Deployments are typically handled through GitHub Actions workflows:

```bash
# Deploy to preprod via GitHub Actions
# Trigger the "Deploy to Preprod" workflow manually or via workflow_dispatch

# Deploy to production via GitHub Actions  
# Trigger the "Deploy to Production" workflow manually or via workflow_dispatch
```

### From project root (local development):

```bash
# Deploy to preprod (requires AWS profile setup)
npm run cdk:deploy:preprod

# Deploy to prod (requires AWS profile setup)
npm run cdk:deploy:prod

# View differences before deployment
npm run cdk:diff:preprod
npm run cdk:diff:prod

# Destroy infrastructure (be careful!)
npm run cdk:destroy:preprod
npm run cdk:destroy:prod
```

### Direct CDK commands (local development):

```bash
cd src/cdk

# Synthesize CloudFormation templates
cdk synth --context environment=preprod
cdk synth --context environment=prod

# Deploy all stacks (requires AWS profile setup)
AWS_PROFILE=eah-preprod cdk deploy --all --context environment=preprod
AWS_PROFILE=eah-prod cdk deploy --all --context environment=prod

# Deploy specific stack
AWS_PROFILE=eah-preprod cdk deploy NotesStatefulStack --context environment=preprod

# View differences
AWS_PROFILE=eah-preprod cdk diff --context environment=preprod

# Destroy all stacks
AWS_PROFILE=eah-preprod cdk destroy --all --context environment=preprod
```

## Stack Architecture

### BaseCdkPermissionsStack
**Deployed First** - Manages core CDK permissions for the deployment role:
- **CDK Bootstrap Policy**: Permissions for assuming CDK execution roles
- **CloudFormation Policy**: Permissions for stack operations
- **S3 Assets Policy**: Permissions for CDK asset management
- **ECR Policy**: Permissions for Docker image management
- **SSM Policy**: Permissions for parameter store access

### NotesStatefulStack
**Deployed Second** - Contains all stateful resources and their permissions:
- **Resource-Specific Policies**: RDS, S3, VPC, and Secrets Manager permissions
- **RDS PostgreSQL Database**: Environment-specific sizing
- **S3 Bucket**: For image storage with CORS configuration
- **VPC**: Networking infrastructure with public/private/isolated subnets

### Future Stacks
The architecture is designed to support additional stacks:
- **NotesComputeStack**: Lambda functions and API Gateway
- **NotesMonitoringStack**: CloudWatch dashboards and alarms

## Outputs

### BaseCdkPermissionsStack Outputs:
- `BaseCdkPoliciesAttached`: Number of base CDK policies attached

### NotesStatefulStack Outputs:
- `DatabaseEndpoint`: RDS database endpoint
- `DatabasePort`: RDS database port
- `S3BucketName`: S3 bucket name for images
- `VpcId`: VPC identifier for the application network
- `AttachedPoliciesCount`: Number of resource-specific policies attached
- `AttachedPolicies`: Names of managed policies attached by this stack

## Security

- **Zero-Trust Architecture**: Deployment role permissions are managed programmatically
- **Least-Privilege Principle**: Each policy grants only necessary permissions with resource-level restrictions
- **Environment Scoping**: All permissions are scoped to environment-specific resources
- **OIDC Authentication**: GitHub Actions uses OpenID Connect (no long-lived access keys)
- **Resource Isolation**: Separate AWS accounts for preprod/prod environments
- **Audit Trail**: All permission changes are tracked in CDK code and CloudTrail
- **Database Security**: Credentials stored in AWS Secrets Manager with automatic rotation
- **S3 Security**: Public access blocked, encryption enabled, lifecycle policies configured

## Cost Optimization

- **Preprod**: Uses t3.micro RDS, 20GB storage, no Multi-AZ
- **Prod**: Uses t3.small RDS, 100GB storage, Multi-AZ enabled
- Lifecycle rules for S3 to clean up incomplete uploads
- Versioning enabled only in production

## Troubleshooting

1. **Context Error**: Make sure to always specify `--context environment=preprod|prod`
2. **Permission Errors**: 
   - For local deployment: Ensure AWS profile has necessary permissions
   - For GitHub Actions: Verify OIDC provider and IAM roles are properly configured
3. **Account Mismatch**: Verify account IDs in environments.ts match your AWS accounts
4. **Bootstrap Issues**: Make sure CDK is bootstrapped in target account/region
5. **OIDC Authentication**: Ensure GitHub repository is configured with proper OIDC trust relationships
6. **Permission Deployment**: Deploy `BaseCdkPermissionsStack` first to ensure role has proper permissions

## Deployment Flow

### Initial Setup (One-time):
1. **Manual Role Creation**: Create deployment role with OIDC trust policy
2. **Bootstrap Permissions**: Attach `PowerUserAccess` policy temporarily
3. **CDK Bootstrap**: Run `cdk bootstrap` in target account
4. **Deploy Permissions**: Deploy `BaseCdkPermissionsStack` first
5. **Remove Bootstrap Policy**: Remove `PowerUserAccess` (CDK now manages all permissions)

### Regular Deployments:
1. **Permissions Stack**: Always deployed first (manages role permissions)
2. **Application Stacks**: Deployed second with proper dependencies
3. **Automatic Updates**: Permission changes are applied automatically through CDK

### Permission Management:
- **Least-Privilege**: Each policy grants minimal required permissions
- **Resource Scoping**: Permissions are scoped to specific environment resources
- **Automatic Updates**: New resource types automatically get appropriate permissions
- **Audit Trail**: All changes tracked in git and CloudTrail