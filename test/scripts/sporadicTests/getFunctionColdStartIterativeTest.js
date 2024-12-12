const fs = require('fs');
const path = require('path');
const axios = require('axios');

// function to write logs to a file
function writeLog(message) {
    const logFilePath = path.join(__dirname, 'logsForGet.txt'); 
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    fs.appendFileSync(logFilePath, logMessage, 'utf8'); 
}

async function sendGetRequestWithDelay(i, endpoint, currentPayload) {
    const startTime = Date.now(); 
    // build the query string from the payload
    const queryParams = new URLSearchParams(currentPayload).toString();
    const urlWithParams = `${endpoint}?${queryParams}`;

    console.log(currentPayload)
    const config = {
        method: 'get', 
        maxBodyLength: Infinity,
        url: urlWithParams,
        headers: {}, 
    };

    try {
        const response = await axios.request(config);
        const responseTime = Date.now() - startTime; 
        const logMessage = `Request ${i + 1}: Response time = ${responseTime} ms, Status = ${response.status}`;
        writeLog(logMessage);
    } catch (error) {
        const responseTime = Date.now() - startTime; 
        const logMessage = `Request ${i + 1}: Error - ${error.message}, Response time = ${responseTime} ms`;
        console.error(logMessage);
        writeLog(logMessage);
    }
}

// function to send GET requests sequentially with delays
async function getEndpointWithDelaysSequentially(delays, endpoint, initialPayload) {
    console.log('Starting GET requests...');
    writeLog('Starting GET requests...');

    let currentPayload = { ...initialPayload };
    // loop through delays and send requests sequentially
    for (let i = 0; i < delays.length; i++) {
        const delay = delays[i];

        currentPayload.id = (parseInt(currentPayload.id) + 1).toString();
        currentPayload.pps = (parseInt(currentPayload.pps) + 1).toString();

        // wait for the specified delay before sending the request
        if (!isNaN(delay) && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        sendGetRequestWithDelay(i, endpoint, currentPayload);
    }

    // return the last modified payload
    return currentPayload;
}

// main function
async function processGetJsonData(jsonFilePath, endpoint, payloadTemplate) {
    try {
        // read and parse the JSON file
        const data = fs.readFileSync(jsonFilePath, 'utf8');
        const jsonData = JSON.parse(data);

        // initialize the payload to the template provided
        let currentPayload = { ...payloadTemplate };

        // iterate over each invoke group in the JSON
        const invokeGroups = Object.keys(jsonData);
        for (let i = 0; i < invokeGroups.length; i++) {
            const groupName = invokeGroups[i];
            const delays = jsonData[groupName];

            const logMessage = `Processing ${groupName} with ${delays.length} delays...`;
            console.log(logMessage);
            writeLog(logMessage);

            // Process the group and get the updated payload
            currentPayload = await getEndpointWithDelaysSequentially(delays, endpoint, currentPayload);

            // wait for 15 minutes between groups
            if (i < invokeGroups.length - 1) {
                const waitMessage = 'Waiting for 15 minutes before the next group...';
                console.log(waitMessage);
                writeLog(waitMessage);
                await new Promise(resolve => setTimeout(resolve, 900000));
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

const jsonFilePath = path.join(__dirname, 'sporadicHitTimimgs.json'); // Path to your JSON file
// const apiEndpoint = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-get'; // Replace with your GET endpoint
const apiEndpoint = 'http://localhost:3000/ric'

let payloadTemplate = {
    id: "1",  
    pps: "100"
};

processGetJsonData(jsonFilePath, apiEndpoint, payloadTemplate);
