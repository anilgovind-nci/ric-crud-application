const { CloudWatchLogsClient, StartQueryCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { logGroups } = require('./logGroups.js');
const { getQueryResultsWithRetry } = require('./getQueryResultsWithRetry');
const invokingRedisLambdaName = process.env.REDIS_FUNCTION_NAME
const cloudwatchLogsClient = new CloudWatchLogsClient({ region: 'eu-west-1' });
const lambdaClient = new LambdaClient({ region: 'eu-west-1' });

module.exports.handler = async (event) => {
  try {
    for (const logGroup of logGroups) {
      const { name: logGroupName, functionSecretManagerKey } = logGroup;

      // Define the query for CloudWatch Logs
      const query = `
          fields @billedDuration, @initDuration
          | filter @type = "REPORT"
          | stats avg(@billedDuration) as avgBilledDuration, avg(@initDuration) as avgInitDuration
      `;

      console.log(`Processing log group: ${logGroupName}`);

      const startQueryCommand = new StartQueryCommand({
          logGroupName,
          startTime: Math.floor(Date.now() / 1000) - 3600,
          endTime: Math.floor(Date.now() / 1000),
          queryString: query,
      });

      const startQueryResponse = await cloudwatchLogsClient.send(startQueryCommand);
      const queryId = startQueryResponse.queryId;

      console.log(`Started CloudWatch Logs query with queryId: ${queryId}`);

      // Reuse getQueryResultsWithRetry
      const queryResults = await getQueryResultsWithRetry(cloudwatchLogsClient, queryId);

      const avgBilledDuration = queryResults[0] ? queryResults[0][0].value : null;
      const avgInitDuration = queryResults[0] ? queryResults[0][1].value : null;

      console.log(`Fetched CloudWatch data: avgBilledDuration = ${avgBilledDuration}, avgInitDuration = ${avgInitDuration}`);

      if (avgBilledDuration || avgInitDuration) {
        // Invoke the target Lambda
        const invokeCommand = new InvokeCommand({
          FunctionName: invokingRedisLambdaName,
          Payload: JSON.stringify({
            lambdaAverageExecutionTime: avgBilledDuration,
            lambdaAverageColdStartTime: avgInitDuration,
            functionSecretManagerKey,
          }),
        });

        try {
          const invokeResponse = await lambdaClient.send(invokeCommand);
          console.log(`Lambda invoked with status: ${invokeResponse.StatusCode}`);
        } catch (invokeError) {
          console.error('Error invoking Lambda:', invokeError);
        }
      } else {
        console.log('No relevant data for invocation. Skipping Lambda invocation.');
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Processed all log groups successfully' }),
    };
  } catch (error) {
    console.error('Error processing logs:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error processing logs', error: error.message }),
    };
  }
};
