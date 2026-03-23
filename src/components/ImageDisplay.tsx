import React, { useState } from 'react';
import type { GenerateImageData } from '../services/api';

interface ImageDisplayProps {
  imagesData: GenerateImageData[];
  isLoading: boolean;
  onUseForVideo?: (imageUrl: string) => void;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ imagesData, isLoading, onUseForVideo }) => {
  const [zoomStates, setZoomStates] = useState<Record<number, number>>({});

  const getSource = (data: GenerateImageData) => {
    if (data.url) return data.url;
    if (data.b64_json) return `data:${data.mime_type};base64,${data.b64_json}`;
    return '';
  };

  const handleDownload = (data: GenerateImageData, idx: number) => {
    const src = getSource(data);
    if (!src) return;
    const link = document.createElement('a');
    const extension = data.mime_type.split('/')[1] || 'mp4';
    // eslint-disable-next-line react-hooks/purity
    const timestamp = Date.now();
    link.href = src;
    link.download = `generated-${idx}-${timestamp}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewWindow = (data: GenerateImageData) => {
    const src = getSource(data);
    if (!src) return;
    const win = window.open();
    if (win) {
      const content = data.mime_type.startsWith('video/') 
        ? `<video src="${src}" controls autoplay loop style="max-width:100%; max-height:100vh;"></video>`
        : `<img src="${src}" style="max-width:100%; max-height:100vh;" />`;

      win.document.write(`
        <html>
          <body style="margin:0; background:#000; display:flex; justify-content:center; align-items:center; min-height:100vh;">
            ${content}
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  const toggleZoom = (idx: number) => {
    setZoomStates(prev => ({
      ...prev,
      [idx]: prev[idx] === 2 ? 1 : 2
    }));
  };

  if (isLoading) {
    return (
      <div className="gallery-container">
        <div className="loader-wrapper">
          <div className="loader"></div>
          <p>Processing results...</p>
        </div>
      </div>
    );
  }

  if (imagesData.length === 0) {
    return (
      <div className="gallery-container">
        <div className="placeholder-content">
          <p>Your generated content will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-grid">
      {imagesData.map((data, idx) => {
        const isZoomed = zoomStates[idx] === 2;
        const src = getSource(data);
        const isVideo = data.mime_type.startsWith('video/');

        return (
          <div key={idx} className={`gallery-item ${isZoomed ? 'zoomed' : ''}`}>
            <div className="image-card">
              <div className="image-container">
                {isVideo ? (
                  <video src={src} controls loop autoPlay muted style={{ transform: 'none' }} />
                ) : (
                  <img 
                    src={src} 
                    alt={data.revised_prompt} 
                    style={{ transform: `scale(${zoomStates[idx] || 1})` }}
                  />
                )}
              </div>
              
              <div className="image-overlay">
                <div className="overlay-actions">
                  {!isVideo && (
                    <>
                      <button onClick={() => toggleZoom(idx)} title="Toggle Zoom">
                        {isZoomed ? '🔍-' : '🔍+'}
                      </button>
                      {onUseForVideo && (
                        <button onClick={() => onUseForVideo(src)} title="Use for Video">
                          🎬
                        </button>
                      )}
                    </>
                  )}
                  <button onClick={() => handleOpenInNewWindow(data)} title="Open Fullscreen">
                    ⛶
                  </button>
                  <button onClick={() => handleDownload(data, idx)} title="Download">
                    ↓
                  </button>
                </div>
                {data.revised_prompt && (
                  <div className="overlay-prompt">
                    {data.revised_prompt}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ImageDisplay;
