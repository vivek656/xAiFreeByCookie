import React, { useState } from 'react';
import './App.css';
import { generateImage, checkVideoStatus } from './services/api';
import type { GenerateImageData, VideoStatusResponse } from './services/api';
import ImageGenerator from './components/ImageGenerator';
import ImageDisplay from './components/ImageDisplay';
import JSZip from 'jszip';

const App: React.FC = () => {
  const [imagesData, setImagesData] = useState<GenerateImageData[]>([]);
  const [history, setHistory] = useState<GenerateImageData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [selectedSourceImageUrl, setSelectedSourceImageUrl] = useState<string>('');
  const [lastParams, setLastParams] = useState<{prompt: string, n: number, aspectRatio: string, resolution: string, model: string, duration?: number} | null>(null);
  const [lastRevisedPrompt, setLastRevisedPrompt] = useState<string>('');
  
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const handleGenerate = async (prompt: string, n: number, aspectRatio: string, resolution: string, model: string, duration?: number, image_url?: string) => {
    setIsLoading(true);
    setError('');
    setStatusMessage('');
    
    // Create unique placeholders for this request batch
    const requestId = `batch-${Date.now()}`;
    const isVideo = model.includes('video');
    const placeholders: GenerateImageData[] = Array.from({ length: isVideo ? 1 : n }).map((_, i) => ({
      id: `${requestId}-${i}`,
      mime_type: isVideo ? 'video/pending' : 'image/pending',
      revised_prompt: prompt,
      url: ''
    }));

    setImagesData(prev => [...prev, ...placeholders]);

    try {
      const currentPrompt = (lastRevisedPrompt && prompt === lastParams?.prompt) ? lastRevisedPrompt : prompt;
      
      const response = await generateImage({
        prompt: currentPrompt, n, aspect_ratio: aspectRatio, resolution, model, duration, image_url
      });
      
      let newResults: GenerateImageData[] = [];

      if (response.request_id) {
        let isDone = false;
        while (!isDone) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          const status: VideoStatusResponse = await checkVideoStatus(response.request_id);
          if (status.status === 'done' && status.video) {
            newResults = [{
              url: status.video.url,
              mime_type: 'video/mp4',
              revised_prompt: prompt
            }];
            isDone = true;
          } else if (status.status === 'failed') throw new Error('Video generation failed.');
          else if (status.status === 'expired') throw new Error('Request expired.');
        }
      } else if (response.data) {
        newResults = response.data;
        // Capture the revised prompt for the next iterative enhancement
        if (newResults[0]?.revised_prompt) {
          setLastRevisedPrompt(newResults[0].revised_prompt);
        }
      }

      if (newResults.length > 0) {
        // Replace placeholders with real results
        setImagesData(current => {
          const filtered = current.filter(item => !item.id?.startsWith(requestId));
          return [...filtered, ...newResults];
        });
        setHistory(prev => [...newResults, ...prev]);
        setLastParams({ prompt, n, aspectRatio, resolution, model, duration });
      }
    } catch (err: unknown) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      // Remove placeholders on failure
      setImagesData(current => current.filter(item => !item.id?.startsWith(requestId)));
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleLoadMore = () => {
    if (lastParams) {
      handleGenerate(
        lastParams.prompt, 
        lastParams.n, 
        lastParams.aspectRatio, 
        lastParams.resolution, 
        lastParams.model, 
        lastParams.duration,
        selectedSourceImageUrl // Preserve source image if any
      );
    }
  };

  const handleGenerateVideoDirect = async (sourceItem: GenerateImageData, index: number) => {
    const src = sourceItem.url || (sourceItem.b64_json ? `data:${sourceItem.mime_type};base64,${sourceItem.b64_json}` : '');
    if (!src) return;

    // 1. Insert placeholder beside the image
    const placeholderId = `pending-${Date.now()}`;
    const placeholder: GenerateImageData = {
      id: placeholderId,
      mime_type: 'video/pending',
      revised_prompt: sourceItem.revised_prompt,
      url: ''
    };
    
    const newImagesData = [...imagesData];
    newImagesData.splice(index + 1, 0, placeholder);
    setImagesData(newImagesData);

    try {
      const response = await generateImage({
        prompt: sourceItem.revised_prompt,
        model: 'grok-imagine-video',
        image_url: src,
        duration: 5,
        resolution: '480p'
      });

      if (response.request_id) {
        let isDone = false;
        while (!isDone) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          const status = await checkVideoStatus(response.request_id);
          if (status.status === 'done' && status.video) {
            const finalVideo: GenerateImageData = {
              url: status.video.url,
              mime_type: 'video/mp4',
              revised_prompt: sourceItem.revised_prompt
            };
            // Replace placeholder with actual video
            setImagesData(current => current.map(item => item.id === placeholderId ? finalVideo : item));
            setHistory(prev => [finalVideo, ...prev]);
            isDone = true;
          } else if (status.status === 'failed' || status.status === 'expired') {
            throw new Error('Video generation failed at xAI.');
          }
        }
      }
    } catch (err: unknown) {
      console.error('In-place video error:', err);
      // Remove placeholder on failure as requested
      setImagesData(current => current.filter(item => item.id !== placeholderId));
      setError(err instanceof Error ? err.message : 'Video generation failed.');
    }
  };

  const handleDownloadAll = async () => {
    if (history.length === 0) return;
    
    const zip = new JSZip();
    setStatusMessage(`Preparing ZIP with ${history.length} items...`);
    
    try {
      for (let i = 0; i < history.length; i++) {
        const item = history[i];
        const extension = item.mime_type.split('/')[1] || 'png';
        const fileName = `generation-${history.length - i}.${extension}`;
        
        if (item.b64_json) {
          zip.file(fileName, item.b64_json, { base64: true });
        } else if (item.url) {
          // CALL VIA VITE PROXY
          try {
            const proxyUrl = `/proxy-asset?url=${encodeURIComponent(item.url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`Proxy fetch failed for ${item.url}`);
            const blob = await response.blob();
            zip.file(fileName, blob);
          } catch (fetchErr) {
            console.error(`Proxy fetch error for ${item.url}:`, fetchErr);
          }
        }
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `xai-history-${Date.now()}.zip`;
      link.click();
    } catch (err: unknown) {
      console.error('ZIP Error:', err);
      setError(`Failed to create ZIP file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
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
        setHistory(prev => [...validatedData, ...prev]);
        setError('');
      }
    } catch (err: unknown) { 
      console.error('Import Error:', err);
      setError('Failed to parse JSON.'); 
    }
  };

  const navigateLightbox = (direction: number) => {
    if (lightboxIdx === null) return;
    const nextIdx = (lightboxIdx + direction + history.length) % history.length;
    setLightboxIdx(nextIdx);
  };

  return (
    <div className="app-container">
      {/* Compact History Widget */}
      {history.length > 0 && (
        <div className="history-widget">
          <div className="history-widget-header">
            <span>History ({history.length})</span>
            <div className="widget-btns">
              <button onClick={handleDownloadAll} title="Download All ZIP">ZIP</button>
              <button onClick={() => setIsHistoryModalOpen(true)}>Full</button>
            </div>
          </div>
          <div className="history-widget-grid">
            {history.slice(0, 4).map((item, idx) => (
              <div key={idx} className="history-thumb-mini" onClick={() => setLightboxIdx(idx)}>
                {item.mime_type.startsWith('video/') ? (
                  <div className="video-icon-mini">🎬</div>
                ) : (
                  <img src={item.url || `data:${item.mime_type};base64,${item.b64_json}`} alt="History" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <header className="app-header">
        <h1>xAI Generator</h1>
        <p>Grok-Imagine Images & Video</p>
      </header>
      
      <main className="app-main">
        <ImageGenerator 
          onGenerate={handleGenerate} 
          onImport={handleImport} 
          isLoading={isLoading} 
          preselectedImageUrl={selectedSourceImageUrl}
        />
        
        <div className="batch-actions">
          {statusMessage && <div className="status-message">{statusMessage}</div>}
          {history.length > 0 && !isLoading && (
            <button onClick={handleDownloadAll} className="download-all-btn">
              Download All History ZIP ( {history.length} items )
            </button>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}
        
        <ImageDisplay 
          imagesData={imagesData} 
          isLoading={isLoading} 
          onUseForVideo={setSelectedSourceImageUrl}
          onGenerateVideo={handleGenerateVideoDirect}
        />

        {imagesData.length > 0 && !isLoading && (
          <div className="load-more-container">
            <button onClick={handleLoadMore} className="load-more-btn">
              Generate 4 More (Enhanced Prompt)
            </button>
            {lastRevisedPrompt && (
              <p className="revised-prompt-preview">
                <strong>Next Prompt:</strong> {lastRevisedPrompt}
              </p>
            )}
          </div>
        )}
      </main>

      {/* History Full Modal */}
      {isHistoryModalOpen && (
        <div className="modal-overlay" onClick={() => setIsHistoryModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Generation History ({history.length})</h2>
              <div className="modal-header-actions">
                <button className="download-all-btn-small" onClick={handleDownloadAll}>Download All as ZIP</button>
                <button className="close-btn" onClick={() => setIsHistoryModalOpen(false)}>×</button>
              </div>
            </div>
            <div className="history-full-grid">
              {history.map((item, idx) => (
                <div key={idx} className="history-item-full" onClick={() => { setLightboxIdx(idx); setIsHistoryModalOpen(false); }}>
                  {item.mime_type.startsWith('video/') ? (
                    <div className="video-preview-full">🎬 Video</div>
                  ) : (
                    <img src={item.url || `data:${item.mime_type};base64,${item.b64_json}`} alt="History" />
                  )}
                  <p className="item-prompt">{item.revised_prompt || 'No prompt'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxIdx !== null && (
        <div className="lightbox-overlay" onClick={() => setLightboxIdx(null)}>
          <button className="lightbox-close" onClick={() => setLightboxIdx(null)}>×</button>
          <button className="lightbox-nav prev" onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}>‹</button>
          <button className="lightbox-nav next" onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}>›</button>
          
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {history[lightboxIdx].mime_type.startsWith('video/') ? (
              <video src={history[lightboxIdx].url} controls autoPlay loop />
            ) : (
              <img src={history[lightboxIdx].url || `data:${history[lightboxIdx].mime_type};base64,${history[lightboxIdx].b64_json}`} alt="Maximized" />
            )}
            <div className="lightbox-info">
              <p>{history[lightboxIdx].revised_prompt}</p>
              <div className="lightbox-actions">
                <button onClick={() => {
                  const item = history[lightboxIdx];
                  const link = document.createElement('a');
                  const ext = item.mime_type.split('/')[1] || 'png';
                  link.href = item.url || `data:${item.mime_type};base64,${item.b64_json}`;
                  link.download = `history-${Date.now()}.${ext}`;
                  link.click();
                }}>Download</button>
                {!history[lightboxIdx].mime_type.startsWith('video/') && (
                  <button onClick={() => {
                    setSelectedSourceImageUrl(history[lightboxIdx].url || `data:${history[lightboxIdx].mime_type};base64,${history[lightboxIdx].b64_json}`);
                    setLightboxIdx(null);
                  }}>Use for Video</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <p>&copy; 2026 xAI Image Generator.</p>
      </footer>
    </div>
  );
};

export default App;
