// aws-sdk libraries importing.
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

// packages importing from layer.
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");

// Set up Winston logger for structured logging.
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

// Initialize the DynamoDB client.
const dynamoDBClient = new DynamoDBClient();

// The validateInput function validates the incoming request parameters and returns an array of validation errors.
const validateInput = (data) => {
  const errors = [];

  if (!data.id || !validator.isInt(data.id)) {
    errors.push("Invalid or missing 'id' (must be a valid UUID)");
  }

  if (!data.pps || !validator.isInt(data.pps)) {
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

// Lambda handler function. This function will be triggered by events.
exports.handler = async (event, context) => {
  // Check for Lambda keep-alive requests (via SNS Message).
  if (event.Records && event.Records[0] && event.Records[0].Sns) {
    if (JSON.parse(event.Records[0].Sns.Message).isRequestForKeepLambdaAlive) {
      console.log("This is a keep-alive request.");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Keep-alive request processed successfully." }),
      };
    }
  }

  // Extract AWS request ID and log invocation start time.
  const requestId = context.awsRequestId;
  const startTime = moment().format();

  logger.info(`Request ID: ${requestId} - Lambda invoked at ${startTime}`);

  // Parse and validate the request body.
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

  // Validate the parsed input data.
  const validationErrors = validateInput(item);
  if (validationErrors.length > 0) {
    logger.warn(`Request ID: ${requestId} - Validation failed: ${validationErrors.join(", ")}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Validation failed", details: validationErrors }),
    };
  }

  // Destructure validated input data for further processing.
  const { id, pps, name, age, position } = item;

  // Configure DynamoDB parameters with the input data.
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
    // Insert data into DynamoDB.
    const command = new PutItemCommand(params);
    await dynamoDBClient.send(command);

    // Calculate the execution duration and log success.
    const endTime = moment().format();
    const duration = moment(endTime).diff(moment(startTime), "milliseconds");
    logger.info(
      `Request ID: ${requestId} - Item created successfully. Execution time: ${duration}ms`,
      { item }
    );

    // Return success response.
    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Item created successfully", requestId }),
    };
  } catch (error) {
    // Log any errors that occur during data insertion.
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
