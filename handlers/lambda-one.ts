import { Context, APIGatewayEvent, APIGatewayProxyCallback } from 'aws-lambda';

export const handler = (event: APIGatewayEvent, context: Context, callback: APIGatewayProxyCallback) => {
  callback(null, {
    statusCode: 200,
    body: JSON.stringify({
      message: 'lambda one',
    }),
  });
};
