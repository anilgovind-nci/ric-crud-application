const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const winston = require("winston");
const moment = require("moment");
const validator = require("validator");

// Initialize logger
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
module.exports.handler = async (event, context) => {
  if (event.isRequestForKeepLambdaAlive === true) {
    console.log("This is a keep-alive request.");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Keep-alive request processed successfully." }),
    };
  }

  const requestId = context.awsRequestId;
  const startTime = moment().format();

  logger.info(`Request ID: ${requestId} - Lambda invoked at ${startTime}`);
  logger.info(`Request ID: ${requestId} - Received event`, { event });

  const { id, pps } = event.queryStringParameters || {};
  const validationErrors = validateQueryParams({ id, pps });

  if (validationErrors.length > 0) {
    logger.warn(`Request ID: ${requestId} - Validation failed: ${validationErrors.join(", ")}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Validation failed", details: validationErrors }),
    };
  }

  const params = {
    TableName: "RIC-EMPLOYEEE-TABLE",
    Key: {
      employeeId: id,
      ppsNumber: pps,
    },
  };

  try {
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
    const duration = moment(endTime).diff(moment(startTime), 'milliseconds');
    logger.info(`Request ID: ${requestId} - Item retrieved successfully. Execution time: ${duration}ms`, { item: data.Item });

    return {
      statusCode: 200,
      body: JSON.stringify(data.Item),
    };
  } catch (error) {
    logger.error(`Request ID: ${requestId} - Error retrieving item`, { error: error.message });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not retrieve item", message: error.message, requestId }),
    };
  }
};
