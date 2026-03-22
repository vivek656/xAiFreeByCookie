require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('follow-redirects').https;

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

const makeXaiRequest = (options, bodyData, onResult) => {
  const xaiReq = https.request(options, function (xaiRes) {
    const chunks = [];
    xaiRes.on("data", (chunk) => chunks.push(chunk));
    xaiRes.on("end", () => {
      const body = Buffer.concat(chunks).toString();
      onResult(null, xaiRes.statusCode, body);
    });
    xaiRes.on("error", (error) => onResult(error));
  });
  xaiReq.on("error", (error) => onResult(error));
  if (bodyData) xaiReq.write(JSON.stringify(bodyData));
  xaiReq.end();
};

app.post('/api/generate', (req, res) => {
  const { endpoint, ...payload } = req.body;
  const options = {
    'method': 'POST',
    'hostname': 'console.x.ai',
    'path': endpoint || '/v1/images/generations',
    'headers': {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9,hi;q=0.8',
      'content-type': 'application/json',
      'origin': 'https://console.x.ai',
      'sec-fetch-dest': 'empty',
      'User-Agent': 'PostmanRuntime/7.52.0',
      'Postman-Token': '26a32172-74fe-4347-b0a7-daf270c349d4',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cookie': process.env.VITE_XAI_COOKIE || '',
    }
  };
  makeXaiRequest(options, payload, (err, status, body) => {
    if (err) return res.status(500).send(err.message);
    res.setHeader('Content-Type', 'application/json');
    res.status(status).send(body);
  });
});

app.get('/api/status/:id', (req, res) => {
  const id = req.params.id;
  const options = {
    'method': 'GET',
    'hostname': 'console.x.ai',
    'path': `/v1/videos/${id}`,
    'headers': {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9,hi;q=0.8',
      'Cookie': process.env.VITE_XAI_COOKIE || '',
      'User-Agent': 'PostmanRuntime/7.52.0',
    }
  };

  makeXaiRequest(options, null, (err, status, body) => {
    // Explicitly handle 400 or other errors by trying the direct bucket URL
    if (status >= 400 || err) {
      console.log(`Status check for ${id} returned ${status}. Attempting direct bucket fallback...`);
      
      const fallbackUrl = `https://vidgen.x.ai/xai-vidgen-bucket/xai-video-${id}.mp4`;
      const fallbackOptions = { 
        method: 'HEAD', 
        hostname: 'vidgen.x.ai', 
        path: `/xai-vidgen-bucket/xai-video-${id}.mp4` 
      };

      const headReq = https.request(fallbackOptions, (headRes) => {
        if (headRes.statusCode === 200) {
          const successJson = {
            status: 'done',
            video: {
              url: fallbackUrl,
              duration: 6,
              respect_moderation: false
            },
            model: "grok-imagine-video"
          };
          console.log(`Fallback successful for ${id}! URL: ${fallbackUrl}`);
          res.json(successJson);
        } else {
          console.log(`Fallback failed for ${id}. Bucket status: ${headRes.statusCode}`);
          res.status(status || 500).send(body || `Video not ready in bucket yet.`);
        }
      });
      
      headReq.on('error', (e) => {
        console.error(`Network error during fallback for ${id}:`, e.message);
        res.status(status || 500).send(body);
      });
      headReq.end();
    } else {
      console.log(`Official status for ${id}: ${status}`);
      res.setHeader('Content-Type', 'application/json');
      res.status(status).send(body);
    }
  });
});

app.listen(3001, () => console.log('Proxy running at http://localhost:3001'));
