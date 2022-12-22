# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template


## Setup AWS Credentials
export AWS_ACCESS_KEY_ID=CHANGEME
export AWS_SECRET_ACCESS_KEY=CHANGEME
export AWS_DEFAULT_REGION=us-east-1

## Get JWT Token
aws cognito-idp initiate-auth \
  --client-id 6frp5idm5phethtfjptip13r56 \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=brian,PASSWORD=brian.123456 \
  --query 'AuthenticationResult.IdToken' \
  --output text

## Test API Authorization (use JWT_TOKEN generatedd from above step)
curl -H "Authorization: Bearer
JWT_TOKEN" https://j07xt494i3.execute-api.us-east-1.amazonaws.com/prod/endpoint-one

## Cognito login UI
https://brian-cdk.auth.us-east-1.amazoncognito.com/login?client_id=6frp5idm5phethtfjptip13r56&response_type=code&scope=aws.cognito.signin.user.admin+email+openid+phone+profile&redirect_uri=https://example.com
