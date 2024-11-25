const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { CloudWatchLogsClient } = require("@aws-sdk/client-cloudwatch-logs");
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");
const { logToCustomLogGroup } = require("./logToCustomCloudWatch");
const { randomUUID } = require("crypto");
// const LOG_GROUP_NAME = "RIC-CRUD-log-group";
const logGroupName = process.env.CENTRALISED_LOG_GROUP_NAME;
const lambdaExecutionEnvironment = randomUUID(); // Unique ID for each Lambda invocation
const logStreamName = `RIC-PUT-Stream-${lambdaExecutionEnvironment}`; // Unique stream name

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

// Lambda handler
const handler = async (event, context) => {
  const requestId = context.awsRequestId;
  const startTime = moment().format();

  // Log to custom CloudWatch log group
  const customLogEvent = {
    requestId,
    invocationTime: startTime,
    method: "PUT",
    lambda: "ric-crud-application-dev-ricPut"

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

    const endTime = moment().format();
    const duration = moment(endTime).diff(moment(startTime), "milliseconds");
    logger.info(
      `Request ID: ${requestId} - Item updated successfully. Execution time: ${duration}ms`,
      { updatedItem: data.Attributes }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Item updated successfully", updatedItem: data.Attributes }),
    };
  } catch (error) {
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
module.exports.handler = handler;
