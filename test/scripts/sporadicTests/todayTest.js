const fs = require('fs');
const path = require('path');

// Function to read and parse the JSON file, then print each array value with delay
function readJsonFileAndPrintValuesWithDelay(jsonFilePath) {
    try {
        // Read and parse the JSON file
        const data = fs.readFileSync(jsonFilePath, 'utf8');
        const jsonData = JSON.parse(data);

        // Extract the keys (invoke groups)
        const invokeGroups = Object.keys(jsonData);

        // Iterate through each key (group) and print the array values with delay
        invokeGroups.forEach((group, index) => {
            const values = jsonData[group]; // Get the array of values for the current group

            // Iterate over each value in the array and print with delay
            values.forEach((value, valueIndex) => {
                setTimeout(() => {
                    console.log(value); // Print the value from the array
                }, (index * values.length + valueIndex) * 3000); // Delay for each value
            });
        });
    } catch (error) {
        console.error(`Error reading or parsing the file: ${error.message}`);
    }
}

// Example usage
const jsonFilePath = path.join(__dirname, 'sporadicHitTimimgs.json'); // Path to your JSON file
readJsonFileAndPrintValuesWithDelay(jsonFilePath);
