'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { createSystemRequest } from '@/lib/api';

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function FeedbackButton() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Crop overlay state
  const [cropping, setCropping] = useState(false);
  const [fullScreenshot, setFullScreenshot] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  async function handleCapture() {
    setCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const modalEl = document.getElementById('feedback-modal-overlay');
      if (modalEl) modalEl.style.display = 'none';

      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: 0.75,
      });

      if (modalEl) modalEl.style.display = '';

      const dataUrl = canvas.toDataURL('image/png', 0.7);
      setFullScreenshot(dataUrl);
      setCropping(true);
      setCropRect(null);
    } catch (err) {
      console.error('Screenshot capture failed:', err);
      alert('Failed to capture screenshot. You can still submit without one.');
    } finally {
      setCapturing(false);
    }
  }

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    const container = cropContainerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getRelativePos(e);
    setDragStart(pos);
    setCropRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
    setIsDragging(true);
  }, [getRelativePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const pos = getRelativePos(e);
    setCropRect({
      x: Math.min(dragStart.x, pos.x),
      y: Math.min(dragStart.y, pos.y),
      w: Math.abs(pos.x - dragStart.x),
      h: Math.abs(pos.y - dragStart.y),
    });
  }, [isDragging, dragStart, getRelativePos]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Escape key closes crop overlay
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && cropping) {
        setCropping(false);
        setFullScreenshot(null);
        setCropRect(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cropping]);

  function handleCropAndUse() {
    if (!fullScreenshot || !cropRect || cropRect.w < 10 || cropRect.h < 10) return;
    const container = cropContainerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;

    const containerRect = container.getBoundingClientRect();
    const scaleX = img.naturalWidth / containerRect.width;
    const scaleY = img.naturalHeight / containerRect.height;

    const canvas = document.createElement('canvas');
    const sx = cropRect.x * scaleX;
    const sy = cropRect.y * scaleY;
    const sw = cropRect.w * scaleX;
    const sh = cropRect.h * scaleY;
    canvas.width = sw;
    canvas.height = sh;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const croppedUrl = canvas.toDataURL('image/png', 0.7);
    setScreenshot(croppedUrl);
    setCropping(false);
    setFullScreenshot(null);
    setCropRect(null);
  }

  function handleUseFullPage() {
    if (fullScreenshot) {
      setScreenshot(fullScreenshot);
    }
    setCropping(false);
    setFullScreenshot(null);
    setCropRect(null);
  }

  function handleRetake() {
    setCropping(false);
    setFullScreenshot(null);
    setCropRect(null);
    handleCapture();
  }

  async function handleSubmit() {
    if (!token || !description.trim()) return;
    setSubmitting(true);
    try {
      await createSystemRequest(token, {
        description: description.trim(),
        screenshot_data: screenshot,
        page_url: window.location.href,
      });
      setSuccess(true);
      setDescription('');
      setScreenshot(null);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setDescription('');
    setScreenshot(null);
    setCropping(false);
    setFullScreenshot(null);
    setCropRect(null);
    setSuccess(false);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center bg-accent text-accent-on transition-all duration-250 hover:-translate-y-1 hover:shadow-accent-glow active:scale-95"
        title="Submit Feedback"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {/* Crop Overlay */}
      {cropping && fullScreenshot && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/80">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 bg-black/60">
            <p className="text-white text-sm font-semibold">
              Drag to select a region, or use the full page
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRetake}
                className="px-3 py-1.5 text-sm rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Retake
              </button>
              <button
                onClick={handleUseFullPage}
                className="px-3 py-1.5 text-sm rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Use Full Page
              </button>
              <button
                onClick={handleCropAndUse}
                disabled={!cropRect || cropRect.w < 10 || cropRect.h < 10}
                className="px-3 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Crop &amp; Use
              </button>
              <button
                onClick={() => { setCropping(false); setFullScreenshot(null); setCropRect(null); }}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-500/80 text-white hover:bg-red-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Screenshot with crop selection */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            <div
              ref={cropContainerRef}
              className="relative cursor-crosshair select-none max-w-full max-h-full"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={fullScreenshot}
                alt="Full page screenshot"
                className="max-w-full max-h-[calc(100vh-120px)] rounded-lg"
                draggable={false}
              />

              {/* Dim overlay outside selection */}
              {cropRect && cropRect.w > 0 && cropRect.h > 0 && (
                <>
                  {/* Top */}
                  <div className="absolute left-0 top-0 right-0 bg-black/50 pointer-events-none" style={{ height: cropRect.y }} />
                  {/* Bottom */}
                  <div className="absolute left-0 right-0 bottom-0 bg-black/50 pointer-events-none" style={{ top: cropRect.y + cropRect.h }} />
                  {/* Left */}
                  <div className="absolute left-0 bg-black/50 pointer-events-none" style={{ top: cropRect.y, width: cropRect.x, height: cropRect.h }} />
                  {/* Right */}
                  <div className="absolute right-0 bg-black/50 pointer-events-none" style={{ top: cropRect.y, left: cropRect.x + cropRect.w, height: cropRect.h }} />
                  {/* Selection border */}
                  <div
                    className="absolute border-2 border-blue-400 border-dashed pointer-events-none"
                    style={{
                      left: cropRect.x,
                      top: cropRect.y,
                      width: cropRect.w,
                      height: cropRect.h,
                    }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {open && !cropping && (
        <div id="feedback-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 bg-card-surface">
            {success ? (
              <div className="text-center py-8">
                <div className="text-green-500 text-4xl mb-3">&#10003;</div>
                <p className="text-lg font-bold text-theme-primary">Feedback Submitted!</p>
                <p className="text-sm mt-1 text-theme-muted">Thank you for your input.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-theme-primary">Submit Feedback</h3>
                  <button onClick={handleClose} className="text-theme-faint hover:text-theme-primary transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <p className="text-sm mb-4 text-theme-muted">
                  Describe the change you would like to see. Optionally capture a screenshot of the current page.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-theme-secondary">
                      Description *
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="input-field"
                      rows={4}
                      placeholder="Describe what you would like changed..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-theme-secondary">
                      Screenshot (optional)
                    </label>
                    {screenshot ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={screenshot} alt="Captured screenshot"
                          className="rounded-[10px] border-2 border-theme max-h-48 w-full object-contain bg-page"
                        />
                        <button
                          onClick={() => setScreenshot(null)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleCapture}
                        disabled={capturing}
                        className="btn-secondary text-sm w-full"
                      >
                        {capturing ? 'Capturing...' : 'Capture Screenshot of Current Page'}
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={handleClose} className="btn-secondary flex-1">
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !description.trim()}
                      className="btn-accent flex-1"
                    >
                      {submitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
