import Redis from "ioredis";

const redisHost = "clustercfg.ric-rediscluster.69bhdo.euw1.cache.amazonaws.com";
const redisPort = 6379;

const redisClient = new Redis.Cluster(
  [
    {
      port: redisPort,
      host: redisHost,
    },
  ],
  {
    dnsLookup: (address, callback) => callback(null, address),
    redisOptions: {
      tls: {},
    },
  }
);

// Use a permanent Redis key
const redisKey = "ric-crud-get-lambdas";

export const handler = async (event) => {
  // const latencyCreate = await createData();
  const latencyCreate = 0
  const data = await getData(latencyCreate);

  const response = {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      ...data,
      redisHost
    },
  };

  return response;
};

async function getData(latencyCreate) {
  try {
    console.log("Start getting data");

    const start = new Date();
    const data = JSON.parse(await redisClient.get(redisKey));  // Using the permanent key
    const end = new Date();

    console.log("Data retrieved:", data);

    return {
      latencyRead: `${end - start}ms`,
      latencyCreate: `${latencyCreate}ms`,
      data,
    };
  } catch (error) {
    console.error("Error accessing data:", error);
    return {
      error,
      message: error.message,
    };
  }
}

async function createData() {
  try {
    const start = new Date();

    const lambdaData = {
      LambdaOne: {
        targetLambda: "lambda1",
        AverageTimeToCompleteExecution: 0,
        isActive: true,
      },
      LambdaTwo: {
        targetLambda: "lambda2",
        AverageTimeToCompleteExecution: 0,
        isActive: true,
      },
    };

    // Save the structured data into Redis under the permanent key
    await redisClient.set(redisKey, JSON.stringify(lambdaData));  // Using the permanent key
    const end = new Date();

    return end - start;
  } catch (error) {
    console.error("Error saving data:", error);
    throw error;
  }
}
