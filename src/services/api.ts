export interface GenerateImageResponse {
  created?: number;
  data?: GenerateImageData[];
  request_id?: string; // New field for video polling
}

export interface GenerateImageData {
  b64_json?: string;
  url?: string; // Videos return a URL
  mime_type: string;
  revised_prompt: string;
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
  const endpoint = isVideo ? '/v1/videos/generations' : '/v1/images/generations';

  let body: any = {
    model,
    prompt,
  };

  if (isVideo) {
    body.endpoint = endpoint;
    body.resolution = (resolution === '2k' || resolution === '720p') ? '720p' : '480p';
    body.duration = duration;
    body.respect_moderation = false;
    if (image_url) body.image = { url: image_url };
  } else {
    body.endpoint = endpoint;
    body.n = n;
    body.aspect_ratio = aspect_ratio;
    body.resolution = resolution;
    body.response_format = "b64_json";
  }

  const response = await fetch('http://localhost:3001/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed: ${response.status} ${response.statusText}. ${errorText}`);
  }

  return await response.json();
};

export const checkVideoStatus = async (requestId: string): Promise<VideoStatusResponse> => {
  const response = await fetch(`http://localhost:3001/api/status/${requestId}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Status check failed: ${errorText}`);
  }
  return await response.json();
};
