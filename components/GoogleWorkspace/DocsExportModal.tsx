import React, { useState } from 'react';
import { createGoogleDoc, GoogleDocResult } from '../../googleWorkspace';
import { 
  FileText, CheckCircle2, ExternalLink, X, Loader2, Sparkles, AlertCircle
} from 'lucide-react';

interface DocsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTitle?: string;
  defaultContent?: string;
  patientName?: string;
  medRecNo?: string;
  notify?: (msg: string, type?: 'success' | 'danger') => void;
}

export const DocsExportModal: React.FC<DocsExportModalProps> = ({
  isOpen,
  onClose,
  defaultTitle = 'Dokumen Medis SiMANTAP',
  defaultContent = '',
  patientName,
  medRecNo,
  notify,
}) => {
  const [docTitle, setDocTitle] = useState(defaultTitle);
  const [docContent, setDocContent] = useState(defaultContent);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GoogleDocResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateDoc = async () => {
    if (!docTitle.trim()) {
      setErrorMsg('Judul dokumen wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Build header for medical record document
      const headerText = `SISTEM SIMANTAP - DOKUMEN LAPORAN MEDIS
======================================================
Tanggal Dibuat : ${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
${patientName ? `Nama Pasien    : ${patientName}` : ''}
${medRecNo ? `No. RM         : ${medRecNo}` : ''}
======================================================

`;

      const fullText = headerText + (docContent || 'Tidak ada catatan tambahan.');

      const createdDoc = await createGoogleDoc({
        title: docTitle,
        content: fullText,
      });

      setResult(createdDoc);
      if (notify) notify(`Google Doc berhasil dibuat: "${createdDoc.title}"`, 'success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat dokumen Google Docs.');
      if (notify) notify(err.message || 'Gagal membuat Google Doc', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <FileText className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-black text-base uppercase tracking-wider">Ekspor ke Google Docs</h3>
              <p className="text-xs text-emerald-100/80">Buat & simpan laporan medis ke akun Google Docs Anda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {result ? (
            /* Success View */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-lg">Dokumen Berhasil Dibuat!</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Dokumen Google Docs <strong>"{result.title}"</strong> siap dibuka dan diedit secara kolaboratif.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={result.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-lg shadow-emerald-600/30 transition-all"
                >
                  <ExternalLink size={15} />
                  <span>Buka di Google Docs</span>
                </a>
                <button
                  onClick={() => setResult(null)}
                  className="w-full sm:w-auto text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-3 rounded-xl transition-colors"
                >
                  Buat Dokumen Lain
                </button>
              </div>
            </div>
          ) : (
            /* Form View */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Judul Dokumen Google Docs
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Contoh: Laporan Asesmen Awal Medis Pasien..."
                  className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Isi / Ringkasan Laporan Medis
                </label>
                <textarea
                  rows={6}
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder="Ketik catatan medis, hasil diagnosa, atau instruksi terapi di sini..."
                  className="w-full text-xs font-mono p-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all custom-scrollbar"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200/70 rounded-xl text-[11px] text-emerald-800 flex items-start gap-2">
                <Sparkles size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Dokumen ini akan langsung disimpan ke akun Google Drive Anda dan dapat dibagikan atau dicetak kapan saja.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="text-xs font-bold text-slate-600 hover:text-slate-800 px-4 py-2.5 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleCreateDoc}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuat Google Doc...</span>
                </>
              ) : (
                <>
                  <FileText size={15} />
                  <span>Buat Dokumen Google Docs</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
