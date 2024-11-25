const Redis = require("ioredis");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

// Function to fetch secrets from AWS Secrets Manager
const getSecretValue = async (client, secretName) => {
  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);
    console.log(JSON.parse(response.SecretString))
    return response.SecretString ? JSON.parse(response.SecretString) : {};
  } catch (error) {
    console.error(`Error fetching secret "${secretName}":`, error.message);
    throw new Error(`Failed to fetch secret: ${secretName}`);
  }
};

const handler = async (event) => {
  let redisClient;

  try {
    // Extract parameters from event
    const {
      lambdaAverageColdStartTime,
      lambdaAverageExecutionTime,
      functionSecretManagerKey
    } = event;

    const ricSecretManegerKey = 'ric-credentials'
    if (lambdaAverageColdStartTime === undefined || lambdaAverageExecutionTime === undefined || functionSecretManagerKey === undefined) {
      throw new Error("Missing required parameters: functionSecretManagerKey, lambdaAverageColdStartTime, or lambdaAverageExecutionTime");
    }

    // Initialize Secrets Manager client
    const secretsManagerClient = new SecretsManagerClient({ region: "us-east-1" });

    // Fetch secrets
    const SecretString = await getSecretValue(secretsManagerClient, ricSecretManegerKey);
    const getLambdaDetailskey = SecretString[functionSecretManagerKey]
    const redisHost = SecretString.RedisHost
    const redisPort = SecretString.RedisPort || 6379
    if (!getLambdaDetailskey || !redisHost) {
      throw new Error("Secrets are missing required keys: redisHost or getLambdaDetailskey");
    }

    console.log(`Connecting to Redis at ${redisHost}:${redisPort}`);

    // Initialize Redis client
    redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      tls: {}, // Ensure secure connection to the cluster if required
    });

    // Fetch data from Redis using the key
    const redisData = await redisClient.get(getLambdaDetailskey);

    if (!redisData) {
      throw new Error(`No data found in Redis for key: ${getLambdaDetailskey}`);
    }

    // Parse and update the data
    const parsedData = JSON.parse(redisData);

    // Update lambdaAverageColdStartTime if provided
    if (lambdaAverageColdStartTime !== null && lambdaAverageColdStartTime !== undefined) {
      parsedData.lambdaAverageColdStartTime = lambdaAverageColdStartTime;
    }

    // Update lambdaAverageExecutionTime if provided
    if (lambdaAverageExecutionTime !== null && lambdaAverageExecutionTime !== undefined) {
      parsedData.lambdaAverageExecutionTime = lambdaAverageExecutionTime;
    }

    // Update Redis with the modified data
    await redisClient.set(getLambdaDetailskey, JSON.stringify(parsedData));

    console.log(`Updated Redis data for key: ${getLambdaDetailskey}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Redis data updated successfully",
        updatedData: parsedData,
      }),
    };
  } catch (error) {
    console.error("Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    if (redisClient) {
      redisClient.disconnect();
    }
  }
};

module.exports.handler = handler;
