const { CloudWatchLogsClient, StartQueryCommand } = require("@aws-sdk/client-cloudwatch-logs");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { logGroups } = require("./logGroups");
const { getQueryResultsWithRetry } = require("./getQueryResultsWithRetry");
const logGroupName = process.env.CENTRALISED_LOG_GROUP_NAME;
const cloudwatchlogs = new CloudWatchLogsClient();
const lambdaClient = new LambdaClient();

exports.handler = async (event) => {
    try {
        const { timeRange = '2m' } = event;
        const endTime = Date.now();
        const startTime = calculateStartTime(timeRange, endTime);
        const lambdaNames = logGroups.map(group => group.name.split('/').pop());
        // Query for fetching last 2 minutes invocations
        const queryString = `
              fields lambda, @timestamp
              | filter @message like /invocationTime/
              | parse @message "requestId: * invocationTime: * method: * lambda: *" as requestId, invocationTime, method, lambdaName
              | stats count() by lambda
          `;

        const startQueryCommand = new StartQueryCommand({
            logGroupName,
            startTime: Math.floor(startTime / 1000),
            endTime: Math.floor(endTime / 1000),
            queryString
        });

        const startQueryResponse = await cloudwatchlogs.send(startQueryCommand);
        const queryId = startQueryResponse.queryId;

        console.log("Waiting for query to complete...");
        const queryResults = await getQueryResultsWithRetry(cloudwatchlogs, queryId);
        console.log("Query results:", JSON.stringify(queryResults, null, 2));

        if (!queryResults || queryResults.length === 0) {
            console.log("No logs found in the specified time range.");
            await invokeMissingLambdas(lambdaNames); // Invoke all if no results found
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: "No logs found in the specified time range for any Lambda.",
                    missingLambdas: lambdaNames
                })
            };
        }

        const loggedLambdas = queryResults
            .map(row => row.find(field => field.field === 'lambda')?.value)
            .filter(Boolean);
        const missingLambdas = lambdaNames.filter(name => !loggedLambdas.includes(name));

        console.log("Missing Lambdas:", missingLambdas);

        if (missingLambdas.length > 0) {
            await invokeMissingLambdas(missingLambdas);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: missingLambdas.length > 0
                    ? "Some Lambdas did not log in the specified time range. Invocations have been triggered."
                    : "All Lambdas have logged in the specified time range.",
                missingLambdas
            })
        };

    } catch (error) {
        console.error("Error processing logs:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error processing logs" })
        };
    }
};
// function to convert input times 
function calculateStartTime(timeRange, endTime) {
    const units = timeRange.slice(-1);
    const amount = parseInt(timeRange.slice(0, -1), 10);

    let startTime;
    switch (units) {
        case 'd':
            startTime = endTime - amount * 24 * 60 * 60 * 1000;
            break;
        case 'h':
            startTime = endTime - amount * 60 * 60 * 1000;
            break;
        case 'm':
            startTime = endTime - amount * 60 * 1000;
            break;
        default:
            throw new Error("Invalid time range format. Use 'd' for days, 'h' for hours, or 'm' for minutes.");
    }
    return startTime;
}
// function to invoke lambdas which are not invoked in last configured minutes.
async function invokeMissingLambdas(lambdaNames) {
    console.log(`Invoking missing Lambdas: ${lambdaNames.join(", ")}`);
    const invocations = lambdaNames.map(async (lambdaName) => {
        try {
            // creating lambda invocation params
            const params = {
                FunctionName: lambdaName,
                InvocationType: "RequestResponse",
                Payload: JSON.stringify({ isRequestForKeepLambdaAlive: true })
            };
            //invoking lambda
            const command = new InvokeCommand(params);
            const response = await lambdaClient.send(command);
            console.log(`Successfully invoked ${lambdaName}: StatusCode=${response.StatusCode}`);
        } catch (error) {
            console.error(`Error invoking ${lambdaName}:`, error);
        }
    });

    // Wait for all invocations to complete
    await Promise.all(invocations);
}
