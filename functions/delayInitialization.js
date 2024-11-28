// delayInitialization.js
let initialized = false;
const delay = (ms) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // blocking loop to simulate a synchronous delay (no async/await here)
  }
};
const simulateColdStart = () => {
  if (!initialized) {
    console.log("Simulating cold start with a 5-second synchronous delay...");
    delay(1000); // Block execution for 5 seconds during cold start
    console.log("Cold start delay complete.");
    initialized = true; // Flag to prevent further delays
  }
};
// Call simulateColdStart immediately on module load
simulateColdStart();
module.exports = { delay }; // Exporting just in case we need it
