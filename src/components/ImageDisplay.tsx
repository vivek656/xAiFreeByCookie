import React from 'react';

interface ImageDisplayProps {
  imageUrl: string;
  isLoading: boolean;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ imageUrl, isLoading }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="image-display-container">
      <div className="image-preview-wrapper">
        {isLoading ? (
          <div className="loader"></div>
        ) : imageUrl ? (
          <img src={imageUrl} alt="Generated" className="generated-image" />
        ) : (
          <div className="placeholder-content">
            <p>Your generated image will appear here</p>
            <small>Enter a prompt and click generate to start</small>
          </div>
        )}
      </div>

      {imageUrl && !isLoading && (
        <button onClick={handleDownload} className="download-button">
          Download Image
        </button>
      )}
    </div>
  );
};

export default ImageDisplay;
