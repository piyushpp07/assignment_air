const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

let results = [];
let isRunning = false;

app.post("/start-test", async (req, res) => {
  if (isRunning)
    return res.status(400).json({ message: "Test already running" });

  const { tps, duration, offset, offsetInterval } = req.body;
  let currentTps = tps;
  const startTime = Date.now();
  let lastOffsetUpdate = startTime;

  isRunning = true;
  results = [];

  while (Date.now() - startTime < duration) {
    let successful = 0,
      failed = 0;
    let failureReasons = {};

    const requests = [];
    for (let i = 0; i < currentTps; i++) {
      requests.push(
        axios
          .get(process.env.URL)
          .then(() => successful++)
          .catch((err) => {
            failed++;
            let reason = err.response?.status || "Unknown Error";
            failureReasons[reason] = (failureReasons[reason] || 0) + 1;
          })
      );
    }

    await Promise.allSettled(requests);

    console.log(
      `TPS: ${currentTps}, Successful: ${successful}, Failed: ${failed}, Reasons:`,
      failureReasons
    );

    results.push({ tps: currentTps, successful, failed, failureReasons });

    if (Date.now() - lastOffsetUpdate >= offsetInterval) {
      currentTps += offset;
      lastOffsetUpdate = Date.now();
    }

    await new Promise((res) => setTimeout(res, 1000)); // Ensure 1-second delay before next iteration
  }

  isRunning = false;
  res.json({ message: "Test completed" });
});

app.get("/results", (req, res) => {
  res.json(results);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
