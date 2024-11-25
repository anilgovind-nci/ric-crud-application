import { LambdaClient, GetFunctionCommand, GetFunctionConfigurationCommand, CreateFunctionCommand } from "@aws-sdk/client-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import https from "https";
import fs from "fs";
import path from "path";

const lambdaClient = new LambdaClient({});
const s3Client = new S3Client({});

export const handler = async (event) => {
  const sourceFunctionName = 'ric-crud-application-dev-ricGet';
  const lambdaExecutionEnvironment = randomUUID();
  let destinationFunctionName = `${sourceFunctionName}-${lambdaExecutionEnvironment}`;

  if (destinationFunctionName.length > 64) {
    destinationFunctionName = destinationFunctionName.substring(0, 64);
  }

  const s3BucketName = 'ric-load-balancer';
  const s3Key = `temp-source-code/${destinationFunctionName}.zip`;

  try {
    console.log("Step 1: Fetching source Lambda deployment package...");
    const { Code } = await lambdaClient.send(new GetFunctionCommand({ FunctionName: sourceFunctionName }));
    const zipFilePath = await fetchLambdaCodeToTmp(Code.Location);
    console.log("Deployment package saved to:", zipFilePath);

    console.log("Step 2: Uploading deployment package to S3...");
    await s3Client.send(new PutObjectCommand({
      Bucket: s3BucketName,
      Key: s3Key,
      Body: fs.createReadStream(zipFilePath),
    }));
    console.log(`Deployment package uploaded to S3: ${s3BucketName}/${s3Key}`);

    console.log("Step 3: Fetching source Lambda configuration...");
    const sourceConfig = await lambdaClient.send(new GetFunctionConfigurationCommand({ FunctionName: sourceFunctionName }));

    console.log("Step 4: Fetching attached layers...");
    const sourceLayers = sourceConfig.Layers ? sourceConfig.Layers.map(layer => layer.Arn) : [];
    console.log("Source Layers:", sourceLayers);

    console.log("Step 5: Creating new Lambda function...");
    const createParams = {
      FunctionName: destinationFunctionName,
      Runtime: sourceConfig.Runtime,
      Role: sourceConfig.Role,
      Handler: sourceConfig.Handler,
      Description: sourceConfig.Description,
      Timeout: sourceConfig.Timeout,
      MemorySize: sourceConfig.MemorySize,
      Environment: sourceConfig.Environment,
      Layers: sourceLayers, // Attach source layers to the new Lambda
      Publish: true,
      Code: {
        S3Bucket: s3BucketName,
        S3Key: s3Key,
      },
    };

    const createResponse = await lambdaClient.send(new CreateFunctionCommand(createParams));
    console.log(`Successfully created a copy: ${createResponse.FunctionArn}`);

    console.log("Cleaning up temporary files...");
    fs.unlinkSync(zipFilePath);

    return {
      statusCode: 200,
      body: `Lambda function ${destinationFunctionName} created successfully.`,
    };
  } catch (error) {
    console.error("Error occurred:", error);
    return {
      statusCode: 500,
      body: `Failed to create Lambda function copy: ${error.message}`,
    };
  }
};

// Helper function to download the source Lambda's code package to /tmp
async function fetchLambdaCodeToTmp(codeUrl) {
  const filePath = path.join("/tmp", `${randomUUID()}.zip`);
  console.log(`Downloading Lambda deployment package to: ${filePath}`);

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(filePath);
    https.get(codeUrl, (res) => {
      res.pipe(fileStream);
      fileStream.on("finish", () => {
        console.log("File download complete.");
        resolve(filePath);
      });
      fileStream.on("error", (error) => {
        console.error("Error downloading file:", error);
        fs.unlinkSync(filePath);
        reject(error);
      });
    });
  });
}
