let initialized = false;
// delay function for executing configured delay.
const delay = (ms) => {
  const start = Date.now();
  // A blocking loop to simulate a synchronous delay.
  while (Date.now() - start < ms) {
  }
};
//simulateColdStart function for simulating cold start.
const simulateColdStart = () => {
  if (!initialized) {
    console.log("Simulating cold start with a 5-second synchronous delay...");
    // Block execution for 5 seconds. Change this parameter for cold start.
    delay(5000); 
    console.log("Cold start delay complete.");
    // Flag to prevent further delays. The code should execute only once when new VE is created
    initialized = true; 
  }
};

// Call simulateColdStart immediately on module load to mimic cold start.
simulateColdStart();
// Can use this function for introducing delay.
module.exports = { delay };
