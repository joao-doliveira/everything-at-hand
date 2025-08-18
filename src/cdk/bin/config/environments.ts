import process from "node:process";

export interface EnvironmentConfig {
  account: string;
  region: string;
  environment: 'preprod' | 'prod';
  resourcePrefix: string;
  dbInstanceType: 'db.t3.micro';
  multiAz: boolean;
  deletionProtection: boolean;
  allocatedStorage: number;
}

// Helper function to get required environment variable
function getRequiredEnvVar(varName: string, environmentName: string): string {
  const value = process.env[varName];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${varName}\n` +
      `This is required for ${environmentName} environment deployment.\n` +
      `Please set ${varName} in your environment or GitHub secrets.`
    );
  }
  return value;
}

export const environments: Record<string, EnvironmentConfig> = {
  preprod: {
    account: getRequiredEnvVar('PREPROD_AWS_ACCOUNT_ID', 'preprod'),
    region: 'sa-east-1',
    environment: 'preprod',
    resourcePrefix: 'eah-preprod',
    dbInstanceType: 'db.t3.micro',
    multiAz: false,
    deletionProtection: false,
    allocatedStorage: 20,
  },
  prod: {
    account: getRequiredEnvVar('PREPROD_AWS_ACCOUNT_ID', 'preprod'),
    region: 'sa-east-1',
    environment: 'prod',
    resourcePrefix: 'eah-preprod',
    dbInstanceType: 'db.t3.micro',
    multiAz: false,
    deletionProtection: false,
    allocatedStorage: 20,
  },
};

export function getEnvironmentConfig(environmentName: string): EnvironmentConfig {
  const config = environments[environmentName];
  if (!config) {
    throw new Error(`Environment '${environmentName}' not found. Available environments: ${Object.keys(environments).join(', ')}`);
  }
  return config;
}
