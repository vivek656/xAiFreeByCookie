export interface GenerateImageResponse {
  created: number;
  data: Array<{
    b64_json: string;
  }>;
}

export interface GenerateImageParams {
  prompt: string;
  aspect_ratio?: string;
  resolution?: string;
}

export const generateImage = async (params: GenerateImageParams): Promise<string> => {
  const { prompt, aspect_ratio = "auto", resolution = "1k" } = params;

  // WARNING: These headers include session cookies and specific browser headers.
  // In a standard web app, sending these headers from localhost will likely 
  // be blocked by CORS unless a bypass is used.
  const headers = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9,hi;q=0.8',
    'baggage': 'sentry-environment=production,sentry-release=02c20777c8d95bd5f970c2c7db9787ce8bec7e18,sentry-public_key=2c359cd5d0075e2b21b60bc8d48f0a27,sentry-trace_id=fd0001aca27dd4eae0c30b7f90ad8ba4,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.8403243606185775,sentry-sample_rate=0',
    'content-type': 'application/json',
    'origin': 'https://console.x.ai',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'Cookie': 'sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiZTU2MGY2NTctNjlhOC00YThmLWI0NTgtYTMwMGFhNzY1NjVjIn0.8D8wr3MPjS-s4HHk7OnPE1mGWsFZ5y7bZiIrPYyybE0; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiZTU2MGY2NTctNjlhOC00YThmLWI0NTgtYTMwMGFhNzY1NjVjIn0.8D8wr3MPjS-s4HHk7OnPE1mGWsFZ5y7bZiIrPYyybE0; intercom-device-id-egv4py1c=db020d5c-9620-4e55-9f80-7ee804aa0f0a; __stripe_mid=4c2d0694-d4dc-45b9-b053-d5e4dbfeb28fbebb34; last-team-id=40528f18-0514-4c2a-b10e-e275e929c642; intercom-session-egv4py1c=MEk5Rk5Pb2V2UW1WSG81OGhpMlZidk45cFdZRzFFUnBCNXg3VHQxQUJab1E0cXhZNGtvKzErWmo4TWl3YTNSUGNBUVFyNXlKbDgvbXpLNnJ4bGFUS2dxVkhENnlCWXFYQWk5V3F5QkRRWEt6aGZHemhRNnpKaVRQZmo4Mlo0bXluWXhUNGt0UTQ4cUgvSFV1Y1BYeE10L1M0dUtyYWtOSVlDOG5XSjl6S3pCeVA0UG1CRHhUZkwyL1YvTDVZOEpDRndWQmJNZVlMQUdlTFFMU3I1MHU4QT09LS1Vckc5aTB5ZE1YdHdQZG42VVJNdWd3PT0=--64562a259eebc36a6077e3baadd5d6257bde51b3; cf_clearance=hdQ8CKScCu4nfHYRqPQYTkE4FntWOWHoB6PI1uQkz2k-1774175055-1.2.1.1-oqwTPUkXd_IkiN379R_pARRpd5BiFF.2zLEnBxv9YSDnv6WQQQ6wr9GLQ5_PJMKkOPwenCN3zu2azBZ64bcxciFwo.fmkLsnTHadUxZfb7B4ssr2WTSOnoxJny4gwaAnRE6OlaQUbrMqAvmJ4WluzUIgrQTO6MQ0ys6YLB14RK.jEGH8deoq99tNVv430CICp6qVUaMq3Xqyc5Ncxp8wpcEtLX3_15o8r07aFhkwTJI; mp_0b4055a12491884bcb6f34a5aa2718b6_mixpanel=%7B%22distinct_id%22%3A%2253bc7375-2efa-4598-9f9e-c83c32f388e4%22%2C%22%24device_id%22%3A%22c0c087c3-f12b-4fe2-a9a7-3625569e76b8%22%2C%22%24initial_referrer%22%3A%22https%3A%2F%2Fgrok.com%2F%22%2C%22%24initial_referring_domain%22%3A%22grok.com%22%2C%22__mps%22%3A%7B%7D%2C%22__mpso%22%3A%7B%7D%2C%22__mpus%22%3A%7B%7D%2C%22__mpa%22%3A%7B%7D%2C%22__mpu%22%3A%7B%7D%2C%22__mpr%22%3A%5B%5D%2C%22__mpap%22%3A%5B%5D%2C%22%24user_id%22%3A%2253bc7375-2efa-4598-9f9e-c83c32f388e4%22%2C%22%24search_engine%22%3A%22google%22%7D; __cf_bm=l3bXoiBZFgq3Sgb6TF2Cb1OMI8uCQg37iXAeHkQFdHI-1774175065.7261608-1.0.1.1-tqJXrPI5DLEeWMa21gG3_OLyL5uDLMKe5Al8SjhVetXqy9dDlYOJRHH.qTb2YzYD9qEvdvSzgPozySB9SOMWgc8dCcReDNAIQsRqWgVD2bpjKCoGaSIBsOQBZoWfNcfo; __stripe_sid=78a9457a-ba80-4f8b-b337-9a1971e85e5917c9a4',
  };

  const body = JSON.stringify({
    model: "grok-imagine-image",
    prompt,
    n: 1,
    aspect_ratio,
    resolution,
    response_format: "b64_json"
  });

  const response = await fetch('https://console.x.ai/v1/images/generations', {
    method: 'POST',
    headers,
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate image: ${response.status} ${response.statusText}. ${errorText}`);
  }

  const result: GenerateImageResponse = await response.json();
  return result.data[0].b64_json;
};
