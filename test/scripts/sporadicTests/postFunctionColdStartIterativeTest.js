const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Function to write logs to a file
function writeLog(message) {
    const logFilePath = path.join(__dirname, 'logsForPost.txt'); // Log file path
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    fs.appendFileSync(logFilePath, logMessage, 'utf8'); // Append log message to file
}

// Function to send POST requests without waiting (fire-and-forget)
async function postEndpointWithDelays(delays, endpoint, initialPayload) {
    console.log('Starting POST requests...');
    writeLog('Starting POST requests...');

    let currentPayload = { ...initialPayload }; // Copy of initial payload to modify

    // Loop through delays and send requests
    delays.forEach((delay, i) => {
        if (!isNaN(delay) && delay > 0) {
            // Create a timeout for delayed execution
            setTimeout(async () => {
                const startTime = Date.now(); // Record start time

                // Modify the payload for each request
                currentPayload = {
                    id: `${parseInt(currentPayload.id) + 1}`, // Increment ID
                    pps: `${parseInt(currentPayload.pps) + 1}`, // Increment PPS
                    position: currentPayload.position,
                    age: currentPayload.age,
                    name: currentPayload.name
                };

                console.log(currentPayload);

                const config = {
                    method: 'post',
                    maxBodyLength: Infinity,
                    url: endpoint,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify(currentPayload)
                };

                try {
                    const response = await axios.request(config);
                    const responseTime = Date.now() - startTime; // Calculate response time
                    const logMessage = `Request ${i + 1}: Response time = ${responseTime} ms, Status = ${response.status}`;
                    console.log(logMessage);
                    writeLog(logMessage);
                } catch (error) {
                    const responseTime = Date.now() - startTime; // Calculate response time
                    const logMessage = `Request ${i + 1}: Error - ${error.message}, Response time = ${responseTime} ms`;
                    console.error(logMessage);
                    writeLog(logMessage);
                }
            }, delay); // Fire the request after the delay
        }
    });

    // Return the last modified payload (synchronously)
    return currentPayload;
}

// Main function to handle the JSON file and sequentially process invocations
async function processPostJsonData(jsonFilePath, endpoint, payloadTemplate) {
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
            currentPayload = await postEndpointWithDelays(delays, endpoint, currentPayload);

            // Wait for 15 minutes between groups, except after the last group
            if (i < invokeGroups.length - 1) {
                const waitMessage = 'Waiting for 15 minutes before the next group...';
                console.log(waitMessage);
                writeLog(waitMessage);
                await new Promise(resolve => setTimeout(resolve, 900000)); // 15 minutes in milliseconds
            }
        }

        console.log('All POST requests completed.');
        writeLog('All POST requests completed.');
    } catch (error) {
        const errorMessage = `Error processing JSON data: ${error.message}`;
        console.error(errorMessage);
        writeLog(errorMessage);
    }
}

// Example usage:
const jsonFilePath = path.join(__dirname, 'sporadicHitTimimgs.json'); // Path to your JSON file
// const apiEndpoint = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-post'; // Replace with your endpoint
const apiEndpoint = 'http://localhost:3000/ric'

let payloadTemplate = {
    id: "1",
    pps: "100",
    position: "Developer Lead",
    age: "28",
    name: "test-user"
};

processPostJsonData(jsonFilePath, apiEndpoint, payloadTemplate);