const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Function to write logs to a file
function writeLog(message) {
    const logFilePath = path.join(__dirname, 'logsForGet.txt'); // Log file path
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    fs.appendFileSync(logFilePath, logMessage, 'utf8'); // Append log message to file
}

// Function to send GET requests sequentially with delay
async function sendGetRequestWithDelay(i, endpoint, currentPayload) {
    const startTime = Date.now(); // Record start time

    // Build the query string from the payload
    const queryParams = new URLSearchParams(currentPayload).toString();
    const urlWithParams = `${endpoint}?${queryParams}`;

    // console.log(`Sending GET request to: ${urlWithParams}`);

    const config = {
        method: 'get', // HTTP GET method
        maxBodyLength: Infinity,
        url: urlWithParams,
        headers: {}, // Add any required headers here
    };

    try {
        const response = await axios.request(config);
        const responseTime = Date.now() - startTime; // Calculate response time
        const logMessage = `Request ${i + 1}: Response time = ${responseTime} ms, Status = ${response.status}`;
        // console.log(logMessage);
        writeLog(logMessage);
    } catch (error) {
        const responseTime = Date.now() - startTime; // Calculate response time
        const logMessage = `Request ${i + 1}: Error - ${error.message}, Response time = ${responseTime} ms`;
        console.error(logMessage);
        writeLog(logMessage);
    }
}

// Function to send GET requests sequentially with delays (without waiting for completion)
async function getEndpointWithDelaysSequentially(delays, endpoint, initialPayload) {
    console.log('Starting GET requests...');
    writeLog('Starting GET requests...');

    let currentPayload = { ...initialPayload }; // Copy of initial payload to modify
    console.log(currentPayload)
    // Loop through delays and send requests sequentially
    for (let i = 0; i < delays.length; i++) {
        const delay = delays[i];

        // Increment parameters if required (example: incrementing `id` and `pps`)
        currentPayload.id = (parseInt(currentPayload.id) + 1).toString();
        currentPayload.pps = (parseInt(currentPayload.pps) + 1).toString();

        // Wait for the specified delay before sending the request
        if (!isNaN(delay) && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay)); // Wait for the delay
        }

        // Send GET request
        sendGetRequestWithDelay(i, endpoint, currentPayload);
    }

    // Return the last modified payload
    return currentPayload;
}

// Main function to handle the JSON file and sequentially process invocations
async function processGetJsonData(jsonFilePath, endpoint, payloadTemplate) {
    try {
        // Read and parse the JSON file
        const data = fs.readFileSync(jsonFilePath, 'utf8');
        const jsonData = JSON.parse(data);

        // Initialize the payload to the template provided
        let currentPayload = { ...payloadTemplate };

        // Iterate over each invoke group in the JSON
        const invokeGroups = Object.keys(jsonData);
        for (let i = 0; i < invokeGroups.length; i++) {
            const groupName = invokeGroups[i];
            const delays = jsonData[groupName];

            const logMessage = `Processing ${groupName} with ${delays.length} delays...`;
            console.log(logMessage);
            writeLog(logMessage);

            // Process the group and get the updated payload
            currentPayload = await getEndpointWithDelaysSequentially(delays, endpoint, currentPayload);

            // Wait for 15 minutes between groups, except after the last group
            if (i < invokeGroups.length - 1) {
                const waitMessage = 'Waiting for 15 minutes before the next group...';
                console.log(waitMessage);
                writeLog(waitMessage);
                await new Promise(resolve => setTimeout(resolve, 900000)); // 15 minutes in milliseconds
            }
        }

        console.log('All GET requests completed.');
        writeLog('All GET requests completed.');
    } catch (error) {
        const errorMessage = `Error processing JSON data: ${error.message}`;
        console.error(errorMessage);
        writeLog(errorMessage);
    }
}

// Example usage:
const jsonFilePath = path.join(__dirname, 'sporadicHitTimimgs.json'); // Path to your JSON file
// const apiEndpoint = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-get'; // Replace with your GET endpoint
const apiEndpoint = 'http://localhost:3000/ric'

let payloadTemplate = {
    id: "1",  // Starting ID
    pps: "100" // Starting PPS
};

processGetJsonData(jsonFilePath, apiEndpoint, payloadTemplate);
