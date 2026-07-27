import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RotateCw, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface InstrumentImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  instrumentName: string;
  imageUrl: string | null;
  fallbackUrls?: {
    thumbnail: string;
    preview: string;
    uc: string;
    original: string;
  } | null;
  allInstruments?: Array<{ name: string; url: string; fallbackUrls?: any }>;
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  headerActions?: React.ReactNode;
}

export function InstrumentImageModal({
  isOpen,
  onClose,
  instrumentName,
  imageUrl,
  fallbackUrls,
  allInstruments = [],
  currentIndex = 0,
  onNavigate,
  headerActions,
}: InstrumentImageModalProps) {
  const [currentImageError, setCurrentImageError] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(imageUrl || '');
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [triedUrls, setTriedUrls] = useState<Set<string>>(new Set());
  const [allFormatsFailed, setAllFormatsFailed] = useState(false);

  useEffect(() => {
    if (imageUrl) {
      setCurrentUrl(imageUrl);
      setRotation(0);
      setZoom(1);
      setCurrentImageError(false);
      setTriedUrls(new Set([imageUrl]));
      setAllFormatsFailed(false);
    }
  }, [imageUrl]);
//hey
  const handleImageError = () => {
    if (!fallbackUrls) {
      setAllFormatsFailed(true);
      return;
    }

    // Track that we tried this URL
    const updatedTriedUrls = new Set([...triedUrls, currentUrl]);
    setTriedUrls(updatedTriedUrls);
    
    // Try alternative formats in order: thumbnail -> preview -> uc -> original
    // Check which format we're currently on and try the next one
    if (currentUrl === fallbackUrls.thumbnail && !updatedTriedUrls.has(fallbackUrls.preview)) {
      setCurrentImageError(true);
      setCurrentUrl(fallbackUrls.preview);
      return;
    }
    if (currentUrl === fallbackUrls.preview && !updatedTriedUrls.has(fallbackUrls.uc)) {
      setCurrentImageError(true);
      setCurrentUrl(fallbackUrls.uc);
      return;
    }
    if (currentUrl === fallbackUrls.uc && fallbackUrls.original && !updatedTriedUrls.has(fallbackUrls.original)) {
      setCurrentImageError(true);
      setCurrentUrl(fallbackUrls.original);
      return;
    }
    
    // Also try formats we haven't tried yet, regardless of current URL
    if (!updatedTriedUrls.has(fallbackUrls.preview)) {
      setCurrentImageError(true);
      setCurrentUrl(fallbackUrls.preview);
      return;
    }
    if (!updatedTriedUrls.has(fallbackUrls.uc)) {
      setCurrentImageError(true);
      setCurrentUrl(fallbackUrls.uc);
      return;
    }
    if (fallbackUrls.original && !updatedTriedUrls.has(fallbackUrls.original)) {
      setCurrentImageError(true);
      setCurrentUrl(fallbackUrls.original);
      return;
    }
    
    // If we've tried all formats, show error
    setAllFormatsFailed(true);
    setCurrentImageError(false);
  };

  const handleImageLoad = () => {
    setCurrentImageError(false);
    setAllFormatsFailed(false);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleNext = () => {
    if (allInstruments.length > 0 && onNavigate) {
      const nextIndex = (currentIndex + 1) % allInstruments.length;
      onNavigate(nextIndex);
    }
  };

  const handlePrevious = () => {
    if (allInstruments.length > 0 && onNavigate) {
      const prevIndex = (currentIndex - 1 + allInstruments.length) % allInstruments.length;
      onNavigate(prevIndex);
    }
  };

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.preventDefault();
    if (fallbackUrls?.original) {
      window.open(fallbackUrls.original, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[92vh] p-3 sm:p-6 overflow-hidden flex flex-col">
        <DialogHeader className="px-1 pt-1 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="min-w-0 truncate text-sm sm:text-base">{instrumentName}</DialogTitle>
            {headerActions ? <div className="flex items-center gap-2 flex-shrink-0">{headerActions}</div> : null}
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-1 sm:p-4 relative overflow-hidden">
          {currentImageError && fallbackUrls && !allFormatsFailed && (
            <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 flex-shrink-0">
              Trying alternative URL format...
            </div>
          )}
          
          {allFormatsFailed && (
            <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex-shrink-0">
              <p className="font-semibold">Unable to load image</p>
              <p className="mt-1 text-[11px]">All image formats failed to load. Please check the image URL.</p>
              {fallbackUrls?.original && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInNewTab}
                  className="mt-2 text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Try opening in new tab
                </Button>
              )}
            </div>
          )}
          
          {/* Image Container */}
          <div className="relative w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden my-auto">
            {/* Navigation Buttons */}
            {allInstruments.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevious}
                  className="absolute left-1 sm:left-2 z-10 bg-background/80 backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
                  disabled={allInstruments.length <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                  className="absolute right-1 sm:right-2 z-10 bg-background/80 backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
                  disabled={allInstruments.length <= 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}

            {/* Image Box */}
            <div className={`w-full h-full max-h-[48vh] sm:max-h-[62vh] flex items-center justify-center p-1 ${zoom > 1 ? 'overflow-auto' : 'overflow-hidden'}`}>
              {!allFormatsFailed ? (
                <img
                  key={currentUrl}
                  src={currentUrl}
                  alt={instrumentName}
                  className="rounded border border-border transition-transform select-none object-contain"
                  style={{
                    transform: `rotate(${rotation}deg) scale(${zoom})`,
                    maxWidth: '100%',
                    maxHeight: '48vh',
                    objectFit: 'contain'
                  }}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-muted-foreground">
                  <p className="text-base font-semibold mb-1">Image not available</p>
                  <p className="text-xs">Unable to load image from the provided URL</p>
                </div>
              )}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-col items-center gap-2 mt-2 sm:mt-4 flex-shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRotate}
                className="flex items-center gap-1.5 h-8 px-2.5 text-xs"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotate</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="flex items-center gap-1.5 h-8 px-2.5 text-xs"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Zoom In</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="flex items-center gap-1.5 h-8 px-2.5 text-xs"
              >
                <ZoomOut className="w-3.5 h-3.5" />
                <span>Zoom Out</span>
              </Button>
              {fallbackUrls?.original && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInNewTab}
                  className="flex items-center gap-1.5 h-8 px-2.5 text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Original</span>
                </Button>
              )}
            </div>
            {/* Image Counter */}
            {allInstruments.length > 1 && (
              <div className="text-xs text-muted-foreground">
                {currentIndex + 1} / {allInstruments.length}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

