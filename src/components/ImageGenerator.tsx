import React, { useState } from 'react';

interface ImageGeneratorProps {
  onGenerate: (prompt: string, aspectRatio: string, resolution: string) => void;
  isLoading: boolean;
}

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onGenerate, isLoading }) => {
  const [prompt, setPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<string>('auto');
  const [resolution, setResolution] = useState<string>('1k');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt, aspectRatio, resolution);
    }
  };

  return (
    <div className="generator-card">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="prompt">Prompt</label>
          <textarea
            id="prompt"
            className="prompt-textarea"
            placeholder="Describe the image you want to generate..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="settings-grid">
          <div className="form-group">
            <label htmlFor="aspect_ratio">Aspect Ratio</label>
            <select
              id="aspect_ratio"
              className="select-input"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              disabled={isLoading}
            >
              <option value="auto">Auto</option>
              <option value="1:1">1:1 (Square)</option>
              <option value="4:3">4:3 (Classic)</option>
              <option value="16:9">16:9 (Widescreen)</option>
              <option value="21:9">21:9 (Ultrawide)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="resolution">Resolution</label>
            <select
              id="resolution"
              className="select-input"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              disabled={isLoading}
            >
              <option value="1k">1k</option>
              <option value="2k">2k</option>
            </select>
          </div>
        </div>

        <button type="submit" className="generate-button" disabled={isLoading || !prompt.trim()}>
          {isLoading ? (
            <>
              <div className="loader" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
              Generating...
            </>
          ) : (
            'Generate Image'
          )}
        </button>
      </form>
    </div>
  );
};

export default ImageGenerator;
