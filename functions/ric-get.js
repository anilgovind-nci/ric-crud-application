const { randomUUID } = require('crypto');
// aws-sdk libraries importing.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { CloudWatchLogsClient } = require("@aws-sdk/client-cloudwatch-logs");
// packages importing from layer.
const moment = require("moment");
const validator = require("validator");

const { logToCustomLogGroup } = require('./logToCustomCloudWatch'); 
//The below line is the custom code for adding artificial delay to the lambda cold start.
require('./delayInitialization');
// Create client for DynamoDB and CloudWatch Logs
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDBClient = DynamoDBDocumentClient.from(client);
const cloudWatchLogsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION });
const logGroupName = process.env.CENTRALISED_LOG_GROUP_NAME;

// Unique ID for each Lambda invocation. This need to distinguish the execution environment.
const lambdaExecutionEnvironment = randomUUID(); 
// configuring centralised log group stream.
const logStreamName = `RIC-GET-Stream-${lambdaExecutionEnvironment}`;
// The validateQueryParams function is for validating the incoming request parameters.
const validateQueryParams = (params) => {
  const errors = [];

  if (!params.id || !validator.isInt(params.id)) {
    errors.push("Invalid or missing 'id' (must be an integer)");
  }

  if (!params.pps || !validator.isLength(params.pps, { min: 1 })) {
    errors.push("Invalid or missing 'pps' (must be a non-empty string)");
  }
  return errors;
};
// Lambda handler function. This code block will be invoked by events. Every code written above 
// have to be executed before to start this execution.
const handler = async (event, context) => {
  const requestId = context.awsRequestId;
  const startTime = moment().format();

  // Log the start of the Lambda invocation 
  console.log(`Request ID: ${requestId} - Lambda invoked at ${startTime}`);
  // console.log(`Request ID: ${requestId} - Received event`, event);

  // Create the custom log event object
  const customLogEvent = {
    requestId,
    invocationTime: startTime,
    method: "GET",
    lambda: "ric-crud-application-dev-ricGet"
  };
  // Send the custom log event object to centralised log group.
  await logToCustomLogGroup(cloudWatchLogsClient, logGroupName, logStreamName, customLogEvent);
  if (event.isRequestForKeepLambdaAlive) {
    console.log("This is a keep-alive request.");
    // End the execution for for Lambda warming environments
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Keep-alive request processed successfully." }),
  };
}

  // Fetch Query Parameters from the incoming request.
  const { id, pps } = event.queryStringParameters || {};
  // Call Validation function to validate.
  const validationErrors = validateQueryParams({ id, pps });

  if (validationErrors.length > 0) {
    console.warn(
      `Request ID: ${requestId} - Validation failed: ${validationErrors.join(", ")}`
    );
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Validation failed",
        details: validationErrors,
      }),
    };
  }
// create connection parameter for DynamoDB
  const params = {
    TableName: "RIC-EMPLOYEEE-TABLE",
    Key: {
      employeeId: id,
      ppsNumber: pps,
    },
  };

  try {
    const data = await dynamoDBClient.send(new GetCommand(params));

    if (!data.Item) {
      console.warn(`Request ID: ${requestId} - Item not found`, { params });
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Item not found" }),
      };
    }

    const endTime = moment().format();
    // calculating duration
    const duration = moment(endTime).diff(moment(startTime), "milliseconds");
    console.log(
      `Request ID: ${requestId} - Item retrieved successfully. Execution time: ${duration}ms`,
      { item: data.Item }
    );
   // return success message
    return {
      statusCode: 200,
      body: JSON.stringify(data.Item),
    };
  } catch (error) {
    console.error(`Request ID: ${requestId} - Error retrieving item`, {
      error: error.message,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Could not retrieve item",
        message: error.message,
        requestId,
      }),
    };
  }
};
// Export handler as the Lambda function entry point
module.exports.handler = handler;
