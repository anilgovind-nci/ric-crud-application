// Import necessary libraries
const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");

// Set up Winston logger for logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

// Initialize DynamoDB client
const dynamoDBClient = new DynamoDBClient();

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

// Lambda handler function. This is the entry point that AWS Lambda calls when the function is invoked.
module.exports.handler = async (event, context) => {
  // The below If loop is for detecting the invocation request from lambda warming architecture
  if (event.Records && event.Records[0] && event.Records[0].Sns) {
    if (JSON.parse(event.Records[0].Sns.Message).isRequestForKeepLambdaAlive) {
      console.log("This is a keep-alive request.");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Keep-alive request processed successfully." }),
      };
    }
  }

  // Capture request ID and start time for logging and performance tracking.
  const requestId = context.awsRequestId;
  const startTime = moment().format();

  // Log Lambda invocation.
  logger.info(`Request ID: ${requestId} - Lambda invoked at ${startTime}`);
  logger.info(`Request ID: ${requestId} - Received event`, { event });

  // Parse and validate the request body received from the event.
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

  // Perform input validation based on the received data.
  const validationErrors = validateUpdateData(updateData);
  if (validationErrors.length > 0) {
    logger.warn(`Request ID: ${requestId} - Validation failed: ${validationErrors.join(", ")}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Validation failed", details: validationErrors }),
    };
  }

  // Extract and prepare data for the update operation.
  const { id, pps, name, age, position } = updateData;

  const updateExpressions = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  // Add attributes to update in the expression.
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

  // If no attributes to update, return a warning response.
  if (updateExpressions.length === 0) {
    logger.warn(`Request ID: ${requestId} - No attributes provided to update`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "No attributes provided to update" }),
    };
  }

  // Prepare parameters for the DynamoDB update operation.
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
    // Execute the update operation on DynamoDB.
    const command = new UpdateItemCommand(params);
    const data = await dynamoDBClient.send(command);

    // Log execution duration and success.
    const endTime = moment().format();
    const duration = moment(endTime).diff(moment(startTime), "milliseconds");
    logger.info(`Request ID: ${requestId} - Item updated successfully. Execution time: ${duration}ms`, { updatedItem: data.Attributes });

    // Return success response with updated item.
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Item updated successfully", updatedItem: data.Attributes }),
    };
  } catch (error) {
    // Log error and return failure response.
    logger.error(`Request ID: ${requestId} - Error updating item`, { error: error.message });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not update item", message: error.message, requestId }),
    };
  }
};
