const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const snsClient = new SNSClient();

exports.handler = async (event) => {
  const params = {
    TopicArn: process.env.SNS_TOPIC_ARN,
    Message: JSON.stringify({ isRequestForKeepLambdaAlive: true }), // Add the required message
  };

  try {
    const result = await snsClient.send(new PublishCommand(params));
    console.log(`Message sent to SNS: ${result.MessageId}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Message sent to SNS', messageId: result.MessageId }),
    };
  } catch (error) {
    console.error(`Error publishing to SNS: ${error}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to send message to SNS', error: error.message }),
    };
  }
};
