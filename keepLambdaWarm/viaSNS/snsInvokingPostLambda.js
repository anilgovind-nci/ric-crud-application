const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");

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

const dynamoDBClient = new DynamoDBClient();

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

  if (typeof data.age === 'undefined' || !validator.isInt(data.age.toString(), { min: 0 })) {
    errors.push("Invalid or missing 'age' (must be a non-negative integer)");
  }

  if (!data.position || !validator.isLength(data.position, { min: 1 })) {
    errors.push("Invalid or missing 'position' (must be a non-empty string)");
  }

  return errors;
};

exports.handler = async (event, context) => {
  if (event.Records && event.Records[0] && event.Records[0].Sns) {
    if (JSON.parse(event.Records[0].Sns.Message).isRequestForKeepLambdaAlive) {
      console.log("This is a keep-alive request.");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Keep-alive request processed successfully." }),
      };
    }
  }

  const requestId = context.awsRequestId;
  const startTime = moment().format();
  
  logger.info(`Request ID: ${requestId} - Lambda invoked at ${startTime}`);

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
    const command = new PutItemCommand(params);
    await dynamoDBClient.send(command);
    
    const endTime = moment().format();
    const duration = moment(endTime).diff(moment(startTime), 'milliseconds');
    logger.info(`Request ID: ${requestId} - Item created successfully. Execution time: ${duration}ms`, { item });

    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Item created successfully", requestId }),
    };
  } catch (error) {
    logger.error(`Request ID: ${requestId} - Error creating item`, { error: error.message });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not create item", message: error.message, requestId }),
    };
  }
};
