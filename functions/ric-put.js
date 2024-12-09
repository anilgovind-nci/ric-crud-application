// aws-sdk libraries importing.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { CloudWatchLogsClient } = require("@aws-sdk/client-cloudwatch-logs");

// packages importing from layer.
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");

const { logToCustomLogGroup } = require("./logToCustomCloudWatch");
const { randomUUID } = require("crypto");

// Unique ID for each Lambda invocation. This is used to distinguish the execution environment.
const lambdaExecutionEnvironment = randomUUID();

// Configuring centralized log group stream.
const logGroupName = process.env.CENTRALISED_LOG_GROUP_NAME;
const logStreamName = `RIC-PUT-Stream-${lambdaExecutionEnvironment}`;

// The below line is the custom code for adding artificial delay to the Lambda cold start.
require('./delayInitialization');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Initialize DynamoDB and CloudWatch Logs clients
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDBClient = DynamoDBDocumentClient.from(client);
const cloudWatchLogsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION });

// Set up Winston logger for logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta) : ""
      }`;
    })
  ),
  transports: [new winston.transports.Console()],
});

// The validateUpdateData function is for validating the incoming request parameters.
const validateUpdateData = (data) => {
  const errors = [];
  if (!data.id || !validator.isInt(data.id)) {
    errors.push("Invalid or missing 'id' (must be a valid UUID)");
  }
  if (!data.pps || !validator.isLength(data.pps, { min: 1 })) {
    errors.push("Invalid or missing 'pps' (must be a non-empty string)");
  }
  if (data.age !== undefined && !validator.isInt(data.age.toString(), { min: 0 })) {
    errors.push("'age' must be a non-negative integer");
  }
  return errors;
};

// Lambda handler function. This code block will be invoked by events. Every code written above 
// has to be executed before starting this execution.
const handler = async (event, context) => {
  const requestId = context.awsRequestId; // Unique ID for each Lambda invocation
  const startTime = moment().format(); // Start time for logging execution duration

  // Create the custom log event object
  const customLogEvent = {
    requestId,
    invocationTime: startTime,
    method: "PUT",
    lambda: "ric-crud-application-dev-ricPut"
  };

  // Send the custom log event object to the centralized log group.
  await logToCustomLogGroup(cloudWatchLogsClient, logGroupName, logStreamName, customLogEvent);
  // The below code block is for detecting the lambda warming request
  if (event.isRequestForKeepLambdaAlive) {
    console.log("This is a keep-alive request.");
    // stop execution for lambda warming request
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Keep-alive request processed successfully." }),
    };
  }

  // Log Lambda invocation to logger
  logger.info(`Request ID: ${requestId} - Lambda invoked at ${startTime}`);
  logger.info(`Request ID: ${requestId} - Received event`, { event });

  // Parse and validate the request body received from the request.
  let updateData;
  try {
    updateData = JSON.parse(event.body);
    logger.info(`Request ID: ${requestId} - Parsed request body`, { body: event.body });
  } catch (error) {
    logger.error(`Request ID: ${requestId} - Invalid JSON in request body`, { error: error.message });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  // Send response if validation failed
  const validationErrors = validateUpdateData(updateData);
  if (validationErrors.length > 0) {
    logger.warn(`Request ID: ${requestId} - Validation failed: ${validationErrors.join(", ")}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Validation failed", details: validationErrors }),
    };
  }

  // Extract and prepare update parameters
  const { id, pps, name, age, position } = updateData;
  const updateExpressions = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  if (name) {
    updateExpressions.push("#name = :name");
    expressionAttributeNames["#name"] = "name";
    expressionAttributeValues[":name"] = name;
  }
  if (typeof age !== "undefined") {
    updateExpressions.push("age = :age");
    expressionAttributeValues[":age"] = age;
  }
  if (position) {
    updateExpressions.push("#position = :position");
    expressionAttributeNames["#position"] = "position";
    expressionAttributeValues[":position"] = position;
  }

  if (updateExpressions.length === 0) {
    logger.warn(`Request ID: ${requestId} - No attributes provided to update`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "No attributes provided to update" }),
    };
  }
  // Prepare parameters for updating DynamoDB
  const params = {
    TableName: "RIC-EMPLOYEEE-TABLE",
    Key: {
      employeeId: id,
      ppsNumber: pps,
    },
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames,
    ReturnValues: "ALL_NEW",
  };

  try {
    // Update item in DynamoDB
    const data = await dynamoDBClient.send(new UpdateCommand(params));
    // Calculate the time taken
    const endTime = moment().format();
    const duration = moment(endTime).diff(moment(startTime), "milliseconds");
    // Log success
    logger.info(
      `Request ID: ${requestId} - Item updated successfully. Execution time: ${duration}ms`,
      { updatedItem: data.Attributes }
    );
    // Return update success response to client
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Item updated successfully", updatedItem: data.Attributes }),
    };
  } 
  // Log error
  catch (error) {
    logger.error(`Request ID: ${requestId} - Error updating item`, { error: error.message });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Could not update item",
        message: error.message,
        requestId,
      }),
    };
  }
};

// Export the handler
module.exports.handler = handler;
