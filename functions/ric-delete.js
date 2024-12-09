const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { CloudWatchLogsClient } = require("@aws-sdk/client-cloudwatch-logs");
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");
const { logToCustomLogGroup } = require("./logToCustomCloudWatch");
const { randomUUID } = require("crypto");
const logGroupName = process.env.CENTRALISED_LOG_GROUP_NAME;
// const LOG_GROUP_NAME = "RIC-CRUD-log-group";
const lambdaExecutionEnvironment = randomUUID(); // Unique ID for each Lambda invocation
const logStreamName = `RIC-DELETE-Stream-${lambdaExecutionEnvironment}`; // Unique stream name

require('./delayInitialization');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Initialize DynamoDB and CloudWatch Logs clients
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDBClient = DynamoDBDocumentClient.from(client);
const cloudWatchLogsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION });

// Set up Winston logger
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

// Validate input data
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
// Lambda handler
const handler = async (event, context) => {
  
  // await delay(500);
  const requestId = context.awsRequestId;
  const startTime = moment().format();

  // Log to custom CloudWatch log group
  const customLogEvent = {
    requestId,
    invocationTime: startTime,
    method: "DELETE",
    lambda: "ric-crud-application-dev-ricDelete"
  };
  await logToCustomLogGroup(cloudWatchLogsClient, logGroupName, logStreamName, customLogEvent);
  if (event.isRequestForKeepLambdaAlive) {
    console.log("This is a keep-alive request.");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Keep-alive request processed successfully." }),
  };
}
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

  const validationErrors = validateDeleteData(deleteData);
  if (validationErrors.length > 0) {
    logger.warn(`Request ID: ${requestId} - Validation failed: ${validationErrors.join(", ")}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Validation failed", details: validationErrors }),
    };
  }

  const { id, pps } = deleteData;

  // DynamoDB parameters for deletion
  const params = {
    TableName: "RIC-EMPLOYEEE-TABLE",
    Key: {
      employeeId: id,
      ppsNumber: pps,
    },
    ReturnValues: "ALL_OLD", // Returns the deleted item attributes
  };

  try {
    // Delete the item from DynamoDB
    const data = await dynamoDBClient.send(new DeleteCommand(params));

    if (!data.Attributes) {
      logger.warn(`Request ID: ${requestId} - Item not found`, { params });
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Item not found" }),
      };
    }

    const endTime = moment().format();
    const duration = moment(endTime).diff(moment(startTime), "milliseconds");
    logger.info(
      `Request ID: ${requestId} - Item deleted successfully. Execution time: ${duration}ms`,
      { deletedItem: data.Attributes }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Item deleted successfully", deletedItem: data.Attributes }),
    };
  } catch (error) {
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

module.exports.handler = handler;
