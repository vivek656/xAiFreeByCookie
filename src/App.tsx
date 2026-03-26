import React, { useState } from 'react';
import './App.css';
import { generateImage, checkVideoStatus, editMedia } from './services/api';
import type { GenerateImageData, VideoStatusResponse } from './services/api';
import ImageGenerator from './components/ImageGenerator';
import ImageDisplay from './components/ImageDisplay';
import JSZip from 'jszip';

const App: React.FC = () => {
  const [imagesData, setImagesData] = useState<GenerateImageData[]>([]);
  const [history, setHistory] = useState<GenerateImageData[]>([]);
  const [isLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [selectedSourceImageUrl, setSelectedSourceImageUrl] = useState<string>('');
  const [lastParams, setLastParams] = useState<{prompt: string, n: number, aspectRatio: string, resolution: string, model: string, duration?: number} | null>(null);
  const [lastRevisedPrompt, setLastRevisedPrompt] = useState<string>('');
  const [editPrompt, setEditPrompt] = useState<string>(''); // New state for edit prompt
  const [isEditing, setIsEditing] = useState<boolean>(false);
  
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const handleGenerate = async (prompt: string, n: number, aspectRatio: string, resolution: string, model: string, duration?: number, image_url?: string) => {
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
              revised_prompt: prompt,
              id: `${requestId}-${0}` // Assign ID for later identification
            }];
            isDone = true;
          } else if (status.status === 'failed') throw new Error('Video generation failed.');
          else if (status.status === 'expired') throw new Error('Request expired.');
        }
      } else if (response.data) {
        newResults = response.data.map((item, i) => ({ ...item, id: `${requestId}-${i}` })); // Assign IDs
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
    const placeholderId = `pending-video-${Date.now()}`;
    const placeholder: GenerateImageData = {
      id: placeholderId,
      mime_type: 'video/pending',
      revised_prompt: sourceItem.revised_prompt,
      url: ''
    };
    
    setImagesData(current => {
      const updated = [...current];
      updated.splice(index + 1, 0, placeholder);
      return updated;
    });

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
          const status: VideoStatusResponse = await checkVideoStatus(response.request_id);
          if (status.status === 'done' && status.video) {
            const finalVideo: GenerateImageData = {
              url: status.video.url,
              mime_type: 'video/mp4',
              revised_prompt: sourceItem.revised_prompt,
              id: placeholderId // Use the same ID to replace
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

  const handleEditMedia = async (itemToEdit: GenerateImageData, promptToUse: string, model: string) => {
    const src = itemToEdit.url || (itemToEdit.b64_json ? `data:${itemToEdit.mime_type};base64,${itemToEdit.b64_json}` : '');
    if (!src || !promptToUse.trim()) return;

    // Insert placeholder beside the original item
    const originalIndex = imagesData.findIndex(item => item.id === itemToEdit.id);
    if (originalIndex === -1) return;

    const placeholderId = `editing-${Date.now()}`;
    const isVideo = itemToEdit.mime_type.startsWith('video/');
    const placeholder: GenerateImageData = {
      id: placeholderId,
      mime_type: isVideo ? 'video/pending' : 'image/pending',
      revised_prompt: `Editing: ${promptToUse}`,
      url: ''
    };

    setIsEditing(true);
    
    setImagesData(current => {
      const updated = [...current];
      // Find the actual index of the item, not just history index
      const actualIndex = updated.findIndex(item => item.id === itemToEdit.id);
      if (actualIndex !== -1) {
        updated.splice(actualIndex + 1, 0, placeholder);
      }
      return updated;
    });

    // Run the edit process in background so the modal stays open
    (async () => {
      try {
        const response = await editMedia({
          prompt: promptToUse,
          model: model, // 'grok-imagine-image' or 'grok-imagine-video'
          image_url: isVideo ? undefined : src,
          video_url: isVideo ? src : undefined
        });

        let newResult: GenerateImageData | null = null;

        if (response.request_id) {
          let isDone = false;
          while (!isDone) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const status: VideoStatusResponse = await checkVideoStatus(response.request_id);
            if (status.status === 'done' && status.video) {
              newResult = {
                url: status.video.url,
                mime_type: 'video/mp4',
                revised_prompt: promptToUse,
                id: `edited-${Date.now()}` // Give it a new unique ID
              };
              isDone = true;
            } else if (status.status === 'failed' || status.status === 'expired') {
              throw new Error('Media editing failed at xAI.');
            }
          }
        } else if (response.data && response.data.length > 0) {
          newResult = { ...response.data[0], revised_prompt: promptToUse, id: `edited-${Date.now()}` }; // Give it a new unique ID
        }

        if (newResult) {
          // Replace placeholder with actual result
          setImagesData(current => current.map(item => item.id === placeholderId ? newResult! : item));
          setHistory(prev => [newResult!, ...prev]);
        } else {
          throw new Error('No data received from edit API.');
        }
      } catch (err: unknown) {
        console.error('Media editing error:', err);
        // Remove placeholder on failure
        setImagesData(current => current.filter(item => item.id !== placeholderId));
        setError(err instanceof Error ? err.message : 'Media editing failed.');
      } finally {
        setIsEditing(false);
        // Keep the lightbox open so the user stays on the same popup
      }
    })();

    // Return immediately; job runs in background
  };

  const handleOpenLightbox = (index: number) => {
    setLightboxIdx(index);
    // Set initial edit prompt to current item's revised prompt for convenience
    setEditPrompt(imagesData[index]?.revised_prompt || '');
  };

  // Lightbox navigation
  const navigateLightbox = (direction: number) => {
    if (lightboxIdx === null) return;
    // We navigate through the entire 'imagesData' for the lightbox
    const nextIdx = (lightboxIdx + direction + imagesData.length) % imagesData.length;
    setLightboxIdx(nextIdx);
    setEditPrompt(imagesData[nextIdx]?.revised_prompt || ''); // Update edit prompt when navigating
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
              <div key={idx} className="history-thumb-mini" onClick={() => handleOpenLightbox(imagesData.findIndex(data => data.id === item.id))}>
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
          {history.length > 0 && (
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
          onOpenLightbox={handleOpenLightbox}
        />

        {imagesData.length > 0 && (
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
                <div key={idx} className="history-item-full" onClick={() => handleOpenLightbox(imagesData.findIndex(data => data.id === item.id))}>
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
      {lightboxIdx !== null && imagesData[lightboxIdx] && (
        <div className="lightbox-overlay" onClick={() => setLightboxIdx(null)}>
          <button className="lightbox-close" onClick={() => setLightboxIdx(null)}>×</button>
          <button className="lightbox-nav prev" onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}>‹</button>
          <button className="lightbox-nav next" onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}>›</button>
          
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {imagesData[lightboxIdx].mime_type.startsWith('video/') ? (
              <video src={imagesData[lightboxIdx].url} controls autoPlay loop />
            ) : (
              <img src={imagesData[lightboxIdx].url || `data:${imagesData[lightboxIdx].mime_type};base64,${imagesData[lightboxIdx].b64_json}`} alt="Maximized" />
            )}
            <div className="lightbox-info">
              <p>{imagesData[lightboxIdx].revised_prompt}</p>
              <div className="lightbox-actions">
                <button onClick={() => {
                  const item = imagesData[lightboxIdx];
                  if (!item || item.mime_type.endsWith('/pending')) return;
                  const link = document.createElement('a');
                  const ext = item.mime_type.split('/')[1] || 'png';
                  link.href = item.url || `data:${item.mime_type};base64,${item.b64_json}`;
                  link.download = `history-${Date.now()}.${ext}`;
                  link.click();
                }}>Download</button>
                {!imagesData[lightboxIdx].mime_type.startsWith('video/') && (
                  <button onClick={() => {
                    const item = imagesData[lightboxIdx];
                    if (!item || item.mime_type.endsWith('/pending')) return;
                    setSelectedSourceImageUrl(item.url || `data:${item.mime_type};base64,${item.b64_json}`);
                    setLightboxIdx(null);
                  }}>Use for Video</button>
                )}
              </div>
              
              {/* Edit Section */}
              {!imagesData[lightboxIdx].mime_type.endsWith('/pending') && (
                <div className="lightbox-edit-section">
                  <h3>Tweak this Media</h3>
                  <div className="edit-controls">
                    <button
                      onClick={() => handleEditMedia(
                        imagesData[lightboxIdx],
                        editPrompt,
                        imagesData[lightboxIdx].mime_type.startsWith('video/') ? 'grok-imagine-video' : 'grok-imagine-image'
                      )}
                      disabled={!editPrompt.trim() || isEditing}
                    >
                      {isEditing ? 'Queued...' : 'Tweak Media'}
                    </button>
                    <div className="edit-status">
                      {isEditing ? 'Edit queued — processing...' : 'Ready to edit'}
                    </div>
                  </div>
                  <textarea
                    placeholder="e.g., 'Make it look like a renaissance painting' or 'Change the car to a spaceship'"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
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
