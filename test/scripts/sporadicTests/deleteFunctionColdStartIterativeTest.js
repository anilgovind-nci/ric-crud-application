const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Function to write logs to a file
function writeLog(message) {
    const logFilePath = path.join(__dirname, 'logsForDelete.txt'); // Log file path
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    fs.appendFileSync(logFilePath, logMessage, 'utf8'); // Append log message to file
}

async function sendDeleteRequestWithDelay(i, endpoint, currentPayload) {
    const startTime = Date.now(); // Record start time

    console.log(`Deleting entry with ID: ${currentPayload.id}`);

    const config = {
        method: 'delete', // HTTP DELETE method
        maxBodyLength: Infinity,
        url: endpoint,
        headers: { 'Content-Type': 'application/json' }, // Match headers from Postman
        data: JSON.stringify(currentPayload) // Include payload in DELETE request
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

    return currentPayload; // Return payload to continue processing
}


// Function to send DELETE requests sequentially with delays (without waiting for completion)
async function deleteEndpointWithDelaysSequentially(delays, endpoint, initialPayload) {
    console.log('Starting DELETE requests...');
    writeLog('Starting DELETE requests...');

    let currentPayload = { ...initialPayload }; // Copy of initial payload to modify

    // Loop through delays and send requests sequentially
    for (let i = 0; i < delays.length; i++) {
        const delay = delays[i];
        currentPayload.id = (parseInt(currentPayload.id) + 1).toString(); // Increment ID or unique identifier for DELETE
        currentPayload.pps = (parseInt(currentPayload.pps) + 1).toString();
        // Wait for the specified delay before sending the request
        if (!isNaN(delay) && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay)); // Wait for the delay
        }

        // Fire the request asynchronously without waiting for its completion
        sendDeleteRequestWithDelay(i, endpoint, currentPayload);

        // Continue to next iteration without waiting for the previous request to complete
    }

    // Return the last modified payload
    return currentPayload;
}

// Main function to handle the JSON file and sequentially process invocations
async function processDeleteJsonData(jsonFilePath, endpoint, payloadTemplate) {
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
            currentPayload = await deleteEndpointWithDelaysSequentially(delays, endpoint, currentPayload);

            if (i < invokeGroups.length - 1) {
                const waitMessage = 'Waiting for 15 minutes before the next group...';
                console.log(waitMessage);
                writeLog(waitMessage);
                await new Promise(resolve => setTimeout(resolve, 900000));
            }
        }

        console.log('All DELETE requests completed.');
        writeLog('All DELETE requests completed.');
    } catch (error) {
        const errorMessage = `Error processing JSON data: ${error.message}`;
        console.error(errorMessage);
        writeLog(errorMessage);
    }
}

// Example usage:
const jsonFilePath = path.join(__dirname, 'sporadicHitTimimgs.json'); 
// const apiEndpoint = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-delete';
const apiEndpoint = 'http://localhost:3000/ric'

let payloadTemplate = {
    id: "1",  // Assuming ID is used to identify the resource to be deleted
    pps: "100",
    position: "Developer Lead",
    age: "28",
    name: "test-user"
};

processDeleteJsonData(jsonFilePath, apiEndpoint, payloadTemplate);
