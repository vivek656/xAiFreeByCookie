import React, { useState } from 'react';
import type { GenerateImageData } from '../services/api';

interface ImageDisplayProps {
  imagesData: GenerateImageData[];
  onUseForVideo?: (imageUrl: string) => void;
  onGenerateVideo?: (imageItem: GenerateImageData, index: number) => void;
  onOpenLightbox: (index: number) => void; // New prop
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ imagesData, onUseForVideo, onGenerateVideo, onOpenLightbox }) => {
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

  const toggleZoom = (idx: number) => {
    setZoomStates(prev => ({
      ...prev,
      [idx]: prev[idx] === 2 ? 1 : 2
    }));
  };

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
        const isPending = data.mime_type.endsWith('/pending');

        return (
          <div key={idx} className={`gallery-item ${isZoomed ? 'zoomed' : ''}`}>
            <div className="image-card">
              <div className="image-container">
                {isPending ? (
                  <div className="video-pending-loader">
                    <div className="loader" style={{ width: '30px', height: '30px' }}></div>
                    <p>{isVideo ? 'Generating Video...' : 'Generating Image...'}</p>
                  </div>
                ) : isVideo ? (
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
                {!isPending && (
                  <div className="overlay-actions">
                    {!isVideo && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); toggleZoom(idx); }} title="Toggle Zoom">
                          {isZoomed ? '🔍-' : '🔍+'}
                        </button>
                        {onGenerateVideo && (
                          <button onClick={(e) => { e.stopPropagation(); onGenerateVideo(data, idx); }} title="Instant Video Beside">
                            🎬
                          </button>
                        )}
                        {onUseForVideo && (
                          <button onClick={(e) => { e.stopPropagation(); onUseForVideo(src); }} title="Use for Video (Form)">
                            📋
                          </button>
                        )}
                      </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onOpenLightbox(idx); }} title="Open Fullscreen">
                      ⛶
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDownload(data, idx); }} title="Download">
                      ↓
                    </button>                  </div>
                )}
                {data.revised_prompt && !isPending && (
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
