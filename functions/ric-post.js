const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");
const { logToCustomLogGroup } = require("./logToCustomCloudWatch");
const { CloudWatchLogsClient } = require("@aws-sdk/client-cloudwatch-logs");
const cloudWatchLogsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION });

const { randomUUID } = require('crypto');
// const LOG_GROUP_NAME = "RIC-CRUD-log-group";
const logGroupName = process.env.CENTRALISED_LOG_GROUP_NAME;
const lambdaExecutionEnvironment = randomUUID(); // Unique ID for each Lambda invocation
const logStreamName = `RIC-POST-Stream-${lambdaExecutionEnvironment}`; // Unique stream name

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

// Create DynamoDB client and document client
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDBClient = DynamoDBDocumentClient.from(client);

// Function to validate input
const validateInput = (data) => {
  const errors = [];

  if (!data.id || !validator.isInt(data.id)) {
    errors.push("Invalid or missing 'id' (must be a valid integer)");
  }

  if (!data.pps || !validator.isAlphanumeric(data.pps)) {
    errors.push("Invalid or missing 'pps' (must be alphanumeric)");
  }

  if (!data.name || !validator.isLength(data.name, { min: 1 })) {
    errors.push("Invalid or missing 'name' (must be a non-empty string)");
  }

  if (typeof data.age === "undefined" || !validator.isInt(data.age.toString(), { min: 0 })) {
    errors.push("Invalid or missing 'age' (must be a non-negative integer)");
  }

  if (!data.position || !validator.isLength(data.position, { min: 1 })) {
    errors.push("Invalid or missing 'position' (must be a non-empty string)");
  }

  return errors;
};

// Lambda handler function
const handler = async (event, context) => {
  const requestId = context.awsRequestId;
  const startTime = moment().format();

// Send custom log to the log group
const customLogEvent = {
  requestId,
  invocationTime: startTime,
  method:"POST",
  lambda: "ric-crud-application-dev-ricPost"
};
await logToCustomLogGroup(cloudWatchLogsClient, logGroupName, logStreamName, customLogEvent);
if (event.isRequestForKeepLambdaAlive) {
  console.log("This is a keep-alive request.");
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Keep-alive request processed successfully." }),
};
}

  // Log Lambda invocation
  logger.info(`Request ID: ${requestId} - Lambda invoked at ${startTime}`);

  // Parse and validate the request body
  let item;
  try {
    item = JSON.parse(event.body);
    logger.info(`Request ID: ${requestId} - Parsed request body`, { body: event.body });
  } catch (error) {
    logger.error(`Request ID: ${requestId} - Invalid JSON in request body`, { error: error.message });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  const validationErrors = validateInput(item);
  if (validationErrors.length > 0) {
    logger.warn(`Request ID: ${requestId} - Validation failed: ${validationErrors.join(", ")}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Validation failed", details: validationErrors }),
    };
  }

  // DynamoDB parameters
  const { id, pps, name, age, position } = item;
  const params = {
    TableName: "RIC-EMPLOYEEE-TABLE",
    Item: {
      employeeId: id,
      ppsNumber: pps,
      name,
      age,
      position,
    },
  };

  try {
    // Insert data into DynamoDB
    await dynamoDBClient.send(new PutCommand(params));

    const endTime = moment().format();
    const duration = moment(endTime).diff(moment(startTime), "milliseconds");

    logger.info(
      `Request ID: ${requestId} - Item created successfully. Execution time: ${duration}ms`,
      { item }
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Item created successfully", requestId }),
    };
  } catch (error) {
    logger.error(`Request ID: ${requestId} - Error creating item`, { error: error.message });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Could not create item",
        message: error.message,
        requestId,
      }),
    };
  }
};

// Export the handler
module.exports.handler = handler;
