import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { AuthorizationType, CognitoUserPoolsAuthorizer, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { CfnIdentityPool, CfnIdentityPoolRoleAttachment, UserPool, UserPoolClientIdentityProvider, VerificationEmailStyle } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { HttpMethod } from 'aws-cdk-lib/aws-events';
import { FederatedPrincipal, Role } from 'aws-cdk-lib/aws-iam';
import { AssetCode, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvocationType, LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export class BrianAwsCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Create a DynamoDB table
    const dynamodbTable = new Table(this, 'DynamoDbTable', {
      tableName: 'dynamo-db-table',
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      // sortKey: {
      //   name: 'timestamp',
      //   type: AttributeType.STRING,
      // },
    });

    //Add global secondary index to table
    dynamodbTable.addGlobalSecondaryIndex({
      indexName: 'indexName',
      partitionKey: {
        name: 'fullName',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: AttributeType.STRING,
      },
    });

    //Create S3 Bucket
    const s3Bucket = new Bucket(this, 'S3Bucket', {
      bucketName: 'brian-unique-s3-bucket-12345',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    //Create Cognito user pool
    const userPool = new UserPool(this, 'CognitoUserPool', {
      userPoolName: 'cognito-user-pool',
      userVerification: {
        emailSubject: 'Verify your account',
        emailBody: 'Your username is {username} and password is {####}. Verify your account by clicking on {##Verify Email##}.',
        emailStyle: VerificationEmailStyle.LINK,
      },
      signInAliases: {
        username: true,
        phone: true,
        email: true,
        preferredUsername: true,
      },
      standardAttributes: {
        givenName: {
          mutable: true,
          required: true,
        },
        middleName: {
          mutable: true,
          required: false,
        },
        familyName: {
          mutable: true,
          required: true,
        },
        phoneNumber: {
          mutable: true,
          required: true,
        },
        lastUpdateTime: {
          mutable: true,
          required: false,
        },
        email: {
          mutable: false,
          required: true,
        },
      },
      passwordPolicy: {
        tempPasswordValidity: Duration.hours(24),
      },
    });

    //Add dodmain to cognito user pool
    userPool.addDomain('CognitoDomain', {
      cognitoDomain: { domainPrefix: 'brian-cdk' },
    });

    //Add client to cognito user pool
    const userPoolClient = userPool.addClient('CognitoClient', {
      userPoolClientName: 'cognito-client',
      supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
      authFlows: {
        userPassword: true,
      },
    });

    const userIdentityPool = new CfnIdentityPool(this, 'UserIdentityPool', {
      identityPoolName: 'user-identity-pool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    const identityPoolAuthenticatedRole = new Role(this, 'IdentityPoolAuthenticatedRole', {
      roleName: 'identity-pool-authenticated-role',
      assumedBy: new FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': userIdentityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    });

    new CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: userIdentityPool.ref,
      roles: {
        authenticated: identityPoolAuthenticatedRole.roleArn,
      },
      roleMappings: {
        mapping: {
          type: 'Token',
          ambiguousRoleResolution: 'AuthenticatedRole',
          identityProvider: `cognito-idp.${
            Stack.of(this).region
          }.amazonaws.com/${userPool.userPoolId}:${
            userPoolClient.userPoolClientId
          }`,
        },
      },
    });

    //Add lambda function
    const lambdaOne = new Function(this, 'LambdaOne', {
      functionName: 'lambda-one',
      runtime: Runtime.NODEJS_18_X,
      code: new AssetCode('./build'),
      handler: 'lambda-one.handler',
      timeout: Duration.minutes(1),
      memorySize: 128,
      environment: {
        DYNAMO_DB_TABLE_NAME: dynamodbTable.tableName,
        S3_BUCKET_NAME: s3Bucket.bucketName,
      },
    });
    dynamodbTable.grantFullAccess(lambdaOne);
    // dynamodbTable.grantReadData(lambdaOne);
    // dynamodbTable.grantWriteData(lambdaOne);
    s3Bucket.grantReadWrite(lambdaOne);
    // process.env.DYNAMO_DB_TABLE_NAME

    //Add lambda function
    const lambdaTwo = new Function(this, 'LambdaTwo', {
      functionName: 'lambda-two',
      runtime: Runtime.NODEJS_18_X,
      code: new AssetCode('./build'),
      handler: 'lambda-two.handler',
      timeout: Duration.minutes(1),
      memorySize: 128,
      environment: {
        DYNAMO_DB_TABLE_NAME: dynamodbTable.tableName,
        S3_BUCKET_NAME: s3Bucket.bucketName,
      },
    });
    dynamodbTable.grantFullAccess(lambdaTwo);
    s3Bucket.grantReadWrite(lambdaTwo);

    //TODO: Add api-gateway resource
    const restApi = new RestApi(this, 'RestApi', {
      restApiName: 'rest-api',
      deploy: true,
      deployOptions: {
        stageName: 'prod',
      },
    });

    const authorizer = new CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool],
    });

    const lambdaOneIntegration = new LambdaIntegration(lambdaOne)
    const endpointOne = restApi.root.addResource('endpoint-one');
    endpointOne.addMethod(
      HttpMethod.GET,
      lambdaOneIntegration,
      {
        authorizer: authorizer,
        authorizationType: AuthorizationType.COGNITO,
      }
    );

    const lambdaTwoIntegration = new LambdaIntegration(lambdaTwo)
    const endpointTwo = restApi.root.addResource('endpoint-two');
    endpointTwo.addMethod(
      HttpMethod.GET,
      lambdaTwoIntegration,
      {
        authorizer: authorizer,
        authorizationType: AuthorizationType.COGNITO,
      }
    );

    //Step Functions
    const stepOne = new Function(this, 'LambdaStepOne', {
      functionName: 'step-one',
      runtime: Runtime.NODEJS_18_X,
      code: new AssetCode('./build'),
      handler: 'step-one.handler',
      timeout: Duration.minutes(1),
      memorySize: 128,
    });

    const stepTwo = new Function(this, 'LambdaStepTwo', {
      functionName: 'step-two',
      runtime: Runtime.NODEJS_18_X,
      code: new AssetCode('./build'),
      handler: 'step-two.handler',
      timeout: Duration.minutes(1),
      memorySize: 128,
    });

    const stepThree = new Function(this, 'LambdaStepThree', {
      functionName: 'step-three',
      runtime: Runtime.NODEJS_18_X,
      code: new AssetCode('./build'),
      handler: 'step-three.handler',
      timeout: Duration.minutes(1),
      memorySize: 128,
    });

    const executeStepOne = new LambdaInvoke(this, 'ExecuteStepOne', {
      lambdaFunction: stepOne,
      invocationType: LambdaInvocationType.REQUEST_RESPONSE,
      inputPath: '$',
      outputPath: '$.Payload',
    });

    const executeStepTwo = new LambdaInvoke(this, 'ExecuteStepTwo', {
      lambdaFunction: stepTwo,
      invocationType: LambdaInvocationType.REQUEST_RESPONSE,
      inputPath: '$',
      outputPath: '$.Payload',
    });

    const executeStepThree = new LambdaInvoke(this, 'ExecuteStepThree', {
      lambdaFunction: stepThree,
      invocationType: LambdaInvocationType.REQUEST_RESPONSE,
      inputPath: '$',
      outputPath: '$.Payload',
    });

    const definition = executeStepOne
      .next(executeStepTwo)
      .next(executeStepThree);

    new StateMachine(this, 'StateMachine', {
      stateMachineName: 'state-machine',
      definition,
      timeout: Duration.minutes(5),
    });
  }
}
