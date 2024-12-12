const fs = require('fs');
const path = require('path');
const axios = require('axios');

// function to write logs to a file
function writeLog(message) {
    const logFilePath = path.join(__dirname, 'logsForPut.txt'); 
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    fs.appendFileSync(logFilePath, logMessage, 'utf8'); 
}

// function to send PUT requests
async function sendPutRequestWithDelay(i, endpoint, currentPayload) {
    const startTime = Date.now(); 

    console.log(currentPayload);

    const config = {
        method: 'put',
        maxBodyLength: Infinity,
        url: endpoint,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(currentPayload)
    };

    try {
        const response = await axios.request(config);
        const responseTime = Date.now() - startTime;
        const logMessage = `Request ${i + 1}: Response time = ${responseTime} ms, Status = ${response.status}`;
        console.log(logMessage);
        writeLog(logMessage);
    } catch (error) {
        const responseTime = Date.now() - startTime;
        const logMessage = `Request ${i + 1}: Error - ${error.message}, Response time = ${responseTime} ms`;
        console.error(logMessage);
        writeLog(logMessage);
    }

    // return the last modified payload
    return currentPayload;
}

// function to send PUT requests sequentially
async function putEndpointWithDelaysSequentially(delays, endpoint, initialPayload) {
    console.log('Starting PUT requests...');
    writeLog('Starting PUT requests...');

    let currentPayload = { ...initialPayload };

    // loop through delays and send requests sequentially
    for (let i = 0; i < delays.length; i++) {
        const delay = delays[i];
        currentPayload.pps = (parseInt(currentPayload.pps) + 1).toString();
        currentPayload.id = (parseInt(currentPayload.id) + 1).toString();
        if (!isNaN(delay) && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay)); // Wait for the delay
        }

        // hit the request asynchronously
        sendPutRequestWithDelay(i, endpoint, currentPayload);

    }

    // return the last modified payload
    return currentPayload;
}

async function processPutJsonData(jsonFilePath, endpoint, payloadTemplate) {
    try {
        // read and parse the JSON file
        const data = fs.readFileSync(jsonFilePath, 'utf8');
        const jsonData = JSON.parse(data);

        let currentPayload = { ...payloadTemplate };

        // iterate over each invoke group in the JSON
        const invokeGroups = Object.keys(jsonData);
        for (let i = 0; i < invokeGroups.length; i++) {
            const groupName = invokeGroups[i];
            const delays = jsonData[groupName];

            const logMessage = `Processing ${groupName} with ${delays.length} delays...`;
            console.log(logMessage);
            writeLog(logMessage);

            // process the group and get the updated payload
            currentPayload = await putEndpointWithDelaysSequentially(delays, endpoint, currentPayload);

            // Wait for 15 minutes between groups, except after the last group
            if (i < invokeGroups.length - 1) {
                const waitMessage = 'Waiting for 15 minutes before the next group...';
                console.log(waitMessage);
                writeLog(waitMessage);
                await new Promise(resolve => setTimeout(resolve, 900000));
            }
        }

        console.log('All PUT requests completed.');
        writeLog('All PUT requests completed.');
    } catch (error) {
        const errorMessage = `Error processing JSON data: ${error.message}`;
        console.error(errorMessage);
        writeLog(errorMessage);
    }
}

const jsonFilePath = path.join(__dirname, 'sporadicHitTimimgs.json'); // Path to your JSON file
// const apiEndpoint = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-put'; // Replace with your PUT endpoint
const apiEndpoint = 'http://localhost:3000/ric'

let payloadTemplate = {
    id: "1",
    pps: "100",
    position: "Developer Lead",
    age: "28",
    name: "test-user"
};

processPutJsonData(jsonFilePath, apiEndpoint, payloadTemplate);
