require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('follow-redirects').https;
const http = require('follow-redirects').http;
const { URL } = require('url');

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
      'baggage': process.env.VITE_XAI_BAGGAGE || '',
      'content-type': 'application/json',
      'origin': 'https://console.x.ai',
      'sec-fetch-dest': 'empty',
      'User-Agent': 'PostmanRuntime/7.52.0',
      'Postman-Token': 'cb2dc16a-ba7d-49c9-8242-26cd207b0c53',
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
    if (status >= 400 || err) {
      const fallbackUrl = `https://vidgen.x.ai/xai-vidgen-bucket/xai-video-${id}.mp4`;
      const fallbackOptions = { method: 'HEAD', hostname: 'vidgen.x.ai', path: `/xai-vidgen-bucket/xai-video-${id}.mp4` };
      const headReq = https.request(fallbackOptions, (headRes) => {
        if (headRes.statusCode === 200) {
          res.json({
            status: 'done',
            video: { url: fallbackUrl, duration: 6, respect_moderation: false },
            model: "grok-imagine-video"
          });
        } else {
          res.status(status || 500).send(body || `Video not ready in bucket yet.`);
        }
      });
      headReq.on('error', () => res.status(status || 500).send(body));
      headReq.end();
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.status(status).send(body);
    }
  });
});

app.get('/api/proxy-asset', (req, res) => {
  const assetUrl = req.query.url;
  if (!assetUrl) return res.status(400).send('URL required');

  console.log(`Proxying asset: ${assetUrl}`);
  
  const parsedUrl = new URL(assetUrl);
  const options = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname + parsedUrl.search,
    headers: {
      'User-Agent': 'PostmanRuntime/7.52.0',
      'Accept': '*/*',
    }
  };

  https.get(options, (assetRes) => {
    if (assetRes.statusCode >= 400) {
      return res.status(assetRes.statusCode).send('Failed to fetch remote asset');
    }
    res.setHeader('Content-Type', assetRes.headers['content-type'] || 'application/octet-stream');
    assetRes.pipe(res);
  }).on('error', (err) => {
    console.error('Asset Proxy Error:', err.message);
    res.status(500).send(err.message);
  });
});

app.listen(3001, () => console.log('Proxy running at http://localhost:3001'));
