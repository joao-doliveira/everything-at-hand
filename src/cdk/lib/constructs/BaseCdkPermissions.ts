import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface BaseCdkPermissionsProps {
  deploymentRole: iam.IRole;
  environment: 'preprod' | 'prod';
  accountId: string;
  region: string;
}

/**
 * Construct that attaches base CDK deployment permissions to a role
 * These are the core permissions needed for any CDK deployment
 */
export class BaseCdkPermissions extends Construct {
  constructor(scope: Construct, id: string, props: BaseCdkPermissionsProps) {
    super(scope, id);

    const { deploymentRole, environment, accountId, region } = props;

    // CDK Bootstrap permissions - ability to assume CDK execution roles
    const cdkBootstrapPolicy = new iam.ManagedPolicy(this, 'CdkBootstrapPolicy', {
      managedPolicyName: `EAH-CDK-Bootstrap-${environment}-${this.node.addr}`,
      description: `CDK bootstrap permissions for ${environment}`,
      statements: [
        new iam.PolicyStatement({
          sid: 'AssumeBootstrapRoles',
          effect: iam.Effect.ALLOW,
          actions: ['sts:AssumeRole'],
          resources: [
            `arn:aws:iam::${accountId}:role/cdk-*-cfn-exec-role-*`,
            `arn:aws:iam::${accountId}:role/cdk-*-deploy-role-*`,
            `arn:aws:iam::${accountId}:role/cdk-*-file-publishing-role-*`,
            `arn:aws:iam::${accountId}:role/cdk-*-image-publishing-role-*`,
            `arn:aws:iam::${accountId}:role/cdk-*-lookup-role-*`,
          ],
          conditions: {
            StringEquals: {
              'aws:RequestedRegion': [region],
            },
          },
        }),
      ],
    });

    // CloudFormation permissions for CDK operations
    const cloudFormationPolicy = new iam.ManagedPolicy(this, 'CloudFormationPolicy', {
      managedPolicyName: `EAH-CDK-CloudFormation-${environment}-${this.node.addr}`,
      description: `CloudFormation permissions for ${environment} CDK operations`,
      statements: [
        new iam.PolicyStatement({
          sid: 'CloudFormationAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            'cloudformation:DescribeStacks',
            'cloudformation:DescribeStackEvents',
            'cloudformation:DescribeStackResources',
            'cloudformation:DescribeStackResource',
            'cloudformation:GetTemplate',
            'cloudformation:ListStackResources',
            'cloudformation:ListStacks',
            'cloudformation:CreateChangeSet',
            'cloudformation:DescribeChangeSet',
            'cloudformation:ExecuteChangeSet',
            'cloudformation:DeleteChangeSet',
            'cloudformation:CreateStack',
            'cloudformation:UpdateStack',
            'cloudformation:DeleteStack',
            'cloudformation:TagResource',
            'cloudformation:UntagResource',
            'cloudformation:ListTagsForResource',
          ],
          resources: [
            `arn:aws:cloudformation:${region}:${accountId}:stack/Notes*/*`,
            `arn:aws:cloudformation:${region}:${accountId}:stack/BaseCdkPermissionsStack/*`,
            `arn:aws:cloudformation:${region}:${accountId}:stack/CDKToolkit/*`,
          ],
        }),
      ],
    });

    // S3 permissions for CDK assets
    const s3AssetsPolicy = new iam.ManagedPolicy(this, 'S3AssetsPolicy', {
      managedPolicyName: `EAH-CDK-S3Assets-${environment}-${this.node.addr}`,
      description: `S3 assets permissions for ${environment} CDK operations`,
      statements: [
        new iam.PolicyStatement({
          sid: 'S3AssetsAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:GetObjectVersion',
            's3:PutObject',
            's3:PutObjectAcl',
            's3:DeleteObject',
            's3:ListBucket',
            's3:GetBucketLocation',
          ],
          resources: [
            `arn:aws:s3:::cdk-*-assets-${accountId}-${region}`,
            `arn:aws:s3:::cdk-*-assets-${accountId}-${region}/*`,
          ],
        }),
      ],
    });

    // SSM Parameter Store access for CDK context values
    const ssmPolicy = new iam.ManagedPolicy(this, 'SSMPolicy', {
      managedPolicyName: `EAH-CDK-SSM-${environment}-${this.node.addr}`,
      description: `SSM permissions for ${environment} CDK operations`,
      statements: [
        new iam.PolicyStatement({
          sid: 'SSMParameterAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            'ssm:GetParameter',
            'ssm:GetParameters',
            'ssm:GetParametersByPath',
          ],
          resources: [
            `arn:aws:ssm:${region}:${accountId}:parameter/cdk-bootstrap/*`,
          ],
        }),
      ],
    });

    // ECR permissions for CDK Docker assets
    const ecrPolicy = new iam.ManagedPolicy(this, 'ECRPolicy', {
      managedPolicyName: `EAH-CDK-ECR-${environment}-${this.node.addr}`,
      description: `ECR permissions for ${environment} CDK operations`,
      statements: [
        new iam.PolicyStatement({
          sid: 'ECRAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            'ecr:GetAuthorizationToken',
            'ecr:BatchCheckLayerAvailability',
            'ecr:GetDownloadUrlForLayer',
            'ecr:BatchGetImage',
            'ecr:DescribeRepositories',
            'ecr:ListImages',
            'ecr:DescribeImages',
            'ecr:BatchDeleteImage',
            'ecr:InitiateLayerUpload',
            'ecr:UploadLayerPart',
            'ecr:CompleteLayerUpload',
            'ecr:PutImage',
          ],
          resources: [
            `arn:aws:ecr:${region}:${accountId}:repository/cdk-*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'ECRTokenAccess',
          effect: iam.Effect.ALLOW,
          actions: ['ecr:GetAuthorizationToken'],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'aws:RequestedRegion': [region],
            },
          },
        }),
      ],
    });

    // EC2 permissions for minimal VPC operations
    const ec2Policy = new iam.ManagedPolicy(this, 'EC2Policy', {
      managedPolicyName: `EAH-CDK-EC2-${environment}-${this.node.addr}`,
      description: `EC2 permissions for ${environment} CDK operations`,
      statements: [
        new iam.PolicyStatement({
          sid: 'EC2MinimalVPCAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            // VPC operations
            'ec2:CreateVpc',
            'ec2:DeleteVpc',
            'ec2:DescribeVpcs',
            'ec2:ModifyVpcAttribute',
            // Subnet operations
            'ec2:CreateSubnet',
            'ec2:DeleteSubnet',
            'ec2:DescribeSubnets',
            'ec2:ModifySubnetAttribute',
            // Route table operations
            'ec2:CreateRouteTable',
            'ec2:DeleteRouteTable',
            'ec2:DescribeRouteTables',
            'ec2:AssociateRouteTable',
            'ec2:DisassociateRouteTable',
            // Security group operations (for RDS)
            'ec2:CreateSecurityGroup',
            'ec2:DeleteSecurityGroup',
            'ec2:DescribeSecurityGroups',
            'ec2:AuthorizeSecurityGroupIngress',
            'ec2:AuthorizeSecurityGroupEgress',
            'ec2:RevokeSecurityGroupIngress',
            'ec2:RevokeSecurityGroupEgress',
            // General describe operations
            'ec2:DescribeAvailabilityZones',
            'ec2:DescribeAccountAttributes',
            // Tagging
            'ec2:CreateTags',
            'ec2:DeleteTags',
            'ec2:DescribeTags',
          ],
          resources: ['*'], // EC2 operations often require * resource
          conditions: {
            StringEquals: {
              'aws:RequestedRegion': [region],
            },
          },
        }),
      ],
    });

    // Attach all base CDK policies to the deployment role
    deploymentRole.addManagedPolicy(cdkBootstrapPolicy);
    deploymentRole.addManagedPolicy(cloudFormationPolicy);
    deploymentRole.addManagedPolicy(s3AssetsPolicy);
    deploymentRole.addManagedPolicy(ssmPolicy);
    deploymentRole.addManagedPolicy(ecrPolicy);
    deploymentRole.addManagedPolicy(ec2Policy);
  }
}
