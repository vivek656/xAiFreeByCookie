export interface GenerateImageResponse {
  created?: number;
  data?: GenerateImageData[];
  request_id?: string;
}

export interface GenerateImageData {
  b64_json?: string;
  url?: string;
  mime_type: string;
  revised_prompt: string;
  id?: string;
}

export interface VideoStatusResponse {
  status: 'pending' | 'done' | 'failed' | 'expired';
  video?: {
    url: string;
    duration: number;
  };
}

export interface GenerateImageParams {
  prompt: string;
  model?: string;
  n?: number;
  aspect_ratio?: string;
  resolution?: string;
  duration?: number;
  image_url?: string;
}

const fetchWithRetry = async (url: string, options: RequestInit, retries: number = 10): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Wait 1s first, then 2s for all subsequent retries (max 2s)
        const waitTime = i === 0 ? 1000 : 2000;
        console.warn(`Rate limit (429) hit. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Failed after ${retries} retries.`);
};

export const generateImage = async (params: GenerateImageParams): Promise<GenerateImageResponse> => {
  const { 
    prompt, 
    model = "grok-imagine-image", 
    n = 1, 
    aspect_ratio = "auto", 
    resolution = "1k",
    duration = 5,
    image_url
  } = params;

  const isVideo = model.includes('video');

  let body: Record<string, unknown>;

  if (isVideo) {
    // STRICT Video Body
    const videoBody: Record<string, unknown> = {
      model,
      prompt,
      resolution: (resolution === '2k' || resolution === '720p') ? '720p' : '480p',
      duration,
      respect_moderation: false
    };
    if (image_url && image_url.startsWith('data:')) {
      videoBody.image = { url: image_url };
    }
    body = videoBody;
  } else {
    // STRICT Image Body
    body = {
      model,
      prompt,
      n,
      aspect_ratio,
      resolution,
      response_format: "b64_json"
    };
  }

  const endpoint = isVideo ? '/v1/videos/generations' : '/v1/images/generations';
  const response = await fetchWithRetry(`http://localhost:3001/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, endpoint })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed: ${response.status} ${response.statusText}. ${errorText}`);
  }

  return await response.json();
};

export const checkVideoStatus = async (requestId: string): Promise<VideoStatusResponse> => {
  const response = await fetchWithRetry(`http://localhost:3001/api/status/${requestId}`, {
    method: 'GET'
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Status check failed: ${errorText}`);
  }
  return await response.json();
};

export const editMedia = async (params: { prompt: string, model: string, image_url?: string, video_url?: string }): Promise<GenerateImageResponse> => {
  const isVideo = params.model.includes('video');
  const endpoint = isVideo ? '/v1/videos/edits' : '/v1/images/edits';
  
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    endpoint
  };

  if (isVideo && params.video_url) {
    body.video = { url: params.video_url };
  } else if (!isVideo && params.image_url) {
    body.image = { url: params.image_url };
  }

  const response = await fetchWithRetry(`http://localhost:3001/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Edit failed: ${response.status} ${response.statusText}. ${errorText}`);
  }

  return await response.json();
};
