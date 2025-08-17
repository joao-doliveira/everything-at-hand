import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NotesStateful } from '../constructs/NotesStateful';
import { EnvironmentConfig } from '../../bin/config/environments';
import { NotesVpc } from '../constructs/NotesVpc';

export interface NotesStatefulStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
  deploymentRoleName: string;
}

export class NotesStatefulStack extends cdk.Stack {
  // Expose resources for other stacks to reference
  public readonly database: rds.DatabaseInstance;
  public readonly imagesBucket: s3.Bucket;

  public readonly vpc: NotesVpc;

  constructor(scope: Construct, id: string, props: NotesStatefulStackProps) {
    super(scope, id, props);
    
    const { environmentConfig, deploymentRoleName } = props;
    
    // Import the existing deployment role
    const deploymentRole = iam.Role.fromRoleName(this, 'DeploymentRole', deploymentRoleName);
    
    // Create and attach policies required for this stack's resources
    this.attachStatefulResourcePolicies(deploymentRole, environmentConfig);
    
    // Create all stateful resources
    const stateful = new NotesStateful(this, 'Stateful', {
      environmentConfig,
    });
    
    // Expose resources for cross-stack references
    this.database = stateful.database;
    this.imagesBucket = stateful.imagesBucket;
    this.vpc = stateful.vpc;
    
    // Output important values
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: stateful.database.instanceEndpoint.hostname,
      description: 'RDS Database endpoint',
      exportName: `${environmentConfig.environment}-DatabaseEndpoint`,
    });
    
    new cdk.CfnOutput(this, 'DatabasePort', {
      value: stateful.database.instanceEndpoint.port.toString(),
      description: 'RDS Database port',
      exportName: `${environmentConfig.environment}-DatabasePort`,
    });
    
    new cdk.CfnOutput(this, 'S3BucketName', {
      value: stateful.imagesBucket.bucketName,
      description: 'S3 bucket for images',
      exportName: `${environmentConfig.environment}-S3BucketName`,
    });
    
    new cdk.CfnOutput(this, 'S3BucketArn', {
      value: stateful.imagesBucket.bucketArn,
      description: 'S3 bucket ARN',
      exportName: `${environmentConfig.environment}-S3BucketArn`,
    });
    


    // VPC Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: stateful.vpc.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${environmentConfig.environment}-VpcId`,
    });

    new cdk.CfnOutput(this, 'VpcCidr', {
      value: stateful.vpc.vpc.vpcCidrBlock,
      description: 'VPC CIDR Block',
      exportName: `${environmentConfig.environment}-VpcCidr`,
    });

    new cdk.CfnOutput(this, 'ApplicationSubnets', {
      value: stateful.vpc.vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'Private subnet IDs for applications',
      exportName: `${environmentConfig.environment}-ApplicationSubnets`,
    });

    new cdk.CfnOutput(this, 'PublicSubnets', {
      value: stateful.vpc.vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'Public subnet IDs for load balancers',
      exportName: `${environmentConfig.environment}-PublicSubnets`,
    });

    new cdk.CfnOutput(this, 'DatabaseSubnets', {
      value: stateful.vpc.vpc.isolatedSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'Isolated subnet IDs for databases',
      exportName: `${environmentConfig.environment}-DatabaseSubnets`,
    });

    new cdk.CfnOutput(this, 'ApplicationSecurityGroupId', {
      value: stateful.vpc.applicationSecurityGroup.securityGroupId,
      description: 'Security group ID for applications',
      exportName: `${environmentConfig.environment}-ApplicationSecurityGroupId`,
    });

    new cdk.CfnOutput(this, 'LoadBalancerSecurityGroupId', {
      value: stateful.vpc.loadBalancerSecurityGroup.securityGroupId,
      description: 'Security group ID for load balancers',
      exportName: `${environmentConfig.environment}-LoadBalancerSecurityGroupId`,
    });

    // Add tags for resource organization
    cdk.Tags.of(this).add('Environment', environmentConfig.environment);
    cdk.Tags.of(this).add('Project', 'EverythingAtHand');
    cdk.Tags.of(this).add('Stack', 'Stateful');
  }

  /**
   * Create and attach policies required for deploying stateful resources
   */
  private attachStatefulResourcePolicies(deploymentRole: iam.IRole, environmentConfig: EnvironmentConfig): void {
    const { environment, account, region } = environmentConfig;

    // RDS Policy - permissions for database operations
    const rdsPolicy = new iam.ManagedPolicy(this, 'StatefulRDSPolicy', {
      managedPolicyName: `EAH-Stateful-RDS-${environment}-${this.node.addr}`,
      description: `RDS permissions for ${environment} stateful resources`,
      statements: [
        new iam.PolicyStatement({
          sid: 'RDSManagement',
          effect: iam.Effect.ALLOW,
          actions: [
            'rds:CreateDBInstance',
            'rds:DeleteDBInstance',
            'rds:ModifyDBInstance',
            'rds:DescribeDBInstances',
            'rds:DescribeDBClusters',
            'rds:DescribeDBSubnetGroups',
            'rds:CreateDBSubnetGroup',
            'rds:DeleteDBSubnetGroup',
            'rds:ModifyDBSubnetGroup',
            'rds:AddTagsToResource',
            'rds:RemoveTagsFromResource',
            'rds:ListTagsForResource',
            'rds:DescribeDBParameterGroups',
            'rds:CreateDBParameterGroup',
            'rds:DeleteDBParameterGroup',
            'rds:ModifyDBParameterGroup',
          ],
          resources: [
            `arn:aws:rds:${region}:${account}:db:eah-${environment}-*`,
            `arn:aws:rds:${region}:${account}:cluster:eah-${environment}-*`,
            `arn:aws:rds:${region}:${account}:subnet-group:eah-${environment}-*`,
            `arn:aws:rds:${region}:${account}:pg:eah-${environment}-*`,
          ],
        }),
      ],
    });

    // S3 Policy - permissions for bucket operations
    const s3Policy = new iam.ManagedPolicy(this, 'StatefulS3Policy', {
      managedPolicyName: `EAH-Stateful-S3-${environment}-${this.node.addr}`,
      description: `S3 permissions for ${environment} stateful resources`,
      statements: [
        new iam.PolicyStatement({
          sid: 'S3BucketManagement',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:CreateBucket',
            's3:DeleteBucket',
            's3:GetBucketLocation',
            's3:GetBucketPolicy',
            's3:PutBucketPolicy',
            's3:DeleteBucketPolicy',
            's3:GetBucketCors',
            's3:PutBucketCors',
            's3:GetBucketVersioning',
            's3:PutBucketVersioning',
            's3:GetEncryptionConfiguration',
            's3:PutEncryptionConfiguration',
            's3:GetBucketPublicAccessBlock',
            's3:PutBucketPublicAccessBlock',
            's3:GetLifecycleConfiguration',
            's3:PutLifecycleConfiguration',
            's3:ListBucket',
            's3:GetBucketTagging',
            's3:PutBucketTagging',
          ],
          resources: [
            `arn:aws:s3:::eah-${environment}-images-${account}`,
          ],
        }),
      ],
    });

    // VPC Policy - permissions for networking resources
    const vpcPolicy = new iam.ManagedPolicy(this, 'StatefulVPCPolicy', {
      managedPolicyName: `EAH-Stateful-VPC-${environment}-${this.node.addr}`,
      description: `VPC permissions for ${environment} stateful resources`,
      statements: [
        new iam.PolicyStatement({
          sid: 'VPCManagement',
          effect: iam.Effect.ALLOW,
          actions: [
            'ec2:CreateVpc',
            'ec2:DeleteVpc',
            'ec2:ModifyVpcAttribute',
            'ec2:DescribeVpcs',
            'ec2:CreateSubnet',
            'ec2:DeleteSubnet',
            'ec2:ModifySubnetAttribute',
            'ec2:DescribeSubnets',
            'ec2:CreateInternetGateway',
            'ec2:DeleteInternetGateway',
            'ec2:AttachInternetGateway',
            'ec2:DetachInternetGateway',
            'ec2:DescribeInternetGateways',
            'ec2:CreateRouteTable',
            'ec2:DeleteRouteTable',
            'ec2:CreateRoute',
            'ec2:DeleteRoute',
            'ec2:AssociateRouteTable',
            'ec2:DisassociateRouteTable',
            'ec2:DescribeRouteTables',
            'ec2:CreateSecurityGroup',
            'ec2:DeleteSecurityGroup',
            'ec2:AuthorizeSecurityGroupIngress',
            'ec2:AuthorizeSecurityGroupEgress',
            'ec2:RevokeSecurityGroupIngress',
            'ec2:RevokeSecurityGroupEgress',
            'ec2:DescribeSecurityGroups',
            'ec2:CreateTags',
            'ec2:DeleteTags',
            'ec2:DescribeTags',
            'ec2:DescribeAvailabilityZones',
            'ec2:DescribeAccountAttributes',
            'ec2:CreateNatGateway',
            'ec2:DeleteNatGateway',
            'ec2:DescribeNatGateways',
            'ec2:AllocateAddress',
            'ec2:ReleaseAddress',
            'ec2:DescribeAddresses',
          ],
          resources: ['*'], // EC2 describe operations require * resource
          conditions: {
            StringEquals: {
              'aws:RequestedRegion': [region],
            },
          },
        }),
      ],
    });

    // Secrets Manager Policy - permissions for database credentials
    const secretsPolicy = new iam.ManagedPolicy(this, 'StatefulSecretsPolicy', {
      managedPolicyName: `EAH-Stateful-Secrets-${environment}-${this.node.addr}`,
      description: `Secrets Manager permissions for ${environment} stateful resources`,
      statements: [
        new iam.PolicyStatement({
          sid: 'SecretsManagerAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            'secretsmanager:CreateSecret',
            'secretsmanager:DeleteSecret',
            'secretsmanager:UpdateSecret',
            'secretsmanager:DescribeSecret',
            'secretsmanager:GetSecretValue',
            'secretsmanager:PutSecretValue',
            'secretsmanager:TagResource',
            'secretsmanager:UntagResource',
            'secretsmanager:GetResourcePolicy',
            'secretsmanager:PutResourcePolicy',
          ],
          resources: [
            `arn:aws:secretsmanager:${region}:${account}:secret:eah-${environment}-*`,
          ],
        }),
      ],
    });

    // Attach all policies to the deployment role
    deploymentRole.addManagedPolicy(rdsPolicy);
    deploymentRole.addManagedPolicy(s3Policy);
    deploymentRole.addManagedPolicy(vpcPolicy);
    deploymentRole.addManagedPolicy(secretsPolicy);

    new cdk.CfnOutput(this, 'AttachedPolicies', {
      value: [rdsPolicy.managedPolicyName, s3Policy.managedPolicyName, vpcPolicy.managedPolicyName, secretsPolicy.managedPolicyName].join(','),
      description: 'Names of managed policies attached by this stack',
    });
  }
}
