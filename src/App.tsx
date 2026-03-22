import React, { useState } from 'react';
import './App.css';
import { generateImage } from './services/api';
import ImageGenerator from './components/ImageGenerator';
import ImageDisplay from './components/ImageDisplay';

const App: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleGenerate = async (prompt: string, aspectRatio: string, resolution: string) => {
    setIsLoading(true);
    setError('');
    setImageUrl('');

    try {
      const b64Data = await generateImage({
        prompt,
        aspect_ratio: aspectRatio,
        resolution,
      });
      setImageUrl(`data:image/png;base64,${b64Data}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong while generating the image.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>xAI Image Generator</h1>
        <p>Harness the power of Grok-Imagine</p>
      </header>
      
      <main className="app-main">
        <ImageGenerator onGenerate={handleGenerate} isLoading={isLoading} />
        
        {error && <div className="error-message">{error}</div>}
        
        <ImageDisplay imageUrl={imageUrl} isLoading={isLoading} />
      </main>
      
      <footer className="app-footer">
        <p>&copy; 2026 xAI Image Generator. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;
