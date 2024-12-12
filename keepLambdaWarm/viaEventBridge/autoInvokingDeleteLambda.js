// aws-sdk libraries importing.
const { DynamoDBClient, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");

// Logging libraries importing.
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");

// Initialize logger with timestamped and structured logging format
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
module.exports.handler = async (event, context) => {
  // Check for Lambda warming request to keep it alive
  if (event.isRequestForKeepLambdaAlive === true) {
    console.log("This is a keep-alive request.");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Keep-alive request processed successfully." }),
    };
  }

  // Unique request ID for tracing
  const requestId = context.awsRequestId;
  // Capture the start time for execution metrics
  const startTime = moment().format();

  // Log incoming request details
  logger.info(`Request ID: ${requestId} - Lambda invoked at ${startTime}`);
  logger.info(`Request ID: ${requestId} - Received event`, { event });

  // Parse the request body and handle errors
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

  // Define parameters for DynamoDB delete operation
  const params = {
    TableName: "RIC-EMPLOYEEE-TABLE",
    Key: {
      employeeId: id,
      ppsNumber: pps,
    },
    ReturnValues: "ALL_OLD", // Returns the deleted item attributes
  };

  try {
    // Execute the delete operation in DynamoDB
    const command = new DeleteItemCommand(params);
    const data = await dynamoDBClient.send(command);

    // If no item was found and deleted, return a 404 error
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

    // Log success response along with deleted item
    logger.info(`Request ID: ${requestId} - Item deleted successfully. Execution time: ${duration}ms`, { deletedItem: data.Attributes });

    // Return success response with the deleted item's details
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Item deleted successfully", deletedItem: data.Attributes }),
    };
  } catch (error) {
    // Handle any errors during the delete operation
    logger.error(`Request ID: ${requestId} - Error deleting item`, { error: error.message });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not delete item", message: error.message, requestId }),
    };
  }
};
