#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NotesStatefulStack } from '../lib/stacks/NotesStatefulStack';
import { BaseCdkPermissions } from '../lib/constructs/BaseCdkPermissions';
import { getEnvironmentConfig } from './config/environments';

const app = new cdk.App();

// Get environment from context
const environmentName = app.node.tryGetContext('environment') as string;

if (!environmentName) {
  throw new Error('Environment context is required');
}

// Get environment configuration
const environmentConfig = getEnvironmentConfig(environmentName);

// Common stack properties
const stackProps = {
  environmentConfig,
  env: {
    account: environmentConfig.account,
    region: environmentConfig.region,
  },
};

// Import the existing deployment role that will be shared across stacks
const deploymentRoleName = `Eah${environmentConfig.environment.charAt(0).toUpperCase() + environmentConfig.environment.slice(1)}Role`;

// Create a simple stack to attach base CDK permissions
const baseCdkStack = new cdk.Stack(app, 'BaseCdkPermissionsStack', stackProps);
const deploymentRole = iam.Role.fromRoleName(baseCdkStack, 'SharedDeploymentRole', deploymentRoleName);

// Attach base CDK permissions that all stacks need
new BaseCdkPermissions(baseCdkStack, 'BaseCdkPermissions', {
  deploymentRole,
  environment: environmentConfig.environment,
  accountId: environmentConfig.account,
  region: environmentConfig.region,
});

// Create application stacks and pass the shared role
const notesStatefulStack = new NotesStatefulStack(app, 'NotesStatefulStack', {
  ...stackProps,
  deploymentRoleName,
});

// Ensure base permissions are deployed first
notesStatefulStack.addDependency(baseCdkStack);

app.synth();