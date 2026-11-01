import React, { useState } from 'react';
import { Check, Code2, Copy, Download, ExternalLink, FileArchive, FileText, Terminal, X } from 'lucide-react';

export const SYNOPSIS_PDF_FILENAME = 'Project_Synopsis_ManishKumarSingh_2300320150035.pdf';
export const CODE_OUTPUT_PDF_FILENAME = 'PortfolioPro_Complete_Code_Output_Manish_Kumar_Singh_2300320150035.pdf';
export const SUBMISSION_PDF_FILENAME = SYNOPSIS_PDF_FILENAME;

async function downloadBinaryBlob(endpoint: string, filename: string, mimeType: string): Promise<boolean> {
  try {
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) return false;
    const blob = await res.blob();
    const typedBlob = new Blob([blob], { type: mimeType });
    const url = URL.createObjectURL(typedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
    return true;
  } catch {
    return false;
  }
}

export async function triggerSynopsisPdfDownload(): Promise<boolean> {
  return downloadBinaryBlob('/api/download/synopsis-pdf', SYNOPSIS_PDF_FILENAME, 'application/pdf');
}

export async function triggerCodeOutputPdfDownload(): Promise<boolean> {
  return downloadBinaryBlob('/api/download/code-output-pdf', CODE_OUTPUT_PDF_FILENAME, 'application/pdf');
}

export async function triggerPdfBlobDownload(): Promise<boolean> {
  return triggerSynopsisPdfDownload();
}

export async function triggerZipBlobDownload(): Promise<boolean> {
  return downloadBinaryBlob('/api/download/project-zip', 'PortfolioPro.zip', 'application/zip');
}

function copyTextFallback(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', 'true');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ProjectDownloadModal: React.FC<Props> = ({ open, onClose }) => {
  const [synopsisBusy, setSynopsisBusy] = useState(false);
  const [synopsisDone, setSynopsisDone] = useState(false);
  const [codePdfBusy, setCodePdfBusy] = useState(false);
  const [codePdfDone, setCodePdfDone] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<'ps1' | 'sh' | null>(null);
  const [previewScript, setPreviewScript] = useState<{ name: string; content: string } | null>(null);
  const [loadingScript, setLoadingScript] = useState<'ps1' | 'sh' | null>(null);

  if (!open) return null;

  const handleSynopsisDownload = async () => {
    setSynopsisBusy(true);
    const ok = await triggerSynopsisPdfDownload();
    setSynopsisBusy(false);
    if (ok) {
      setSynopsisDone(true);
      setTimeout(() => setSynopsisDone(false), 4000);
    }
  };

  const handleCodePdfDownload = async () => {
    setCodePdfBusy(true);
    const ok = await triggerCodeOutputPdfDownload();
    setCodePdfBusy(false);
    if (ok) {
      setCodePdfDone(true);
      setTimeout(() => setCodePdfDone(false), 4000);
    }
  };

  const handleDownloadBothPdfs = async () => {
    await handleSynopsisDownload();
    setTimeout(() => {
      void handleCodePdfDownload();
    }, 350);
  };

  const handleBlobDownload = async () => {
    setDownloading(true);
    const ok = await triggerZipBlobDownload();
    setDownloading(false);
    if (ok) {
      setDownloadDone(true);
      setTimeout(() => setDownloadDone(false), 4000);
    }
  };

  const handleCopyScript = async (kind: 'ps1' | 'sh') => {
    setLoadingScript(kind);
    try {
      const endpoint = kind === 'ps1' ? '/api/download/setup-ps1' : '/api/download/setup-sh';
      const res = await fetch(endpoint, { cache: 'no-store' });
      const text = await res.text();
      let copied = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch {
          copied = copyTextFallback(text);
        }
      } else {
        copied = copyTextFallback(text);
      }
      setPreviewScript({ name: kind === 'ps1' ? 'setup.ps1' : 'setup.sh', content: text });
      if (copied) {
        setCopiedTarget(kind);
        setTimeout(() => setCopiedTarget(null), 4000);
      }
    } finally {
      setLoadingScript(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl divide-y divide-slate-200 dark:divide-slate-800 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="pb-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              HCLTech Career Shaper Submission PDFs &amp; Project Archive
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
              <span>Manish Kumar Singh</span>
              <span aria-hidden="true">·</span>
              <span>Roll 2300320150035</span>
              <span aria-hidden="true">·</span>
              <span>ABES Engineering College</span>
              <span aria-hidden="true">·</span>
              <span>Mentor: Dr. Anamika Goel</span>
              <span aria-hidden="true">·</span>
              <span>01 Nov 2026</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadBothPdfs}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Download Both PDFs
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close download dialog"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Deliverable 1: 7-Page Project Report & Synopsis PDF */}
        <div className="py-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              01. Project Report &amp; Synopsis — {SYNOPSIS_PDF_FILENAME}
            </div>
            <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
              7 Pages · 105 KB
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            HCLTech Career Shaper 7-page format with cover metadata table, 5W1H problem statement, 6 Agile Epics across 20 sprints, system architecture &amp; Level 0/1 DFD diagrams, 24-person team hierarchy, @Version concurrency deep dive, multi-tier Agile metrics, JUnit 5 test suite log, and signed declaration.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            <button
              type="button"
              onClick={handleSynopsisDownload}
              disabled={synopsisBusy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {synopsisDone ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              <span>
                {synopsisBusy
                  ? 'Preparing Synopsis PDF...'
                  : synopsisDone
                  ? 'Synopsis PDF Downloaded'
                  : 'Download 7-Page Synopsis PDF'}
              </span>
            </button>

            <a
              href={`/${SYNOPSIS_PDF_FILENAME}`}
              download={SYNOPSIS_PDF_FILENAME}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Save Synopsis Link As</span>
            </a>
          </div>
        </div>

        {/* Deliverable 2: Complete Source Code & Verified Output Screenshots PDF */}
        <div className="py-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              02. Complete Code &amp; Output Screenshots — {CODE_OUTPUT_PDF_FILENAME}
            </div>
            <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
              3 Pages · 69 KB
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Academic source code &amp; verified output document containing Maven pom.xml, DatabaseStartupInitializer, TradeService, TechnicalIndicatorService, RiskCalculatorService, OrderController, Angular 17 Signals store, terminal Maven/JUnit 5 logs, and live PortfolioPro UI screenshots.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            <button
              type="button"
              onClick={handleCodePdfDownload}
              disabled={codePdfBusy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {codePdfDone ? <Check className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5" />}
              <span>
                {codePdfBusy
                  ? 'Preparing Code & Output PDF...'
                  : codePdfDone
                  ? 'Code & Output PDF Downloaded'
                  : 'Download Code & Output PDF'}
              </span>
            </button>

            <a
              href={`/${CODE_OUTPUT_PDF_FILENAME}`}
              download={CODE_OUTPUT_PDF_FILENAME}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Save Code PDF Link As</span>
            </a>
          </div>
        </div>

        {/* Deliverable 3: Full-Stack Source ZIP & Offline Setup Scripts */}
        <div className="pt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
              <FileArchive className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>03. Full-Stack Source Archive — PortfolioPro.zip (Spring Boot 3.3 + Angular 17 + MySQL 8)</span>
            </div>
            <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
              106 Files · 126 KB
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleBlobDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 text-slate-900 dark:text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {downloadDone ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Download className="w-3.5 h-3.5" />}
              <span>
                {downloading
                  ? 'Preparing PortfolioPro.zip...'
                  : downloadDone
                  ? 'ZIP Download Triggered'
                  : 'Download PortfolioPro.zip'}
              </span>
            </button>

            <a
              href="/PortfolioPro.zip"
              download="PortfolioPro.zip"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Save ZIP Link As</span>
            </a>

            <button
              type="button"
              onClick={() => handleCopyScript('ps1')}
              disabled={loadingScript !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedTarget === 'ps1' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedTarget === 'ps1' ? 'Copied setup.ps1' : 'Copy setup.ps1'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopyScript('sh')}
              disabled={loadingScript !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedTarget === 'sh' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Terminal className="w-3.5 h-3.5" />}
              <span>{copiedTarget === 'sh' ? 'Copied setup.sh' : 'Copy setup.sh'}</span>
            </button>
          </div>

          {previewScript && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                <code>{previewScript.name}</code> — Press <strong>Ctrl+A</strong> then <strong>Ctrl+C</strong> if clipboard access was restricted:
              </div>
              <textarea
                readOnly
                value={previewScript.content}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full h-24 p-2.5 text-[11px] font-mono bg-slate-950 text-emerald-400 rounded-lg border border-slate-800 focus:outline-none"
              />
            </div>
          )}

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            If the embedded preview restricts file downloads, open the app in a full tab via the top-right <strong>Open in new tab</strong> icon and click either PDF download button.
          </p>
        </div>
      </div>
    </div>
  );
};
