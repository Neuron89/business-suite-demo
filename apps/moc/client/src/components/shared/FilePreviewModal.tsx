'use client';

import { useEffect, useCallback } from 'react';
import { getDownloadUrl, getPreviewUrl } from '@/lib/api';

interface Attachment {
  id: number;
  original_name: string;
  mime_type: string;
  size: number;
  uploader_name?: string;
  created_at?: string;
}

interface Props {
  attachment: Attachment;
  token: string;
  onClose: () => void;
  /** Navigate to the previous/next attachment, or undefined to hide arrows */
  onPrev?: () => void;
  onNext?: () => void;
}

const PREVIEWABLE_IMAGES = ['image/jpeg', 'image/png'];
const PREVIEWABLE_PDF = ['application/pdf'];
const PREVIEWABLE_TEXT = ['text/plain', 'text/csv'];

function fileExt(name: string): string {
  return (name.split('.').pop() || '').toUpperCase();
}

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function FilePreviewModal({ attachment, token, onClose, onPrev, onNext }: Props) {
  const previewUrl = getPreviewUrl(attachment.id, token);
  const downloadUrl = getDownloadUrl(attachment.id);
  const mime = attachment.mime_type;
  const isImage = PREVIEWABLE_IMAGES.includes(mime);
  const isPdf = PREVIEWABLE_PDF.includes(mime);
  const isText = PREVIEWABLE_TEXT.includes(mime);
  const canPreview = isImage || isPdf || isText;

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && onPrev) onPrev();
    if (e.key === 'ArrowRight' && onNext) onNext();
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col"
           style={{ width: '90vw', maxWidth: '1100px', height: '85vh', maxHeight: '900px' }}>

        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* File type badge */}
            <span className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg text-xs font-bold text-white ${
              isImage ? 'bg-green-500' : isPdf ? 'bg-red-500' : 'bg-blue-500'
            }`}>
              {fileExt(attachment.original_name)}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">{attachment.original_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatSize(attachment.size)}
                {attachment.uploader_name && ` — ${attachment.uploader_name}`}
                {attachment.created_at && ` — ${new Date(attachment.created_at).toLocaleDateString()}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Download button */}
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download
            </a>
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Preview body */}
        <div className="flex-1 overflow-hidden relative bg-gray-50 dark:bg-gray-950">
          {isImage && (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={attachment.original_name}
                className="max-w-full max-h-full object-contain rounded shadow-lg"
              />
            </div>
          )}

          {isPdf && (
            <iframe
              src={previewUrl}
              title={attachment.original_name}
              className="w-full h-full border-0"
            />
          )}

          {isText && (
            <iframe
              src={previewUrl}
              title={attachment.original_name}
              className="w-full h-full border-0 bg-white"
              style={{ fontFamily: 'monospace' }}
            />
          )}

          {!canPreview && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">Preview not available</p>
              <p className="text-sm">{fileExt(attachment.original_name)} files cannot be previewed in the browser.</p>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-2"
              >
                Download File
              </a>
            </div>
          )}

          {/* Prev/Next arrows */}
          {onPrev && (
            <button
              onClick={onPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 rounded-full shadow-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 rounded-full shadow-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
