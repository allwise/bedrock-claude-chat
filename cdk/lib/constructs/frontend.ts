import { Construct } from "constructs";
import { CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  IBucket,
} from "aws-cdk-lib/aws-s3";
import {
  CloudFrontWebDistribution,
  OriginAccessIdentity, ViewerCertificate,
} from "aws-cdk-lib/aws-cloudfront";
import { NodejsBuild } from "deploy-time-build";
import { Idp } from "../utils/identity-provider";
import { NagSuppressions } from "cdk-nag";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { ARecord, PublicHostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";


export interface FrontendProps {
  readonly webAclId: string;
  readonly enableMistral: boolean;
  readonly enableKB: boolean;
  readonly accessLogBucket?: IBucket;
  readonly enableIpV6: boolean;
  readonly certificateArn: string;
  readonly hostedZoneId: string;
  readonly domain: string;
  readonly subDomain: string;
  readonly userPoolId: string;
  readonly userPoolClientId: string;

}

export class Frontend extends Construct {
  readonly cloudFrontWebDistribution: CloudFrontWebDistribution;
  readonly assetBucket: Bucket;
  constructor(scope: Construct, id: string, props: FrontendProps) {
    super(scope, id);

    const assetBucket = new Bucket(this, "AssetBucket", {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      serverAccessLogsBucket: props.accessLogBucket,
      serverAccessLogsPrefix: "AssetBucket",
    });

    const certificate = Certificate.fromCertificateArn(
        this,
        "Certificate",
        props.certificateArn
    )

    const originAccessIdentity = new OriginAccessIdentity(
      this,
      "OriginAccessIdentity"
    );
    const distribution = new CloudFrontWebDistribution(this, "Distribution", {
      viewerCertificate: ViewerCertificate.fromAcmCertificate(certificate, {
        aliases: [`${props.subDomain}.${props.domain}`],
      }),

      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: assetBucket,
            originAccessIdentity,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
            },
          ],
        },
      ],
      errorConfigurations: [
        {
          errorCode: 404,
          errorCachingMinTtl: 0,
          responseCode: 200,
          responsePagePath: "/",
        },
        {
          errorCode: 403,
          errorCachingMinTtl: 0,
          responseCode: 200,
          responsePagePath: "/",
        },
      ],
      ...( {
        loggingConfig: {
          bucket: props.accessLogBucket,
          prefix: "Frontend/",
        },
      }),
      webACLId: props.webAclId,
      enableIpV6: props.enableIpV6,
    });

    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: "AwsPrototyping-CloudFrontDistributionGeoRestrictions",
        reason: "this asset is being used all over the world",
      },
    ]);

    // Create a Route 53 hosted zone and record for your custom domain
    const hostedZone = PublicHostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      zoneName: props.domain,
      hostedZoneId: props.hostedZoneId
    })

    new ARecord(this, 'WebsiteAliasRecord', {
      zone: hostedZone,
      recordName: `${props.subDomain}.${props.domain}`,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    this.assetBucket = assetBucket;
    this.cloudFrontWebDistribution = distribution;
  }

  getOrigin(): string {
    return `https://${this.cloudFrontWebDistribution.distributionDomainName}`;
  }

  buildViteApp({
    backendApiEndpoint,
    webSocketApiEndpoint,
    userPoolDomainPrefix,
    cognitoRegion,
    userPoolId,
    userPoolClientId,
    enableMistral,
    enableKB,
    idp,
  }: {
    backendApiEndpoint: string;
    webSocketApiEndpoint: string;
    userPoolDomainPrefix: string;
    cognitoRegion: string;
    userPoolId: string;
    userPoolClientId: string;
    enableMistral: boolean;
    enableKB: boolean;
    idp: Idp;
  }) {
    const cognitoDomain = `${userPoolDomainPrefix}.auth.${cognitoRegion}.amazoncognito.com/`;
    const buildEnvProps = (() => {
      const defaultProps = {
        VITE_APP_API_ENDPOINT: backendApiEndpoint,
        VITE_APP_WS_ENDPOINT: webSocketApiEndpoint,
        VITE_APP_USER_POOL_ID: userPoolId,
        VITE_APP_USER_POOL_CLIENT_ID: userPoolClientId,
        VITE_APP_ENABLE_MISTRAL: enableMistral.toString(),
        VITE_APP_ENABLE_KB: enableKB.toString(),
        VITE_APP_USE_STREAMING: "true",
      };

      if (!idp.isExist()) return defaultProps;

      const oAuthProps = {
        VITE_APP_REDIRECT_SIGNIN_URL: this.getOrigin(),
        VITE_APP_REDIRECT_SIGNOUT_URL: this.getOrigin(),
        VITE_APP_COGNITO_DOMAIN: cognitoDomain,
        VITE_APP_SOCIAL_PROVIDERS: idp.getSocialProviders(),
        VITE_APP_CUSTOM_PROVIDER_ENABLED: idp
          .checkCustomProviderEnabled()
          .toString(),
        VITE_APP_CUSTOM_PROVIDER_NAME: idp.getCustomProviderName(),
      };
      return { ...defaultProps, ...oAuthProps };
    })();

    new NodejsBuild(this, "ReactBuild", {
      assets: [
        {
          path: "../frontend",
          exclude: [
            "node_modules",
            "dist",
            "dev-dist",
            ".env",
            ".env.local",
            "../cdk/**/*",
            "../backend/**/*",
            "../example/**/*",
            "../docs/**/*",
            "../.github/**/*",
          ],
          commands: ["npm ci"],
        },
      ],
      buildCommands: ["npm run build"],
      buildEnvironment: buildEnvProps,
      destinationBucket: this.assetBucket,
      distribution: this.cloudFrontWebDistribution,
      outputSourceDirectory: "dist",
    });

    if (idp.isExist()) {
      new CfnOutput(this, "CognitoDomain", { value: cognitoDomain });
      new CfnOutput(this, "SocialProviders", {
        value: idp.getSocialProviders(),
      });
    }
  }

}
