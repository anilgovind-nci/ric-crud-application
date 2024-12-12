// aws-sdk libraries importing.
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

// packages importing from layer.
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");

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

// Create client for DynamoDB
const dynamoDBClient = new DynamoDBClient();

// The validateInput function is for validating the incoming request parameters.
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

// Lambda handler function. This code block will be invoked by events. Every code written above 
// have to be executed before to start this execution.
exports.handler = async (event, context) => {
  // The below If loop is for detecting the invocation request from lambda warming architecture
  if (event.isRequestForKeepLambdaAlive === true) {
    console.log("This is a keep-alive request.");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Keep-alive request processed successfully." }),
    };
  }

  const requestId = context.awsRequestId;
  const startTime = moment().format();

  // Log Lambda invocation to logger
  logger.info(`Request ID: ${requestId} - Lambda invoked at ${startTime}`);

  // Parse and validate the request body received form request.
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

  // send response if validation failed
  const validationErrors = validateInput(item);
  if (validationErrors.length > 0) {
    logger.warn(`Request ID: ${requestId} - Validation failed: ${validationErrors.join(", ")}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Validation failed", details: validationErrors }),
    };
  }

  // DynamoDB parameters configuration from received request
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
    const command = new PutItemCommand(params);
    await dynamoDBClient.send(command);

    // calculate the time taken
    const endTime = moment().format();
    const duration = moment(endTime).diff(moment(startTime), "milliseconds");

    // log success
    logger.info(
      `Request ID: ${requestId} - Item created successfully. Execution time: ${duration}ms`,
      { item }
    );

    // return creation success response to client
    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Item created successfully", requestId }),
    };
  } 
  // log error
  catch (error) {
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
