const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Utility to sleep for a given number of milliseconds
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to write logs to a file
function writeLog(message) {
    const logFilePath = path.join(__dirname, 'logsForGet.txt'); // Log file path
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    fs.appendFileSync(logFilePath, logMessage, 'utf8'); // Append log message to file
}

// Function to send GET requests with delays
async function getEndpointWithDelays(delays, endpoint, currentPayload) {
    console.log('Starting GET requests...');
    writeLog('Starting GET requests...');

    // Loop through the delays array and send requests
    delays.forEach((delay, i) => {
        if (!isNaN(delay) && delay > 0) {
            // Create a timeout for delayed execution
            setTimeout(async () => {
                const startTime = Date.now(); // Record start time

                try {
                    // Send GET request with payload as query parameters
                    const response = await axios.get(endpoint, { params: { ...currentPayload } });

                    const responseTime = Date.now() - startTime; // Calculate response time
                    const logMessage = `Request ${i + 1}: Response time = ${responseTime} ms, Status = ${response.status}`;
                    console.log(logMessage);
                    writeLog(logMessage);

                    // Update payload if necessary based on the response
                    // Uncomment and customize if your API response should affect the payload
                    // currentPayload = response.data; 
                } catch (error) {
                    const responseTime = Date.now() - startTime; // Calculate response time
                    const logMessage = `Request ${i + 1}: Error - ${error.message}, Response time = ${responseTime} ms`;
                    console.error(logMessage);
                    writeLog(logMessage);
                }
            }, delay); // Delay the execution by the specified delay
        }
    });

    // Return the current payload (synchronously)
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
            currentPayload = await getEndpointWithDelays(delays, endpoint, currentPayload);

            // Wait for 15 minutes between groups, except after the last group
            if (i < invokeGroups.length - 1) {
                const waitMessage = 'Waiting for 15 minutes before the next group...';
                console.log(waitMessage);
                writeLog(waitMessage);
                await sleep(900000); // 15 minutes in milliseconds
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
// const apiEndpoint = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-get'; // Replace with your endpoint
const apiEndpoint = 'http://localhost:3000/ric'

let payloadTemplate = {
    id: "75", // Example initial value
    pps: "999" // Example initial value
};

processGetJsonData(jsonFilePath, apiEndpoint, payloadTemplate);
