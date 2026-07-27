import React, { useState } from 'react';
import { openGooglePicker, PickedFile, signInWithGoogleWorkspace, getWorkspaceAccessToken } from '../../googleWorkspace';
import { HardDrive, Loader2, Paperclip, ExternalLink } from 'lucide-react';

interface PickerAttachButtonProps {
  onFilePicked: (file: PickedFile) => void;
  buttonText?: string;
  className?: string;
  notify?: (msg: string, type?: 'success' | 'danger') => void;
}

export const PickerAttachButton: React.FC<PickerAttachButtonProps> = ({
  onFilePicked,
  buttonText = 'Pilih Berkas dari Google Drive',
  className = '',
  notify,
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      let token = getWorkspaceAccessToken();
      if (!token) {
        const res = await signInWithGoogleWorkspace();
        token = res.accessToken;
      }

      await openGooglePicker({
        title: 'Pilih Dokumen / Lampiran Medis dari Google Drive',
        onPicked: (file) => {
          onFilePicked(file);
          if (notify) notify(`Lampiran ditambahkan: ${file.name}`, 'success');
        },
        onCancel: () => {},
      });
    } catch (err: any) {
      console.error(err);
      if (notify) notify(err.message || 'Gagal membuka Google Picker', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={
        className ||
        'inline-flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs px-3.5 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-50'
      }
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin text-blue-600" />
      ) : (
        <HardDrive size={15} className="text-blue-600 shrink-0" />
      )}
      <span>{buttonText}</span>
    </button>
  );
};
