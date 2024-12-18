// importing packages from aws-sdk
const { CloudWatchLogsClient, PutLogEventsCommand, CreateLogStreamCommand, DescribeLogStreamsCommand } = require("@aws-sdk/client-cloudwatch-logs");

let sequenceToken = null; // To track the sequence token for log events

// Function to ensure log stream exists in cloud watch.
const ensureLogStreamExists = async (cloudWatchLogsClient, logGroupName, logStreamName) => {
  try {
    const describeLogStreamsResponse = await cloudWatchLogsClient.send(
      new DescribeLogStreamsCommand({
        logGroupName,
        logStreamNamePrefix: logStreamName,
      })
    );

    const logStream = describeLogStreamsResponse.logStreams.find(
      (stream) => stream.logStreamName === logStreamName
    );
    // if there is no log stream create a new one.
    if (!logStream) {
      await cloudWatchLogsClient.send(
        new CreateLogStreamCommand({
          logGroupName,
          logStreamName,
        })
      );
    } else {
      // Save the token for subsequent log entries
      sequenceToken = logStream.uploadSequenceToken; 
    }
  } catch (error) {
    console.error("Error ensuring log stream exists:", error.message);
  }
};

// Function to send logs to the custom log group
const logToCustomLogGroup = async (cloudWatchLogsClient, logGroupName, logStreamName, logEvent) => {
  try {
    // Ensure the log stream exists or create it.
    await ensureLogStreamExists(cloudWatchLogsClient, logGroupName, logStreamName);

    // Send the log event to the log group.
    const putLogEventsParams = {
      logGroupName,
      logStreamName,
      logEvents: [
        {
          timestamp: Date.now(),
          message: JSON.stringify(logEvent),
        },
      ],
    };

    // Include sequence token if available
    if (sequenceToken) {
      putLogEventsParams.sequenceToken = sequenceToken;
    }

    const putLogEventsResponse = await cloudWatchLogsClient.send(
      new PutLogEventsCommand(putLogEventsParams)
    );

    // Update sequence token for future log events
    sequenceToken = putLogEventsResponse.nextSequenceToken;
  } catch (error) {
    console.error("Failed to send logs to custom log group:", error.message);
  }
};

module.exports = {
  ensureLogStreamExists,
  logToCustomLogGroup,
};
