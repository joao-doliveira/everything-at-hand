import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/config/environments';

export interface NotesVpcProps {
  environmentConfig: EnvironmentConfig;
}

export class NotesVpc extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly databaseSubnets: ec2.SubnetSelection;
  public readonly applicationSubnets: ec2.SubnetSelection;
  public readonly publicSubnets: ec2.SubnetSelection;

  constructor(scope: Construct, id: string, props: NotesVpcProps) {
    super(scope, id);
    
    const { environmentConfig } = props;
    
    // Create VPC with public and private subnets
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${environmentConfig.resourcePrefix}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: environmentConfig.environment === 'prod' ? 3 : 2,
      
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      
      // Enable DNS
      enableDnsHostnames: true,
      enableDnsSupport: true,
      
      // NAT Gateways - fewer for cost optimization in non-prod
      natGateways: environmentConfig.environment === 'prod' ? 2 : 1,
    });

    // Define subnet selections for easy reference
    this.publicSubnets = {
      subnetType: ec2.SubnetType.PUBLIC,
    };

    this.applicationSubnets = {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    };

    this.databaseSubnets = {
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    };

    // Create VPC Endpoints for cost optimization (avoid NAT Gateway charges for AWS services)
    this.createVpcEndpoints();

    // Add common security groups
    this.createSecurityGroups();
  }

  private createVpcEndpoints(): void {
    // S3 Gateway Endpoint (free)
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [this.applicationSubnets],
    });

    // DynamoDB Gateway Endpoint (free) - in case you use it later
    this.vpc.addGatewayEndpoint('DynamoDbEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      subnets: [this.applicationSubnets],
    });
  }

  private createSecurityGroups(): void {
    // Database Security Group
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for RDS database',
      securityGroupName: `${this.node.tryGetContext('environmentConfig')?.resourcePrefix || 'eah'}-db-sg`,
    });

    // Application Security Group  
    const appSecurityGroup = new ec2.SecurityGroup(this, 'ApplicationSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for application servers',
      securityGroupName: `${this.node.tryGetContext('environmentConfig')?.resourcePrefix || 'eah'}-app-sg`,
    });

    // Load Balancer Security Group
    const albSecurityGroup = new ec2.SecurityGroup(this, 'LoadBalancerSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Application Load Balancer',
      securityGroupName: `${this.node.tryGetContext('environmentConfig')?.resourcePrefix || 'eah'}-alb-sg`,
    });

    // Configure security group rules
    this.configureSecurityGroupRules(dbSecurityGroup, appSecurityGroup, albSecurityGroup);

    // Store security groups for external access
    (this as any).databaseSecurityGroup = dbSecurityGroup;
    (this as any).applicationSecurityGroup = appSecurityGroup;
    (this as any).loadBalancerSecurityGroup = albSecurityGroup;
  }

  private configureSecurityGroupRules(
    dbSg: ec2.SecurityGroup,
    appSg: ec2.SecurityGroup,
    albSg: ec2.SecurityGroup
  ): void {
    // ALB accepts HTTPS traffic from internet
    albSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'HTTPS from internet'
    );

    // ALB accepts HTTP traffic from internet (for redirect to HTTPS)
    albSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'HTTP from internet (redirect to HTTPS)'
    );

    // Application accepts traffic from ALB
    appSg.addIngressRule(
      albSg,
      ec2.Port.tcp(3000), // Adjust port based on your application
      'HTTP from Load Balancer'
    );

    // Database accepts connections from application
    dbSg.addIngressRule(
      appSg,
      ec2.Port.tcp(5432),
      'PostgreSQL from application'
    );

    // Application can make outbound HTTPS calls (for API calls, package downloads, etc.)
    appSg.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'HTTPS outbound'
    );

    // Application can make outbound HTTP calls 
    appSg.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'HTTP outbound'
    );
  }

  // Getter methods for security groups
  public get databaseSecurityGroup(): ec2.SecurityGroup {
    return (this as any).databaseSecurityGroup;
  }

  public get applicationSecurityGroup(): ec2.SecurityGroup {
    return (this as any).applicationSecurityGroup;
  }

  public get loadBalancerSecurityGroup(): ec2.SecurityGroup {
    return (this as any).loadBalancerSecurityGroup;
  }
}
