const fs = require('fs');
const path = require('path');
const axios = require('axios');

// function to write logs
function writeLog(message) {
    const logFilePath = path.join(__dirname, 'logsForPost.txt'); 
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    fs.appendFileSync(logFilePath, logMessage, 'utf8'); 
}

// function to send POST requests without the delay
async function sendPostRequestWithDelay(i, endpoint, currentPayload) {
    const startTime = Date.now(); 


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

// function to send POST requests sequentially with delays (without waiting for completion)
//mimicing real world scenario
async function postEndpointWithDelaysSequentially(delays, endpoint, initialPayload) {
    console.log('Starting POST requests...');
    writeLog('Starting POST requests...');

    let currentPayload = { ...initialPayload };

    // loop through delays and send requests sequentially
    for (let i = 0; i < delays.length; i++) {
        const delay = delays[i];
        currentPayload.pps = (parseInt(currentPayload.pps) + 1).toString();
        currentPayload.id = (parseInt(currentPayload.id) + 1).toString();
        // wait for the specified delay before sending the request
        if (!isNaN(delay) && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        // fire the request asynchronously without waiting for its completion
        sendPostRequestWithDelay(i, endpoint, currentPayload);

        // continue to next iteration without waiting for the previous request to complete
    }

    // return the last modified payload
    return currentPayload;
}

// main function to handle the JSON file and sequentially process invocations
async function processPostJsonData(jsonFilePath, endpoint, payloadTemplate) {
    try {
        const data = fs.readFileSync(jsonFilePath, 'utf8');
        const jsonData = JSON.parse(data);

        let currentPayload = { ...payloadTemplate };

        // iterate through each invoke group in the JSON
        const invokeGroups = Object.keys(jsonData);
        for (let i = 0; i < invokeGroups.length; i++) {
            const groupName = invokeGroups[i];
            const delays = jsonData[groupName];

            const logMessage = `Processing ${groupName} with ${delays.length} delays...`;
            console.log(logMessage);
            writeLog(logMessage);

            // process the group and get the updated payload
            currentPayload = await postEndpointWithDelaysSequentially(delays, endpoint, currentPayload);

            // wait for 15 minutes between groups, except after the last group
            if (i < invokeGroups.length - 1) {
                const waitMessage = 'Waiting for 15 minutes before the next group...';
                console.log(waitMessage);
                writeLog(waitMessage);
                await new Promise(resolve => setTimeout(resolve, 900000)); 
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

const jsonFilePath = path.join(__dirname, 'sporadicHitTimimgs.json'); // Path to your JSON file
const apiEndpoint = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-post'; // Replace with your endpoint
// const apiEndpoint = 'http://localhost:3000/ric'

let payloadTemplate = {
    id: "1",
    pps: "100",
    position: "Developer Lead",
    age: "28",
    name: "test-user"
};

processPostJsonData(jsonFilePath, apiEndpoint, payloadTemplate);
