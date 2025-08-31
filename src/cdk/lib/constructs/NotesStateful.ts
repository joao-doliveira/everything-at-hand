import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/config/environments';

export interface NotesStatefulProps {
  environmentConfig: EnvironmentConfig;
}

export class NotesStateful extends Construct {
  public readonly database: rds.DatabaseInstance;
  public readonly imagesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: NotesStatefulProps) {
    super(scope, id);
    
    const { environmentConfig } = props;
    
    // Create a minimal VPC for RDS - simpler than custom networking but avoids lookup
    const vpc = new ec2.Vpc(this, 'SimpleVpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2, // Use only 2 AZs for cost efficiency
      natGateways: 0, // No NAT gateways needed for database-only VPC
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED, // Database subnets
        },
      ],
    });
    
    // Database with environment-specific sizing
    this.database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      databaseName: `eah_${environmentConfig.environment}`,
      credentials: rds.Credentials.fromGeneratedSecret('postgres', {
        secretName: `${environmentConfig.resourcePrefix}-db-credentials`,
      }),
      multiAz: environmentConfig.multiAz,
      allocatedStorage: environmentConfig.allocatedStorage,
      deletionProtection: environmentConfig.deletionProtection,
      backupRetention: cdk.Duration.days(3),
      deleteAutomatedBackups: true,
      // Use our simple VPC
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      publiclyAccessible: false, // Keep it secure
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
    });
    
    // S3 bucket for images
    this.imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      bucketName: `${environmentConfig.resourcePrefix}-images-${cdk.Aws.ACCOUNT_ID}`,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT, s3.HttpMethods.DELETE],
        allowedOrigins: ['*'], // Configure based on environment in production
        allowedHeaders: ['*'],
        maxAge: 3000,
      }],
      lifecycleRules: [{
        id: 'DeleteIncompleteMultipartUploads',
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
      }],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
