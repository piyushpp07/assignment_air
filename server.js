const axios = require("axios");

const API_URL = "http://localhost:3001/"; // API endpoint
let tps = 500; // Initial TPS
const offset = 100; // Increase/decrease offset
const interval = 5000; // Apply offset every 5 seconds
const duration = 20000; // Total test duration in milliseconds
const totalTransactions = 1000; // Total transactions per second

const sendRequests = async (currentTps) => {
  let successfulRequests = 0;
  let failedRequests = 0;
  let requestsSent = 0;

  const requests = Array.from(
    { length: Math.min(currentTps, totalTransactions) },
    async () => {
      if (requestsSent < totalTransactions) {
        try {
          await axios.get(API_URL);
          successfulRequests++;
        } catch (error) {
          failedRequests++;
        }
        requestsSent++;
      } else {
        failedRequests++;
      }
    }
  );

  await Promise.all(requests);
  console.log(
    `TPS: ${currentTps} | Successful: ${successfulRequests}, Failed: ${failedRequests}`
  );
};

const runLoadTest = async () => {
  const startTime = Date.now();
  let intervalId;

  const runTestCycle = async () => {
    if (Date.now() - startTime >= duration) {
      clearInterval(intervalId);
      console.log("Test Completed!");
      return;
    }
    await sendRequests(tps);
  };

  intervalId = setInterval(runTestCycle, 1000);

  const offsetInterval = setInterval(() => {
    if (Date.now() - startTime >= duration) {
      clearInterval(offsetInterval);
      return;
    }
    tps += offset;
    console.log(`Updated TPS: ${tps}`);
  }, interval);
};

runLoadTest();
