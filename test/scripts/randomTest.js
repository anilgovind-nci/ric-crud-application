const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function hitEndpointWithDelays(filePath, endpoint) {
    const data = fs.readFileSync(filePath, 'utf8');
    const delays = data.split('\n').map(Number); // Parse CSV lines into an array of numbers

    console.log('Starting requests...');

    for (let i = 0; i < delays.length; i++) {
        const delay = delays[i];

        if (!isNaN(delay) && delay > 0) {
            // Fire the request and log response time
            const startTime = Date.now();

            // Asynchronously make a request
            axios
                .get(endpoint) // Change method and payload as required
                .then(response => {
                    const responseTime = Date.now() - startTime;
                    console.log(`Request ${i + 1}: Response time = ${responseTime} ms`);
                })
                .catch(error => {
                    const responseTime = Date.now() - startTime;
                    console.log(error)
                    console.log(`Request ${i + 1}: Error - Response time = ${responseTime} ms`);
                });

            // Sleep for the delay
            await sleep(delay);
        }
    }

    // console.log('All requests are sent.');
}

// Example usage:
const csvFilePath = path.join(__dirname, 'output.csv'); // Path to CSV file
const apiEndpoint = 'https://vpsllm3pah.execute-api.eu-west-1.amazonaws.com/dev/ric-get?id=75&pps=999'; // Replace with your endpoint
// const apiEndpoint = 'http://localhost:3000/test?id=75&pps=999'
hitEndpointWithDelays(csvFilePath, apiEndpoint);
