const express = require("express");
const cors = require("cors");
const axios = require("axios");
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const S3_BUCKET = process.env.S3_BUCKET;
let isRunning = false;

const uploadResultsToS3 = async (data) => {
  const fileName = `test-results-${Date.now()}.json`;
  const params = {
    Bucket: S3_BUCKET,
    Key: fileName,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  };

  try {
    await s3.send(new PutObjectCommand(params));
    console.log(`✅ Results saved to S3: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error("❌ Error uploading to S3:", error);
    throw error;
  }
};

app.post("/start-test", async (req, res) => {
  if (isRunning)
    return res.status(400).json({ message: "Test already running" });

  const { tps, duration, offset, offsetInterval } = req.body;
  let currentTps = tps;
  const startTime = Date.now();
  let lastOffsetUpdate = startTime;

  isRunning = true;
  let results = [];

  const sendRequests = async (batchSize, timestamp) => {
    let successful = 0,
      failed = 0;
    let failureReasons = {};

    const requests = Array.from({ length: batchSize }, () =>
      axios
        .get(process.env.URL)
        .then(() => successful++)
        .catch((err) => {
          failed++;
          const reason = err.response?.status || "Unknown Error";
          failureReasons[reason] = (failureReasons[reason] || 0) + 1;
        })
    );

    await Promise.allSettled(requests);

    results.push({
      time: timestamp,
      tps: batchSize,
      successful,
      failed,
      failureReasons,
    });
  };

  const interval = setInterval(async () => {
    let now = Date.now();
    if (now - startTime >= duration + 1000) {
      clearInterval(interval);
      isRunning = false;
      const fileName = await uploadResultsToS3(results);
      console.log("📤 Uploaded results to S3:", fileName);
    }

    await sendRequests(currentTps, new Date().toISOString());

    now = Date.now();
    if (now - lastOffsetUpdate >= offsetInterval) {
      currentTps += offset;
      lastOffsetUpdate = now;
    }
  }, 1000);

  res.json({ message: "Test started" });
});

const listLatestResultsFromS3 = async () => {
  try {
    const { Contents } = await s3.send(
      new ListObjectsV2Command({ Bucket: S3_BUCKET })
    );
    if (!Contents || Contents.length === 0) return null;

    // Get the latest file
    const latestFile = Contents.sort(
      (a, b) => b.LastModified - a.LastModified
    )[0];
    const getParams = { Bucket: S3_BUCKET, Key: latestFile.Key };
    const result = await s3.send(new GetObjectCommand(getParams));

    const body = await result.Body.transformToString();
    return JSON.parse(body);
  } catch (error) {
    console.error("❌ Error fetching from S3:", error);
    return null;
  }
};

app.get("/latest-results", async (req, res) => {
  const data = await listLatestResultsFromS3();
  if (!data) return res.status(404).json({ message: "No results found" });

  res.json(data);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
