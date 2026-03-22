import React, { useState } from 'react';
import './App.css';
import { generateImage, checkVideoStatus } from './services/api';
import type { GenerateImageData, VideoStatusResponse } from './services/api';
import ImageGenerator from './components/ImageGenerator';
import ImageDisplay from './components/ImageDisplay';

const App: React.FC = () => {
  const [imagesData, setImagesData] = useState<GenerateImageData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleGenerate = async (prompt: string, n: number, aspectRatio: string, resolution: string, model: string, duration?: number, image_url?: string) => {
    setIsLoading(true);
    setError('');
    setStatusMessage('');
    setImagesData([]);

    try {
      const response = await generateImage({
        prompt, n, aspect_ratio: aspectRatio, resolution, model, duration, image_url
      });
      
      if (response.request_id) {
        let isDone = false;
        setStatusMessage('Video is pending... Polling for results.');
        
        while (!isDone) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          const status: VideoStatusResponse = await checkVideoStatus(response.request_id);
          
          if (status.status === 'done' && status.video) {
            setImagesData([{
              url: status.video.url,
              mime_type: 'video/mp4',
              revised_prompt: prompt
            }]);
            isDone = true;
          } else if (status.status === 'failed') {
            throw new Error('Video generation failed.');
          } else if (status.status === 'expired') {
            throw new Error('Video generation request expired.');
          } else {
            setStatusMessage(`Still generating... (${status.status})`);
          }
        }
      } 
      else if (response.data) {
        setImagesData(response.data);
      }
    } catch (err: any) {
      console.error('Generation Error:', err);
      setError(err.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleImport = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const data = parsed.data || parsed;
      const validatedData = Array.isArray(data) ? data : (data ? [data] : []);
      if (validatedData.length > 0) {
        setImagesData(validatedData);
        setError('');
      } else {
        setError('No valid data found in JSON.');
      }
    } catch (e) {
      setError('Failed to parse JSON.');
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>xAI Generator</h1>
        <p>Grok-Imagine Images & Video</p>
      </header>
      
      <main className="app-main">
        <ImageGenerator onGenerate={handleGenerate} onImport={handleImport} isLoading={isLoading} />
        
        {statusMessage && <div className="status-message">{statusMessage}</div>}
        {error && <div className="error-message">{error}</div>}
        
        <ImageDisplay imagesData={imagesData} isLoading={isLoading} />
      </main>
      
      <footer className="app-footer">
        <p>&copy; 2026 xAI Image Generator. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;
