const { DynamoDBClient, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
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

  const validationErrors = validateDeleteData(deleteData);
  if (validationErrors.length > 0) {
    logger.warn(`Request ID: ${requestId} - Validation failed: ${validationErrors.join(", ")}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Validation failed", details: validationErrors }),
    };
  }

  const { id, pps } = deleteData;

  const params = {
    TableName: "RIC-EMPLOYEEE-TABLE",
    Key: {
      employeeId: id,
      ppsNumber: pps,
    },
    ReturnValues: "ALL_OLD", // Returns the deleted item attributes
  };

  try {
    const command = new DeleteItemCommand(params);
    const data = await dynamoDBClient.send(command);

    if (!data.Attributes) {
      logger.warn(`Request ID: ${requestId} - Item not found`, { params });
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Item not found" }),
      };
    }

    const endTime = moment().format();
    const duration = moment(endTime).diff(moment(startTime), "milliseconds");
    logger.info(`Request ID: ${requestId} - Item deleted successfully. Execution time: ${duration}ms`, { deletedItem: data.Attributes });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Item deleted successfully", deletedItem: data.Attributes }),
    };
  } catch (error) {
    logger.error(`Request ID: ${requestId} - Error deleting item`, { error: error.message });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not delete item", message: error.message, requestId }),
    };
  }
};
