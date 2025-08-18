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
    
    // Get the default VPC
    const defaultVpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', {
      isDefault: true,
    });
    
    // Database with environment-specific sizing - using default VPC
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
      // Use default VPC - much simpler!
      vpc: defaultVpc,
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
