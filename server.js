const axios = require("axios");

const API_URL = "http://localhost:3001/";
let tps = 500; // Initial TPS
const offset = 100; // Increase TPS after a certain time
const interval = 5000; // Time interval for increasing the tps
const duration = 20000; // total test duration 

const runLoadTest = async () => {
  const startTime = Date.now();
  let lastOffsetTime = startTime; // Track last offset update

  while (Date.now() - startTime < duration) {
    let successful = 0,
      failed = 0;

    const requests = [];
    for (let i = 0; i < tps; i++) {
      requests.push(
        axios
          .get(API_URL)
          .then(() => successful++)
          .catch(() => failed++)
      );
    }

    await Promise.all(requests);
    console.log(`TPS: ${tps} | Successful: ${successful}, Failed: ${failed}`);

    //increasing the offset after a certain time
    if (Date.now() - lastOffsetTime >= interval) {
      tps += offset;
      console.log(`Updated TPS: ${tps}`);
      lastOffsetTime = Date.now(); //re-setting the offset time

    await new Promise((res) => setTimeout(res, 1000)); // Wait 1 sec before next round
  }

  console.log("Test is Completed! Exiting...");
};

runLoadTest();
