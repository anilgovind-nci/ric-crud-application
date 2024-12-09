// aws-sdk libraries importing.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { CloudWatchLogsClient } = require("@aws-sdk/client-cloudwatch-logs");


// packages importing from layer.
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");


const { logToCustomLogGroup } = require("./logToCustomCloudWatch");
const { randomUUID } = require("crypto");

// Generate a unique ID for the Lambda execution environment
const lambdaExecutionEnvironment = randomUUID();

// Centralized log group and stream configuration
const logGroupName = process.env.CENTRALISED_LOG_GROUP_NAME;
const logStreamName = `RIC-DELETE-Stream-${lambdaExecutionEnvironment}`;

// Include the delay initialization utility
require('./delayInitialization');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Initialize DynamoDB and CloudWatch Logs clients
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDBClient = DynamoDBDocumentClient.from(client);
const cloudWatchLogsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION });

// Configure Winston logger for structured and timestamped logging
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

// Function to validate incoming request data for deletion
const validateDeleteData = (data) => {
  const errors = [];
  if (!data.id || !validator.isInt(data.id)) {
    errors.push("Invalid or missing 'id' (must be a valid UUID)");
  }
  if (!data.pps || !validator.isLength(data.pps, { min: 1 })) {
    errors.push("Invalid or missing 'pps' (must be a non-empty string)");
  }
  return errors;
};

// Lambda handler function - entry point for the DELETE operation
const handler = async (event, context) => {
  // Unique request ID for tracing
  const requestId = context.awsRequestId;
  // Capture the start time for execution metrics
  const startTime = moment().format(); 

  // Create a custom log event for tracking
  const customLogEvent = {
    requestId,
    invocationTime: startTime,
    method: "DELETE",
    lambda: "ric-crud-application-dev-ricDelete",
  };

  // Log the custom event to a centralized CloudWatch log group
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

  // Log the incoming event
  logger.info(`Request ID: ${requestId} - Lambda invoked at ${startTime}`);
  logger.info(`Request ID: ${requestId} - Received event`, { event });

  // Parse and validate the request body
  let deleteData;
  try {
    deleteData = JSON.parse(event.body);
    logger.info(`Request ID: ${requestId} - Parsed request body`, { body: event.body });
  } catch (error) {
    logger.error(`Request ID: ${requestId} - Invalid JSON in request body`, { error: error.message });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  // Validate the parsed data
  const validationErrors = validateDeleteData(deleteData);
  if (validationErrors.length > 0) {
    logger.warn(`Request ID: ${requestId} - Validation failed: ${validationErrors.join(", ")}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Validation failed", details: validationErrors }),
    };
  }

  // Extract the `id` and `pps` attributes from the request
  const { id, pps } = deleteData;

  // Define the parameters for the DynamoDB delete operation
  const params = {
    TableName: "RIC-EMPLOYEEE-TABLE",
    Key: {
      employeeId: id,
      ppsNumber: pps,
    },
    ReturnValues: "ALL_OLD",
  };

  try {
    // Execute the delete operation in DynamoDB
    const data = await dynamoDBClient.send(new DeleteCommand(params));

    // If no item was deleted, return a 404 error
    if (!data.Attributes) {
      logger.warn(`Request ID: ${requestId} - Item not found`, { params });
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Item not found" }),
      };
    }

    // Calculate the duration of the operation
    const endTime = moment().format();
    const duration = moment(endTime).diff(moment(startTime), "milliseconds");

    // Log the success response
    logger.info(
      `Request ID: ${requestId} - Item deleted successfully. Execution time: ${duration}ms`,
      { deletedItem: data.Attributes }
    );

    // Return a success response with the deleted item's details
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Item deleted successfully", deletedItem: data.Attributes }),
    };
  } catch (error) {
    // Handle errors during the delete operation
    logger.error(`Request ID: ${requestId} - Error deleting item`, { error: error.message });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Could not delete item",
        message: error.message,
        requestId,
      }),
    };
  }
};
// Export the handler function
module.exports.handler = handler;
