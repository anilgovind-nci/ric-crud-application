const fs = require('fs');
const path = require('path');

function generateRandomMilliseconds(totalTimeInSeconds, invocations) {
    const totalMilliseconds = totalTimeInSeconds * 1000;
    const randomNumbers = [];
    let sum = 0;

    // Generate random numbers for normalization
    for (let i = 0; i < invocations; i++) {
        const random = Math.random();
        randomNumbers.push(random);
        sum += random;
    }

    // Scale random numbers to match the total time in milliseconds
    const scaledMilliseconds = randomNumbers.map(random => 
        Math.round((random / sum) * totalMilliseconds)
    );

    // Adjust to ensure the sum matches exactly (due to rounding errors)
    const difference = totalMilliseconds - scaledMilliseconds.reduce((a, b) => a + b, 0);
    scaledMilliseconds[0] += difference; // Adjust the first element

    return scaledMilliseconds;
}

function saveToCsv(data, filePath) {
    const csvContent = data.join('\n'); // Join array with new lines
    fs.writeFileSync(filePath, csvContent, 'utf8'); // Write to the file
    console.log(`Data saved to ${filePath}`);
}

// Example usage:
const timeInSeconds = 5; // Total time in seconds
const invocations = 20;    // Number of invocations
const result = generateRandomMilliseconds(timeInSeconds, invocations);

// Specify the output file path
const outputPath = path.join(__dirname, 'output.csv');
saveToCsv(result, outputPath);

console.log(result);
console.log('Sum of milliseconds:', result.reduce((a, b) => a + b, 0));
