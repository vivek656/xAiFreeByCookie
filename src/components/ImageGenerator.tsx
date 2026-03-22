import React, { useState, useRef } from 'react';

interface ImageGeneratorProps {
  onGenerate: (prompt: string, n: number, aspectRatio: string, resolution: string, model: string, duration?: number, imageUrl?: string) => void;
  onImport: (jsonStr: string) => void;
  isLoading: boolean;
}

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onGenerate, onImport, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'import'>('generate');
  const [prompt, setPrompt] = useState<string>('');
  const [model, setModel] = useState<string>('grok-imagine-image');
  const [n, setN] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<string>('auto');
  const [resolution, setResolution] = useState<string>('1k');
  const [duration, setDuration] = useState<number>(5);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [importJson, setImportJson] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'generate' && prompt.trim()) {
      onGenerate(prompt, n, aspectRatio, resolution, model, duration, imageUrl);
    } else if (activeTab === 'import' && importJson.trim()) {
      onImport(importJson);
      setImportJson('');
    }
  };

  const isVideo = model.includes('video');

  return (
    <div className="generator-card">
      <div className="tab-header">
        <button 
          className={`tab-button ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          Generate
        </button>
        <button 
          className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          Import from Postman
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {activeTab === 'generate' ? (
          <>
            <div className="form-group">
              <label htmlFor="prompt">Prompt</label>
              <textarea
                id="prompt"
                className="prompt-textarea"
                placeholder="Describe what you want to generate..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {isVideo && (
              <div className="form-group">
                <label>Source Image (Optional for Video)</label>
                <div className="image-upload-wrapper">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                  />
                  <button 
                    type="button" 
                    className="secondary-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUrl ? 'Change Image' : 'Upload Image'}
                  </button>
                  {imageUrl && (
                    <div className="upload-preview">
                      <img src={imageUrl} alt="Upload preview" />
                      <button type="button" onClick={() => setImageUrl('')}>×</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="settings-grid">
              <div className="form-group">
                <label htmlFor="model">Mode</label>
                <select
                  id="model"
                  className="select-input"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="grok-imagine-image">Image</option>
                  <option value="grok-imagine-video">Video</option>
                </select>
              </div>

              {!isVideo && (
                <>
                  <div className="form-group">
                    <label htmlFor="n">Quantity</label>
                    <input
                      id="n"
                      type="number"
                      min="1"
                      max="4"
                      className="select-input"
                      value={n}
                      onChange={(e) => setN(parseInt(e.target.value))}
                      disabled={isLoading}
                    />
                  </div>
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
                      <option value="1:1">1:1</option>
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                    </select>
                  </div>
                </>
              )}

              {isVideo && (
                <div className="form-group">
                  <label htmlFor="duration">Duration (sec)</label>
                  <input
                    id="duration"
                    type="number"
                    min="1"
                    max="10"
                    className="select-input"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    disabled={isLoading}
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="resolution">Resolution</label>
                <select
                  id="resolution"
                  className="select-input"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  disabled={isLoading}
                >
                  {isVideo ? (
                    <>
                      <option value="480p">480p</option>
                      <option value="720p">720p</option>
                    </>
                  ) : (
                    <>
                      <option value="1k">1k</option>
                      <option value="2k">2k</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          </>
        ) : (
          <div className="form-group">
            <label htmlFor="import">Paste Postman Response JSON</label>
            <textarea
              id="import"
              className="prompt-textarea"
              placeholder='Paste the JSON response'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              required
            />
          </div>
        )}

        <button type="submit" className="generate-button" disabled={isLoading || (activeTab === 'generate' ? !prompt.trim() : !importJson.trim())}>
          {isLoading ? (
            <>
              <div className="loader" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
              Generating...
            </>
          ) : (
            activeTab === 'generate' ? 'Generate' : 'Import'
          )}
        </button>
      </form>
    </div>
  );
};

export default ImageGenerator;
