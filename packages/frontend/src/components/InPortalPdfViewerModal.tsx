import React, { useEffect, useState } from 'react';
import { X, Download, Printer, Loader2, FileText } from 'lucide-react';
import { useMobileOverlay } from '../lib/mobileOverlay';

interface InPortalPdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array | null;
  title: string;
  filename?: string;
}

export const InPortalPdfViewerModal: React.FC<InPortalPdfViewerModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  title,
  filename = 'document.pdf',
}) => {
  useMobileOverlay('sheet', isOpen, onClose);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !pdfBytes) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Create a Blob from the PDF Uint8Array
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (err) {
      console.error('Failed to create PDF blob URL:', err);
    } finally {
      setLoading(false);
    }

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, pdfBytes]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    if (!blobUrl) return;
    // Create hidden iframe to trigger print dialog directly
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Direct print failed, opening in window:', err);
        window.open(blobUrl, '_blank');
      }
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150 no-sheet-overlay">
      <div className="relative w-full max-w-5xl h-[100dvh] sm:h-[92vh] flex flex-col bg-white sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Top Header & Action Toolbar */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">{title}</h2>
              <p className="text-[11px] font-mono text-slate-500 truncate">{filename}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !blobUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              title="Print document"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || !blobUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Close viewer (Esc)"
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              <span className="text-xs font-medium">Rendering vector document...</span>
            </div>
          ) : blobUrl ? (
            <iframe
              src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              title={title}
              className="w-full h-full border-none bg-slate-200"
            />
          ) : (
            <div className="text-center p-6 text-slate-500 text-xs">
              Unable to preview PDF document.
            </div>
          )}
        </div>

        {/* Status Strip Footer */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span>Standard A4 Document Preview</span>
          <span>Click Print or Download PDF to save</span>
        </div>
      </div>
    </div>
  );
};
