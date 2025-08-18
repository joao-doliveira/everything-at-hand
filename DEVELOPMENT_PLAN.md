# Everything At Hand (EAH) - Development Plan

## Project Overview

This document outlines the comprehensive development plan for Everything At Hand (EAH), an AI-powered notes application with the following key features:

- **Authentication**: Clerk-based authentication with multi-tenant support
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: AWS S3 for image storage
- **AI Integration**: OpenAI SDK for intelligent search and chatbot functionality
- **Infrastructure**: AWS CDK with cell-based architecture
- **Deployment**: Automated CI/CD with GitHub Actions

## Tech Stack

### Frontend
- **Framework**: Next.js 14+ with TypeScript
- **Styling**: Tailwind CSS with dark mode support
- **UI Components**: shadcn/ui
- **Theme Management**: next-themes

### Backend
- **Runtime**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **File Storage**: AWS S3
- **AI**: OpenAI SDK

### Infrastructure
- **IaC**: AWS CDK (for database and storage only)
- **Cloud Provider**: AWS (database/storage), Vercel (application hosting)
- **Deployment**: Vercel for Next.js app + GitHub Actions for AWS infrastructure
- **Architecture**: Hybrid - Vercel hosting with AWS backend services

## Database Schema

```prisma
// prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique // Clerk user ID
  email     String   @unique
  name      String?
  imageUrl  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Note {
  id          String   @id @default(cuid())
  title       String
  description String
  imageUrl    String?  // S3 URL
  deadline    DateTime?
  status      Status   @default(ACTIVE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  userId      String   // References User.clerkId
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

model ChatMessage {
  id          String   @id @default(cuid())
  content     String
  role        Role     @default(USER)
  createdAt   DateTime @default(now())
  userId      String   // References User.clerkId
  chatId      String   // Group messages by conversation
  
  @@index([userId])
  @@index([chatId])
  @@index([createdAt])
}

enum Status {
  DUE
  OVERDUE
  COMPLETED
  DELETED_BY_USER
  ACTIVE
}

enum Role {
  USER
  ASSISTANT
}
```

## Application Pages & Features

### Pre-Authentication
- **`/`** - Landing page with sign in/up CTAs and modals

### Post-Authentication
- **`/notes`** - Notes dashboard with listing, search, and create functionality
- **`/notes/create`** - Note creation form with image upload
- **`/notes/[slug]`** - Note details (modal overlay or full page view)
- **AI Chatbot** - Available on all post-auth pages for deep search

## Cell-Based Architecture

### Hybrid Architecture with AWS Backend Services

The infrastructure uses AWS CDK for backend services only, with the Next.js application hosted on Vercel. This approach provides:

- **Separation of Concerns**: AWS handles data layer (database, storage), Vercel handles application layer
- **Scalability**: Vercel provides automatic scaling for the Next.js app
- **Cost Efficiency**: No need for compute infrastructure on AWS
- **Environment Context**: Different configurations via CDK context parameters
- **Simplified Deployment**: Vercel handles application deployment, CDK handles infrastructure

**Deployment Commands:**
```bash
# Deploy all stacks to preprod account
cdk deploy --all --context environment=preprod

# Deploy all stacks to production account  
cdk deploy --all --context environment=prod

# Deploy specific stack only (currently only stateful stack exists)
cdk deploy NotesStatefulStack --context environment=preprod
cdk deploy NotesStatefulStack --context environment=prod

# Deploy with stack pattern
cdk deploy "Notes*" --context environment=preprod
```

### Environment Isolation

**Preprod Environment:**
- AWS Account: Dedicated preprod AWS account
- IAM User: `eah-preprod`
- S3 Bucket: `eah-preprod-images-{suffix}`
- RDS Instance: `eah-preprod-db`
- Clerk Tenant: `preprod-eah`
- Vercel Project: Connected to preprod branch

**Production Environment:**
- AWS Account: Dedicated production AWS account
- IAM User: `eah-prod`
- S3 Bucket: `eah-prod-images-{suffix}`
- RDS Instance: `eah-prod-db`
- Clerk Tenant: `prod-eah`
- Vercel Project: Connected to main branch

## Implementation Phases

## Phase 0: Infrastructure & Environment Setup

### Step 1: AWS CDK Infrastructure Setup
- [ ] Create CDK project structure with unified stack architecture
- [ ] Set up cell-based architecture for preprod/prod isolation
- [ ] Configure CDK app entry point with environment context
- [ ] Create unified stack that can deploy to different AWS accounts

**Project Structure:**
```
src/cdk/
├── bin/
│   ├── cdk.ts                    # CDK app entry point
│   └── config/
│       └── environments.ts       # Environment-specific configurations
├── lib/
│   ├── constructs/
│   │   ├── NotesStateful.ts      # All stateful resources (RDS, S3, VPC)
│   │   ├── NotesVpc.ts           # VPC networking infrastructure
│   │   └── BaseCdkPermissions.ts # Core CDK deployment permissions
│   └── stacks/
│       └── NotesStatefulStack.ts # Stateful resources stack
├── cdk.json
└── package.json
```

### Step 2: Cell-Based Environment Configuration
- [ ] Configure environment context passing to unified stack
- [ ] Set up environment-specific configurations via CDK context
- [ ] Implement resource naming conventions with environment prefixes
- [ ] Configure stack to deploy identical resources to different AWS accounts

### Step 3: IAM Users and Policies Setup
- [ ] Create dedicated IAM users for each environment
- [ ] Configure least-privilege access policies
- [ ] Set up cross-service permissions (S3, RDS, Secrets Manager)

### Step 4: Clerk Multi-Tenant Setup
- [ ] Create separate Clerk applications for preprod/prod
- [ ] Configure environment-specific domains and webhooks
- [ ] Set up authentication flows for each tenant

**Preprod Clerk Configuration:**
- Application Name: `Everything At Hand (Preprod)`
- Domain: `preprod-eah.clerk.accounts.dev`
- Webhook endpoints: `https://preprod.eah.com/api/webhooks/clerk`

**Production Clerk Configuration:**
- Application Name: `Everything At Hand (Production)`
- Domain: `eah.clerk.accounts.dev`
- Webhook endpoints: `https://eah.com/api/webhooks/clerk`

### Step 5: GitHub Actions Workflow Setup
- [ ] Create preprod deployment workflow (develop branch)
- [ ] Create production deployment workflow (main branch)
- [ ] Configure environment-specific secrets and variables
- [ ] Set up approval gates for production deployments

**Required GitHub Configuration:**
- **OIDC Provider**: GitHub Actions uses OpenID Connect for secure authentication
- **IAM Roles**: Manually created deployment roles with programmatically managed permissions
  - Deployment roles created manually with OIDC trust policy
  - CDK manages all role permissions programmatically following least-privilege principles
- **GitHub Environment**: `preprod-deployment` with required reviewers (admin-only deployment approval)
- **Environment Secrets** (in `preprod-deployment` environment):
  - `PREPROD_DEPLOYMENT_ROLE_ARN`: Full ARN of the deployment role
  - `PREPROD_AWS_ACCOUNT_ID`: AWS account ID for environment variable injection

**GitHub Actions - Deploy Preprod (.github/workflows/deploy-iac-preprod.yaml):**
```yaml
name: Deploy to Preprod

on:
  workflow_dispatch:
    inputs:
      branch:
        description: 'Branch to deploy'
        required: true
        type: string

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: preprod-deployment  # Requires admin approval
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.branch || github.ref }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: src/cdk/package-lock.json

      - name: Install dependencies
        run: |
          cd src/cdk
          npm ci

      - name: Configure AWS Credentials for Preprod
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.PREPROD_DEPLOYMENT_ROLE_ARN }}
          aws-region: sa-east-1

      - name: Deploy to Preprod
        run: |
          cd src/cdk
          npx cdk deploy --all --context environment=preprod --require-approval never
        env:
          BRANCH_NAME: ${{ github.event.inputs.branch || github.ref_name }}
          PREPROD_AWS_ACCOUNT_ID: ${{ secrets.PREPROD_AWS_ACCOUNT_ID }}
```

## Current CDK Architecture

### **Shared Role Permission Management**
The implementation uses a distributed approach where:
1. **Deployment Role**: Manually created with OIDC trust policy
2. **BaseCdkPermissionsStack**: Attaches core CDK permissions (CloudFormation, S3 assets, ECR, SSM)
3. **NotesStatefulStack**: Attaches resource-specific permissions (RDS, S3, VPC, Secrets Manager)
4. **Least-Privilege**: All policies are scoped to environment-specific resources

### **Stack Architecture**
```
BaseCdkPermissionsStack (deployed first)
├── CDK Bootstrap permissions
├── CloudFormation permissions  
├── S3 Assets permissions
├── ECR permissions
└── SSM Parameter Store permissions

NotesStatefulStack (depends on BaseCdkPermissionsStack)
├── RDS Management permissions
├── Application S3 permissions
├── VPC Management permissions
├── Secrets Manager permissions
└── Backend infrastructure resources (database, storage, networking)

Vercel Deployment (separate)
├── Next.js application hosting
├── Automatic scaling and CDN
├── Environment variables from AWS
└── Connected to GitHub for CI/CD
```

### **Environment Configuration**
- **Account ID**: Injected via `PREPROD_AWS_ACCOUNT_ID` environment variable
- **No Hardcoded Values**: All account IDs come from GitHub environment secrets
- **Fail-Fast**: Deployment fails if required environment variables are missing

## Phase 1: Foundation Setup with Environment Awareness

### Step 6: Project Initialization with Environment Configuration
- [ ] Create Next.js 14+ project with TypeScript
- [ ] Configure Tailwind CSS with dark mode support
- [ ] Set up shadcn/ui components with theme variants
- [ ] Install and configure next-themes for theme management
- [ ] Create environment-aware configuration system

**Dependencies:**
```json
{
  "next": "^14.0.0",
  "react": "^18.0.0",
  "tailwindcss": "^3.0.0",
  "@clerk/nextjs": "^4.0.0",
  "next-themes": "^0.2.1",
  "prisma": "^5.0.0",
  "@prisma/client": "^5.0.0",
  "aws-sdk": "^2.1400.0",
  "openai": "^4.0.0"
}
```

### Step 7: RDS PostgreSQL Deployment via CDK
- [ ] Create database construct with VPC configuration
- [ ] Configure environment-specific instance sizing
- [ ] Set up automated backups and monitoring
- [ ] Configure security groups and access controls

**NotesStateful Construct (lib/constructs/NotesStateful.ts):**
```typescript
import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface NotesStatefulProps {
  environment: 'preprod' | 'prod';
}

export class NotesStateful extends Construct {
  public readonly database: rds.DatabaseInstance;
  public readonly imagesBucket: s3.Bucket;
  public readonly deployerUser: iam.User;

  constructor(scope: Construct, id: string, props: NotesStatefulProps) {
    super(scope, id);
    
    const { environment } = props;
    
    // Database with environment-specific sizing
    this.database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: cdk.aws_ec2.InstanceType.of(
        cdk.aws_ec2.InstanceClass.T3,
        environment === 'prod' ? cdk.aws_ec2.InstanceSize.SMALL : cdk.aws_ec2.InstanceSize.MICRO
      ),
      databaseName: `eah_${environment}`,
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      multiAz: environment === 'prod',
      allocatedStorage: environment === 'prod' ? 100 : 20,
      deletionProtection: environment === 'prod',
    });
    
    // S3 bucket for images
    this.imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      bucketName: `eah-${environment}-images-${cdk.Aws.ACCOUNT_ID}`,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
        allowedOrigins: ['*'], // Configure based on environment
        allowedHeaders: ['*'],
      }],
      lifecycleRules: [{
        id: 'DeleteIncompleteMultipartUploads',
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
      }],
    });
    
    // IAM user for deployments
    this.deployerUser = new iam.User(this, 'DeployerUser', {
      userName: `eah-${environment}`,
    });
    
    // Grant permissions
    this.imagesBucket.grantReadWrite(this.deployerUser);
  }
}
```

**NotesStatefulStack (lib/stacks/NotesStatefulStack.ts):**
```typescript
import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NotesStateful } from '../constructs/NotesStateful';

export interface NotesStatefulStackProps extends cdk.StackProps {
  environment: 'preprod' | 'prod';
}

export class NotesStatefulStack extends cdk.Stack {
  // Expose resources for other stacks to reference
  public readonly database: rds.DatabaseInstance;
  public readonly imagesBucket: s3.Bucket;
  public readonly deployerUser: iam.User;

  constructor(scope: Construct, id: string, props: NotesStatefulStackProps) {
    super(scope, id, props);
    
    const { environment } = props;
    
    // Create all stateful resources
    const stateful = new NotesStateful(this, 'Stateful', {
      environment,
    });
    
    // Expose resources for cross-stack references
    this.database = stateful.database;
    this.imagesBucket = stateful.imagesBucket;
    this.deployerUser = stateful.deployerUser;
    
    // Output important values
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: stateful.database.instanceEndpoint.hostname,
      description: 'RDS Database endpoint',
      exportName: `${environment}-DatabaseEndpoint`,
    });
    
    new cdk.CfnOutput(this, 'S3BucketName', {
      value: stateful.imagesBucket.bucketName,
      description: 'S3 bucket for images',
      exportName: `${environment}-S3BucketName`,
    });
    
    new cdk.CfnOutput(this, 'IAMUserName', {
      value: stateful.deployerUser.userName,
      description: 'IAM user for deployments',
      exportName: `${environment}-IAMUserName`,
    });
  }
}
```

**CDK App Entry Point (bin/app.ts):**
```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NotesStatefulStack } from '../lib/stacks/NotesStatefulStack';
// Import future stacks here
// import { NotesComputeStack } from '../lib/stacks/NotesComputeStack';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') as 'preprod' | 'prod';

if (!environment) {
  throw new Error('Environment context is required. Use --context environment=preprod|prod');
}

// Common stack properties
const stackProps = {
  environment,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
};

// Create all stacks
const statefulStack = new NotesStatefulStack(app, 'NotesStatefulStack', stackProps);

// Future stacks can be added here
// const computeStack = new NotesComputeStack(app, 'NotesComputeStack', {
//   ...stackProps,
//   // Pass references from stateful stack if needed
//   database: statefulStack.database,
//   bucket: statefulStack.imagesBucket,
// });

// Add dependencies between stacks if needed
// computeStack.addDependency(statefulStack);
```

### Step 8: Multi-Stack Architecture Benefits
- [ ] **Modular Design**: Separate concerns into logical stacks
- [ ] **Independent Deployment**: Deploy specific stacks without affecting others
- [ ] **Resource Sharing**: Cross-stack references for shared resources
- [ ] **Scalable Architecture**: Easy to add new stacks for different services

**Example Future Stack (NotesComputeStack.ts):**
```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface NotesComputeStackProps extends cdk.StackProps {
  environment: 'preprod' | 'prod';
  // References from stateful stack
  database: rds.DatabaseInstance;
  imagesBucket: s3.Bucket;
}

export class NotesComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: NotesComputeStackProps) {
    super(scope, id, props);
    
    // Lambda functions for API endpoints
    const notesApi = new lambda.Function(this, 'NotesApiFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: {
        DATABASE_URL: props.database.instanceEndpoint.hostname,
        S3_BUCKET: props.imagesBucket.bucketName,
      },
    });
    
    // API Gateway
    const api = new apigateway.RestApi(this, 'NotesApi', {
      restApiName: `eah-${props.environment}-api`,
    });
    
    // Grant permissions
    props.imagesBucket.grantReadWrite(notesApi);
  }
}
```

### Step 9: S3 Bucket Deployment
- [ ] Create S3 construct with environment-specific configurations
- [ ] Configure CORS policies for web uploads
- [ ] Set up lifecycle rules and cleanup policies
- [ ] Implement proper access controls and encryption

## Phase 2: Authentication & Theme System

### Step 10: Clerk Authentication Setup
- [ ] Configure Clerk with custom sign-in/sign-up pages
- [ ] Set up Clerk middleware for route protection
- [ ] Create user sync webhook to maintain local user records
- [ ] Implement environment-specific Clerk configurations

### Step 11: Dark Mode Implementation
- [ ] Configure Tailwind CSS dark mode (class strategy)
- [ ] Create theme provider with next-themes
- [ ] Build theme toggle component
- [ ] Ensure all shadcn/ui components support dark mode
- [ ] Add theme persistence across sessions

## Phase 3: Pre-Authentication Experience

### Step 12: Landing Page with Dark Mode
- [ ] Create responsive landing page with hero section
- [ ] Implement theme toggle in header
- [ ] Integrate Clerk's pre-built auth components
- [ ] Add proper loading states and error handling
- [ ] Ensure accessibility compliance (WCAG 2.1)

## Phase 4: Core Application Infrastructure

### Step 13: S3 Image Management
- [ ] Create image upload API routes with S3 integration
- [ ] Implement image compression and validation
- [ ] Build reusable image upload component
- [ ] Add image preview and deletion functionality
- [ ] Handle upload progress and error states

### Step 14: Database Operations Layer
- [ ] Create comprehensive database utilities
- [ ] Implement user management functions
- [ ] Build notes CRUD operations with user filtering
- [ ] Add chat message persistence and retrieval
- [ ] Optimize database connections and implement error handling

## Phase 5: Notes Management System

### Step 15: Notes API Routes
- [ ] `POST /api/notes` - Create note with S3 image upload
- [ ] `GET /api/notes` - List user's notes with pagination/filtering
- [ ] `GET /api/notes/[id]` - Get single note by ID
- [ ] `PUT /api/notes/[id]` - Update note with image handling
- [ ] `DELETE /api/notes/[id]` - Delete note and associated S3 images
- [ ] `PATCH /api/notes/[id]/status` - Update note status

### Step 16: Notes UI Components
- [ ] **`/notes`** - Notes dashboard with grid/list view toggle
- [ ] Advanced filtering (status, date, search) with dark mode support
- [ ] Infinite scroll or pagination implementation
- [ ] Create Note floating action button
- [ ] Empty states and loading skeletons

- [ ] **`/notes/create`** - Multi-step note creation form
- [ ] S3 image upload with preview functionality
- [ ] Date/time picker for deadlines
- [ ] Rich text editor for descriptions
- [ ] Auto-save functionality and form validation

- [ ] **`/notes/[slug]`** - Dynamic note details page
- [ ] Modal overlay when navigated from UI
- [ ] Full page view for direct URL access
- [ ] Edit mode toggle with inline editing
- [ ] Image gallery for multiple images
- [ ] Status management controls

## Phase 6: AI Integration & Chatbot

### Step 17: OpenAI Integration
- [ ] Set up OpenAI client with proper error handling
- [ ] Create embeddings for semantic search
- [ ] Implement context-aware chat responses
- [ ] Add rate limiting and usage monitoring
- [ ] Configure environment-specific API keys

### Step 18: AI-Powered Search & Chat
- [ ] Build vector search functionality for notes
- [ ] Create chat API with context injection
- [ ] Implement conversation memory and history
- [ ] Add search result highlighting
- [ ] Create chat history persistence with database

### Step 19: Chatbot UI Component
- [ ] Floating chat widget with expand/collapse functionality
- [ ] Message history with infinite scroll
- [ ] Typing indicators and message status
- [ ] Dark mode support for chat interface
- [ ] Mobile-responsive design
- [ ] Search results integration and highlighting

## Phase 7: Advanced Features

### Step 20: Enhanced User Experience
- [ ] Implement real-time updates with WebSockets (optional)
- [ ] Add keyboard shortcuts for power users
- [ ] Create note templates functionality
- [ ] Implement note sharing capabilities
- [ ] Add export capabilities (PDF, markdown)

### Step 21: Performance & Optimization
- [ ] Implement proper caching strategies (Redis/memory)
- [ ] Optimize database queries with proper indexing
- [ ] Add image lazy loading and optimization
- [ ] Implement service worker for offline functionality
- [ ] Set up performance monitoring and analytics

## Phase 8: Testing & Deployment

### Step 22: Comprehensive Testing
- [ ] Unit tests for utilities and API routes
- [ ] Integration tests for database operations
- [ ] E2E tests for critical user flows
- [ ] Performance testing for S3 uploads
- [ ] Accessibility testing (automated and manual)

### Step 23: Production Deployment
- [ ] Configure production environment variables
- [ ] Validate CI/CD pipeline functionality
- [ ] Deploy to Vercel with proper environment configuration
- [ ] Set up monitoring and error tracking (Sentry/DataDog)
- [ ] Implement backup strategies and disaster recovery

### Step 24: Deployment Pipeline Testing
- [ ] **Feature Branch → Preprod**: Automatic deployment on push to `develop`
- [ ] **Preprod → Production**: Manual approval required, triggered by push to `main`
- [ ] **Rollback Strategy**: CDK changeset preview and automated rollback capabilities

## Phase 9: Monitoring and Maintenance

### Step 25: Environment Monitoring
- [ ] CloudWatch dashboards for each environment
- [ ] Separate alerting configurations
- [ ] Cost monitoring per environment
- [ ] Performance metrics comparison between environments

### Step 26: Security and Compliance
- [ ] Separate encryption keys per environment
- [ ] Environment-specific backup strategies
- [ ] Audit logging for production deployments
- [ ] Regular security assessments and penetration testing

## Deployment Flow

1. **Development** → Push to `develop` branch
2. **AWS Infrastructure Deployment** → GitHub Actions deploy CDK stacks to AWS
3. **Vercel Deployment** → Automatic deployment of Next.js app to Vercel
4. **Testing** → Manual testing in preprod environment
5. **Production Deployment** → Push to `main` branch (with approval gates)
6. **Monitoring** → Continuous monitoring in both environments

## Environment Variables

```env
# Environment
ENVIRONMENT=preprod|prod

# Database
DATABASE_URL="postgresql://..."

# Clerk (Environment-specific)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="..."
CLERK_SECRET_KEY="..."
CLERK_WEBHOOK_SECRET="..."

# AWS S3 (Environment-specific)
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="..."
S3_BUCKET_NAME="..."

# OpenAI
OPENAI_API_KEY="..."

# App
NEXT_PUBLIC_APP_URL="..."
```

## Key Benefits of This Architecture

1. **Complete Isolation**: Preprod and prod are completely separate environments
2. **Security**: Separate AWS accounts and IAM users prevent cross-environment access
3. **Scalability**: Vercel provides automatic scaling, CDK allows easy infrastructure modifications
4. **Cost Efficiency**: No compute infrastructure costs on AWS, pay-per-use on Vercel
5. **Automation**: GitHub Actions handle AWS infrastructure, Vercel handles app deployment
6. **Compliance**: Clear separation for audit and compliance requirements
7. **Performance**: Vercel's global CDN and edge functions for optimal performance
8. **Testing**: Safe preprod environment for testing changes
9. **Simplified Operations**: Vercel handles application scaling, monitoring, and deployments
10. **Developer Experience**: Fast deployments and preview environments with Vercel
11. **Context-Driven**: Environment-specific configurations via CDK context
12. **Hybrid Benefits**: Best of both worlds - managed app hosting + controlled backend infrastructure

## Success Metrics

- **Performance**: Page load times < 2s, API response times < 500ms
- **Reliability**: 99.9% uptime, automated rollback capabilities
- **Security**: Zero security vulnerabilities, proper access controls
- **User Experience**: Accessibility compliance, mobile responsiveness
- **AI Features**: Accurate search results, contextual chat responses

## Risk Mitigation

- **Data Loss**: Automated backups, point-in-time recovery
- **Security Breaches**: Least privilege access, regular security audits
- **Deployment Failures**: Automated rollback, blue-green deployments
- **Cost Overruns**: Resource monitoring, automated scaling policies
- **Performance Issues**: Monitoring, caching, CDN implementation

---

This development plan provides a comprehensive roadmap for building an enterprise-grade, AI-powered notes application with proper separation of concerns, security, and scalability considerations.
