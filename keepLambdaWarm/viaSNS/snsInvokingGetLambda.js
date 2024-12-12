const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");

// Initialize winston logger
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

// Create client for DynamoDB
const dynamoDBClient = new DynamoDBClient();

// The validateQueryParams function is for validating the incoming request parameters.
const validateQueryParams = (params) => {
  const errors = [];

  if (!params.id || !validator.isInt(params.id)) {
    errors.push("Invalid or missing 'id' (must be a valid UUID)");
  }

  if (!params.pps || !validator.isLength(params.pps, { min: 1 })) {
    errors.push("Invalid or missing 'pps' (must be a non-empty string)");
  }

  return errors;
};

// Lambda handler function. This code block will be invoked by events. Every code written above 
// have to be executed before to start this execution.
module.exports.handler = async (event, context) => {
  // The below If loop is for detecting the invocation request from lambda warming architecture
  if (event.Records && event.Records[0] && event.Records[0].Sns) {
    if (JSON.parse(event.Records[0].Sns.Message).isRequestForKeepLambdaAlive) {
      console.log("This is a keep-alive request.");
      // End the execution for for Lambda warming environments
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Keep-alive request processed successfully." }),
      };
    }
  }

  const requestId = context.awsRequestId;
  const startTime = moment().format();

  // Log the start of the Lambda invocation 
  logger.info(`Request ID: ${requestId} - Lambda invoked at ${startTime}`);
  logger.info(`Request ID: ${requestId} - Received event`, { event });

  // Fetch Query Parameters from the incoming request.
  const { id, pps } = event.queryStringParameters || {};
  // Call Validation function to validate.
  const validationErrors = validateQueryParams({ id, pps });

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

  // create connection parameter for DynamoDB
  const params = {
    TableName: "RIC-EMPLOYEEE-TABLE",
    Key: {
      employeeId: id,
      ppsNumber: pps,
    },
  };

  try {
    // Execute the GetItemCommand to fetch data from DynamoDB
    const command = new GetItemCommand(params);
    const data = await dynamoDBClient.send(command);

    if (!data.Item) {
      logger.warn(`Request ID: ${requestId} - Item not found`, { params });
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Item not found" }),
      };
    }

    const endTime = moment().format();
    // calculating duration
    const duration = moment(endTime).diff(moment(startTime), "milliseconds");
    logger.info(
      `Request ID: ${requestId} - Item retrieved successfully. Execution time: ${duration}ms`,
      { item: data.Item }
    );

    // return success message
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
