const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");
const DatadogTransport = require("datadog-winston");

// Set up Winston logger with Datadog transport
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
  transports: [
    new winston.transports.Console(),
    new DatadogTransport({
      apiKey: process.env.DD_API_KEY,
      service: process.env.DD_SERVICE,
      env: process.env.DD_ENV,
      version: process.env.DD_VERSION,
    }),
  ],
});

// Create DynamoDB client and document client
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDBClient = DynamoDBDocumentClient.from(client);

// Function to validate query parameters
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

// Lambda handler function
const handler = async (event, context) => {
  const requestId = context.awsRequestId;
  const startTime = moment().format();

  // Log the start of the Lambda invocation
  logger.info(`Request ID: ${requestId} - Lambda invoked at ${startTime}`);
  logger.info(`Request ID: ${requestId} - Received event`, { event });

  // Extract query parameters
  const { id, pps } = event.queryStringParameters || {};
  const validationErrors = validateQueryParams({ id, pps });

  // If validation errors exist, log and return a response
  if (validationErrors.length > 0) {
    logger.warn(
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

  // DynamoDB query parameters
  const params = {
    TableName: "RIC-EMPLOYEEE-TABLE",
    Key: {
      employeeId: id,
      ppsNumber: pps,
    },
  };

  try {
    // Retrieve data from DynamoDB
    const data = await dynamoDBClient.send(new GetCommand(params));

    if (!data.Item) {
      logger.warn(`Request ID: ${requestId} - Item not found`, { params });
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Item not found" }),
      };
    }

    // Log success and execution time
    const endTime = moment().format();
    const duration = moment(endTime).diff(moment(startTime), "milliseconds");
    logger.info(
      `Request ID: ${requestId} - Item retrieved successfully. Execution time: ${duration}ms`,
      { item: data.Item }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(data.Item),
    };
  } catch (error) {
    logger.error(`Request ID: ${requestId} - Error retrieving item`, {
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
