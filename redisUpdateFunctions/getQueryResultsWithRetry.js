const { GetQueryResultsCommand } = require('@aws-sdk/client-cloudwatch-logs');

//Attempting the query
const getQueryResultsWithRetry = async (client, queryId, maxRetries = 10) => {
  let attempts = 0;
  let isQueryComplete = false;
  let queryResults;

  while (!isQueryComplete && attempts < maxRetries) {
    attempts++;

    const getQueryResultsCommand = new GetQueryResultsCommand({ queryId });
    const getQueryResultsResponse = await client.send(getQueryResultsCommand);

    if (getQueryResultsResponse.status === 'Complete') {
      isQueryComplete = true;
      queryResults = getQueryResultsResponse.results;
      console.log(`Query completed with ${queryResults.length} results.`);
    } else {
      const delay = Math.pow(2, attempts) * 1000;
      console.log(`Query not complete, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  if (!isQueryComplete) {
    console.error('Query did not complete in the expected time.');
    throw new Error('Query did not complete in the expected time.');
  }

  return queryResults;
};

module.exports = { getQueryResultsWithRetry };
