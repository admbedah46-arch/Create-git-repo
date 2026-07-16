import React, { useState, useEffect, useMemo, Component } from 'react';
import { Patient, MasterData } from '../../types';
import { X, Printer, Save, Check, RefreshCw, FileText } from 'lucide-react';
import { LOMBOK_TIMUR_BASE64, RSUD_SOEDJONO_BASE64 } from './logos_base64';

export interface PatientLetterModalProps {
  patient: Patient;
  onClose: () => void;
  onUpdatePatient: (id: string, updates: Partial<Patient>) => void;
  masterData: MasterData;
  allPatients: Patient[];
}

// Convert a numerical month (1-12) to Roman numerals
const getRomanMonth = (monthStr: string): string => {
  const m = parseInt(monthStr, 10);
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[m - 1] || "VII";
};

// Age calculation helper matching system date
const getAgeFromBirthDate = (birthDateStr: string | undefined): string => {
  if (!birthDateStr) return '-';
  const birthDate = new Date(birthDateStr);
  if (isNaN(birthDate.getTime())) return '-';
  const today = new Date('2026-07-01'); // matching local system date metadata
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return `${age} Tahun`;
};

// Extract existing letter number from patient.suratKeterangan log for active letter type
const getExistingLetterNumber = (suratKeterangan: string | undefined, jenis: 'opname' | 'rujuan' | 'lain'): string | null => {
  if (!suratKeterangan) return null;
  const prefix = jenis === 'opname' ? 'Opname:' : jenis === 'rujuan' ? 'Rujukan:' : 'Lainnya:';
  
  // Split history entries
  const entries = suratKeterangan.split(';');
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (trimmed.startsWith(prefix)) {
      // Entry matches. Format: "Opname: No. 003/R.BDH/RSUD/VII/2026 (1 Juli 2026)"
      const noIndex = trimmed.indexOf('No. ');
      if (noIndex !== -1) {
        const afterNo = trimmed.substring(noIndex + 4);
        const parenIndex = afterNo.indexOf(' (');
        if (parenIndex !== -1) {
          return afterNo.substring(0, parenIndex).trim();
        }
        return afterNo.trim();
      }
    }
  }
  return null;
};

// Format standard date YYYY-MM-DD into Indonesian date string
const formatIndonesianDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

// Format date specifically for photo style (e.g. 01 - 07 - 1971)
const formatPhotoStyleDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '...... - ...... - ............';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day} - ${month} - ${year}`;
};

interface DocumentContentProps {
  jenisSurat: 'opname' | 'rujuan' | 'lain';
  noSurat: string;
  tanggalCetak: string;
  dokterSignee: string;
  nipDokter: string;
  pekerjaan: string;
  rsTujuan: string;
  diagnosisSementara: string;
  alasanMerujuk: string;
  perihal: string;
  isiKeterangan: string;
  patient: Patient;
  logoUrl?: string;
}

const DocumentContent: React.FC<DocumentContentProps> = ({
  jenisSurat,
  noSurat,
  tanggalCetak,
  dokterSignee,
  nipDokter,
  pekerjaan,
  rsTujuan,
  diagnosisSementara,
  alasanMerujuk,
  perihal,
  isiKeterangan,
  patient,
  logoUrl
}) => {
  const [logoSrc, setLogoSrc] = useState(logoUrl || RSUD_SOEDJONO_BASE64);

  useEffect(() => {
    setLogoSrc(logoUrl || RSUD_SOEDJONO_BASE64);
  }, [logoUrl]);

  return (
    <div className="flex-1 flex flex-col w-full text-black">
      {/* Kop Surat Hospital (Precise HTML Table Layout) */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', margin: 0, padding: 0 }}>
        <tbody>
          <tr>
            <td style={{ width: '80px', textAlign: 'left', verticalAlign: 'middle', padding: 0, border: 'none' }}>
              <img src={LOMBOK_TIMUR_BASE64} alt="Logo Lombok Timur" style={{ width: '75px', height: 'auto', display: 'block' }} />
            </td>
            <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0 10px', border: 'none' }}>
              <h2 className="text-[14px] font-bold tracking-wider text-black uppercase leading-tight" style={{ margin: 0, padding: 0, fontFamily: 'Arial, Helvetica, sans-serif' }}>
                PEMERINTAH KABUPATEN LOMBOK TIMUR
              </h2>
              <h1 className="text-[18px] font-black tracking-normal text-black uppercase leading-tight" style={{ margin: '3px 0', padding: 0, fontFamily: 'Arial, Helvetica, sans-serif' }}>
                RSUD Dr. R. SOEDJONO SELONG
              </h1>
              <p className="text-[10px] text-black font-normal leading-normal" style={{ margin: 0, padding: 0, fontFamily: 'Arial, Helvetica, sans-serif' }}>
                Jalan Prof. M. Yamin, SH No. 55 Selong Telp. (0376) 21415 Fax. (0376) 21415
              </p>
              <p className="text-[10px] text-black font-normal mt-0.5" style={{ margin: 0, padding: 0, fontFamily: 'Arial, Helvetica, sans-serif' }}>
                Website : www.rsud.lomboktimurkab.go.id
              </p>
            </td>
            <td style={{ width: '80px', textAlign: 'right', verticalAlign: 'middle', padding: 0, border: 'none' }}>
              <img 
                src={logoSrc} 
                onError={() => setLogoSrc(RSUD_SOEDJONO_BASE64)} 
                alt="Logo RSUD" 
                style={{ width: '72px', height: 'auto', display: 'block', marginLeft: 'auto' }} 
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Double border CSS style separator */}
      <div style={{ borderBottom: '4px double #000000', width: '100%', marginTop: '10px', marginBottom: '20px' }}></div>

      {/* DYNAMIC CONTENT */}
      {jenisSurat === 'opname' && (
        <div className="flex-1 flex flex-col">
          <div className="text-center my-4">
            <h2 className="text-[16px] font-bold tracking-widest uppercase underline text-black" style={{ margin: 0, textDecoration: 'underline' }}>
              SURAT KETERANGAN OPNAME
            </h2>
            <p className="text-[13px] tracking-wider font-mono font-bold mt-1 text-black" style={{ margin: 0 }}>
              No. {noSurat || "......................................................"}
            </p>
          </div>

          <div className="mt-4 space-y-5 text-justify font-serif text-[14px] leading-relaxed text-black">
            <p>Yang bertanda tangan di bawah ini, Direktur Rumah Sakit Umum Dr. R. Soedjono selong dengan ini menerangkan bahwa :</p>
            
            <table className="w-full my-6 border-collapse text-left font-serif" style={{ marginLeft: '0', width: '100%' }}>
              <tbody>
                <tr>
                  <td className="py-2.5 w-[140px] text-black" style={{ border: 'none' }}>Nama</td>
                  <td className="py-2.5 w-6 text-black" style={{ border: 'none' }}>:</td>
                  <td className="py-2.5 font-bold uppercase border-b border-black text-black" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    {patient?.name || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-black" style={{ border: 'none' }}>Tgl. Lahir</td>
                  <td className="py-2.5 text-black" style={{ border: 'none' }}>:</td>
                  <td className="py-2.5 font-bold border-b border-black text-black" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    {formatPhotoStyleDate(patient?.birthDate)} &nbsp;&nbsp;&nbsp;&nbsp; ({getAgeFromBirthDate(patient?.birthDate)})
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-black" style={{ border: 'none' }}>Pekerjaan</td>
                  <td className="py-2.5 text-black" style={{ border: 'none' }}>:</td>
                  <td className="py-2.5 font-semibold border-b border-black text-black" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    {pekerjaan || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-black" style={{ border: 'none' }}>Alamat</td>
                  <td className="py-2.5 text-black" style={{ border: 'none' }}>:</td>
                  <td className="py-2.5 border-b border-black text-black text-[13px]" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    {patient?.address || "-"}
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="leading-loose text-justify">
              Memang benar sedang dirawat / opname di Rumah Sakit Umum Dr. R. Soedjono selong sejak tanggal &nbsp;
              <span className="font-bold underline px-1">{formatPhotoStyleDate(patient?.entryDate)}</span> &nbsp;
              sampai ada ketentuan lebih lanjut.
            </p>
            <p className="leading-loose text-justify">
              Demikian Surat Keterangan ini dibuat, untuk dapat dipergunakan seperlunya.
            </p>
          </div>

          {/* Signee Footer */}
          <div className="mt-8 pt-4 flex justify-end font-sans text-black">
            <div className="text-center w-[320px]">
              <p className="text-[13px]" style={{ margin: 0 }}>
                Selong, &nbsp; <span className="font-bold">{formatPhotoStyleDate(tanggalCetak)}</span>
              </p>
              <p className="text-[13px] mt-1 font-semibold" style={{ margin: '4px 0 0 0' }}>
                a.n. Direktur RSUD Dr. R. Soedjono selong.
              </p>
              <p className="text-[13px] font-bold" style={{ margin: 0 }}>
                Dokter Pemeriksa
              </p>
              <div className="h-16"></div>
              <p className="font-bold underline text-[14px] leading-tight" style={{ margin: 0, textDecoration: 'underline' }}>
                {dokterSignee || "......................................................"}
              </p>
              <p className="text-[11px] font-bold mt-0.5" style={{ margin: '2px 0 0 0' }}>
                NIP. {nipDokter || "......................................................"}
              </p>
            </div>
          </div>
        </div>
      )}

      {jenisSurat === 'rujuan' && (
        <div className="flex-1 flex flex-col">
          <div className="text-center my-4">
            <h2 className="text-[16px] font-bold tracking-widest uppercase underline text-black" style={{ margin: 0, textDecoration: 'underline' }}>
              SURAT RUJUKAN PASIEN
            </h2>
            <p className="text-[13px] tracking-wider font-mono font-bold mt-1 text-black" style={{ margin: 0 }}>
              No. {noSurat || "......................................................"}
            </p>
          </div>

          <div className="mt-4 space-y-4 text-justify font-serif text-[14px] leading-relaxed text-black">
            <p className="font-bold">Kepada Yth. Sejawat Dokter</p>
            <p className="pl-6 font-bold uppercase underline" style={{ textDecoration: 'underline' }}>
              di {rsTujuan || "......................................................"}
            </p>
            <p className="mt-4">Dengan hormat, mohon bantuan penanganan medis dan konsultasi spesialistik lebih lanjut atas pasien tersebut di bawah ini:</p>
            
            <table className="w-full my-4 border-collapse text-left font-serif" style={{ marginLeft: '0', width: '100%' }}>
              <tbody>
                <tr>
                  <td className="py-2 w-[180px] text-black" style={{ border: 'none' }}>Nama Pasien</td>
                  <td className="py-2 w-6 text-black" style={{ border: 'none' }}>:</td>
                  <td className="py-2 font-bold uppercase border-b border-black text-black" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    {patient?.name || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-black" style={{ border: 'none' }}>No. Rekam Medis (RM)</td>
                  <td className="py-2" style={{ border: 'none' }}>:</td>
                  <td className="py-2 font-mono font-bold border-b border-black text-black" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    {patient?.noRM || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-black" style={{ border: 'none' }}>Tanggal Lahir / Umur</td>
                  <td className="py-2" style={{ border: 'none' }}>:</td>
                  <td className="py-2 border-b border-black text-black" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    {formatIndonesianDate(patient?.birthDate)} &nbsp; ({getAgeFromBirthDate(patient?.birthDate)})
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-black" style={{ border: 'none' }}>Alamat</td>
                  <td className="py-2" style={{ border: 'none' }}>:</td>
                  <td className="py-2 border-b border-black text-black text-[13px]" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    {patient?.address || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-black" style={{ border: 'none' }}>Unit Penanggung Jawab</td>
                  <td className="py-2" style={{ border: 'none' }}>:</td>
                  <td className="py-2 font-bold uppercase text-[#144272] border-b border-black" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    RUANG BEDAH (R.BDH)
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3 font-sans text-xs">
              <p style={{ margin: 0 }}>
                <strong>Diagnosis Sementara:</strong> <span className="font-serif text-sm italic">{diagnosisSementara || "-"}</span>
              </p>
              <p style={{ margin: '4px 0 0 0' }}>
                <strong>Alasan Merujuk:</strong> <span className="font-serif text-sm">{alasanMerujuk || "-"}</span>
              </p>
            </div>

            <p className="mt-4">Demikian surat rujukan ini dibuat untuk dapat dipergunakan seperlunya. Atas kerja sama rekan sejawat, kami sampaikan terima kasih banyak.</p>
          </div>

          {/* Signee Footer */}
          <div className="mt-8 pt-4 flex justify-end font-sans text-black">
            <div className="text-center w-[300px]">
              <p className="text-[13px]" style={{ margin: 0 }}>
                Selong, &nbsp; <span className="font-bold">{formatPhotoStyleDate(tanggalCetak)}</span>
              </p>
              <p className="text-[13px] mt-1" style={{ margin: '4px 0 0 0' }}>Hormat Kami,</p>
              <p className="text-[13px] font-bold mt-0.5" style={{ margin: 0 }}>Dokter Pemeriksa / DPJP Utama</p>
              <div className="h-16"></div>
              <p className="font-bold underline text-[14px] leading-tight" style={{ margin: 0, textDecoration: 'underline' }}>
                {dokterSignee || "......................................................"}
              </p>
              <p className="text-[11px] font-bold mt-0.5" style={{ margin: '2px 0 0 0' }}>
                NIP. {nipDokter || "......................................................"}
              </p>
            </div>
          </div>
        </div>
      )}

      {jenisSurat === 'lain' && (
        <div className="flex-1 flex flex-col">
          <div className="text-center my-4">
            <h2 className="text-[16px] font-bold tracking-widest uppercase underline text-black" style={{ margin: 0, textDecoration: 'underline' }}>
              {perihal || "SURAT KETERANGAN MEDIS"}
            </h2>
            <p className="text-[13px] tracking-wider font-mono font-bold mt-1 text-black" style={{ margin: 0 }}>
              No. {noSurat || "......................................................"}
            </p>
          </div>

          <div className="mt-4 space-y-5 text-justify font-serif text-[14px] leading-relaxed text-black">
            <p>Yang bertanda tangan di bawah ini, Dokter Pemeriksa pada RSUD Dr. R. Soedjono Selong menerangkan dengan sebenarnya bahwa:</p>
            
            <table className="w-full my-6 border-collapse text-left font-serif" style={{ marginLeft: '0', width: '100%' }}>
              <tbody>
                <tr>
                  <td className="py-2 w-[160px] text-black" style={{ border: 'none' }}>Nama Pasien</td>
                  <td className="py-2 w-6 text-black" style={{ border: 'none' }}>:</td>
                  <td className="py-2 font-bold uppercase border-b border-black text-black" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    {patient?.name || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-black" style={{ border: 'none' }}>No. Rekam Medis (RM)</td>
                  <td className="py-2" style={{ border: 'none' }}>:</td>
                  <td className="py-2 font-mono font-bold border-b border-black text-black" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    {patient?.noRM || "-"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-black" style={{ border: 'none' }}>Tanggal Lahir / Umur</td>
                  <td className="py-2" style={{ border: 'none' }}>:</td>
                  <td className="py-2 border-b border-black text-black" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    {formatIndonesianDate(patient?.birthDate)} &nbsp; ({getAgeFromBirthDate(patient?.birthDate)})
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-black" style={{ border: 'none' }}>Alamat</td>
                  <td className="py-2" style={{ border: 'none' }}>:</td>
                  <td className="py-2 border-b border-black text-black text-[13px]" style={{ border: 'none', borderBottom: '1px solid #000000' }}>
                    {patient?.address || "-"}
                  </td>
                </tr>
              </tbody>
            </table>

            <p>Menerangkan perihal klinis medis sebagai berikut:</p>
            <p className="bg-slate-50 p-4 border border-slate-200 rounded-xl leading-loose font-serif italic text-black">
              "{isiKeterangan || "-"}"
            </p>
            <p className="mt-4">Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
          </div>

          {/* Signee Footer */}
          <div className="mt-8 pt-4 flex justify-end font-sans text-black">
            <div className="text-center w-[300px]">
              <p className="text-[13px]" style={{ margin: 0 }}>
                Selong, &nbsp; <span className="font-bold">{formatPhotoStyleDate(tanggalCetak)}</span>
              </p>
              <p className="text-[13px] mt-1" style={{ margin: '4px 0 0 0' }}>Dokter Pemeriksa,</p>
              <div className="h-16"></div>
              <p className="font-bold underline text-[14px] leading-tight" style={{ margin: 0, textDecoration: 'underline' }}>
                {dokterSignee || "......................................................"}
              </p>
              <p className="text-[11px] font-bold mt-0.5" style={{ margin: '2px 0 0 0' }}>
                NIP. {nipDokter || "......................................................"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to generate the complete standalone HTML document for printing
const generatePrintHTML = (
  jenisSurat: 'opname' | 'rujuan' | 'lain',
  noSurat: string,
  tanggalCetak: string,
  dokterSignee: string,
  nipDokter: string,
  pekerjaan: string,
  rsTujuan: string,
  diagnosisSementara: string,
  alasanMerujuk: string,
  perihal: string,
  isiKeterangan: string,
  patient: Patient,
  formatPhotoStyleDate: (date: string | undefined) => string,
  formatIndonesianDate: (date: string | undefined) => string,
  getAgeFromBirthDate: (date: string | undefined) => string,
  logoUrl?: string
): string => {
  const patientName = patient?.name || '-';
  const patientBirthDate = patient?.birthDate || '';
  const patientNoRM = patient?.noRM || '-';
  const patientAddress = patient?.address || '-';
  const patientEntryDate = patient?.entryDate || '';
  
  const formattedPhotoDateBirth = formatPhotoStyleDate(patientBirthDate);
  const formattedIndonesianDateBirth = formatIndonesianDate(patientBirthDate);
  const ageStr = getAgeFromBirthDate(patientBirthDate);
  const formattedPhotoDateEntry = formatPhotoStyleDate(patientEntryDate);
  const formattedPhotoDateCetak = formatPhotoStyleDate(tanggalCetak);

  // Determine letter-specific content
  let letterTitle = '';
  let letterContentHTML = '';

  if (jenisSurat === 'opname') {
    letterTitle = 'SURAT KETERANGAN OPNAME';
    letterContentHTML = `
      <div style="text-align: center; margin: 20px 0 30px 0;">
        <h2 style="font-family: 'Times New Roman', Times, serif; font-size: 18px; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">
          SURAT KETERANGAN OPNAME
        </h2>
        <p style="font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: bold; margin: 5px 0 0 0;">
          No. ${noSurat || '......................................................'}
        </p>
      </div>

      <div style="font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.8; text-align: justify;">
        <p style="margin: 0 0 15px 0;">Yang bertanda tangan di bawah ini, Direktur Rumah Sakit Umum Dr. R. Soedjono Selong dengan ini menerangkan bahwa :</p>
        
        <table style="width: 100%; border-collapse: collapse; border: none; margin: 20px 0; margin-left: 0;">
          <tr>
            <td style="width: 180px; padding: 6px 0; border: none; font-weight: normal;">Nama</td>
            <td style="width: 20px; padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000; font-weight: bold; text-transform: uppercase;">${patientName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; border: none; font-weight: normal;">Tgl. Lahir</td>
            <td style="padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000; font-weight: bold;">${formattedPhotoDateBirth} &nbsp;&nbsp;&nbsp;&nbsp; (${ageStr})</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; border: none; font-weight: normal;">Pekerjaan</td>
            <td style="padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000; font-weight: bold;">${pekerjaan || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; border: none; font-weight: normal;">Alamat</td>
            <td style="padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000;">${patientAddress}</td>
          </tr>
        </table>

        <p style="margin: 20px 0; line-height: 1.8;">
          Memang benar sedang dirawat / opname di Rumah Sakit Umum Dr. R. Soedjono Selong sejak tanggal &nbsp;
          <span style="font-weight: bold; text-decoration: underline;">${formattedPhotoDateEntry}</span> &nbsp;
          sampai ada ketentuan lebih lanjut.
        </p>
        <p style="margin: 0;">
          Demikian Surat Keterangan ini dibuat, untuk dapat dipergunakan seperlunya.
        </p>
      </div>
    `;
  } else if (jenisSurat === 'rujuan') {
    letterTitle = 'SURAT RUJUKAN PASIEN';
    letterContentHTML = `
      <div style="text-align: center; margin: 20px 0 30px 0;">
        <h2 style="font-family: 'Times New Roman', Times, serif; font-size: 18px; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">
          SURAT RUJUKAN PASIEN
        </h2>
        <p style="font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: bold; margin: 5px 0 0 0;">
          No. ${noSurat || '......................................................'}
        </p>
      </div>

      <div style="font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.8; text-align: justify;">
        <p style="margin: 0 0 5px 0; font-weight: bold;">Kepada Yth. Sejawat Dokter</p>
        <p style="margin: 0 0 15px 0; font-weight: bold; text-decoration: underline; padding-left: 20px; text-transform: uppercase;">
          di ${rsTujuan || '......................................................'}
        </p>
        
        <p style="margin: 15px 0;">Dengan hormat, mohon bantuan penanganan medis dan konsultasi spesialistik lebih lanjut atas pasien tersebut di bawah ini:</p>
        
        <table style="width: 100%; border-collapse: collapse; border: none; margin: 20px 0; margin-left: 0;">
          <tr>
            <td style="width: 180px; padding: 6px 0; border: none; font-weight: normal;">Nama Pasien</td>
            <td style="width: 20px; padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000; font-weight: bold; text-transform: uppercase;">${patientName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; border: none; font-weight: normal;">No. Rekam Medis (RM)</td>
            <td style="padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000; font-family: monospace; font-weight: bold;">${patientNoRM}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; border: none; font-weight: normal;">Tanggal Lahir / Umur</td>
            <td style="padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000;">${formattedIndonesianDateBirth} &nbsp; (${ageStr})</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; border: none; font-weight: normal;">Alamat</td>
            <td style="padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000;">${patientAddress}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; border: none; font-weight: normal;">Unit Penanggung Jawab</td>
            <td style="padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000; font-weight: bold; text-transform: uppercase; color: #144272;">RUANG BEDAH (R.BDH)</td>
          </tr>
        </table>

        <div style="background-color: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 13px;"><strong>Diagnosis Sementara:</strong> <span style="font-family: 'Times New Roman', Times, serif; font-size: 14px; font-style: italic;">${diagnosisSementara || '-'}</span></p>
          <p style="margin: 0; font-size: 13px;"><strong>Alasan Merujuk:</strong> <span style="font-family: 'Times New Roman', Times, serif; font-size: 14px;">${alasanMerujuk || '-'}</span></p>
        </div>

        <p style="margin: 15px 0 0 0;">
          Demikian surat rujukan ini dibuat untuk dapat dipergunakan seperlunya. Atas kerja sama rekan sejawat, kami sampaikan terima kasih banyak.
        </p>
      </div>
    `;
  } else {
    // 'lain'
    letterTitle = perihal || 'SURAT KETERANGAN MEDIS';
    letterContentHTML = `
      <div style="text-align: center; margin: 20px 0 30px 0;">
        <h2 style="font-family: 'Times New Roman', Times, serif; font-size: 18px; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">
          ${perihal || 'SURAT KETERANGAN MEDIS'}
        </h2>
        <p style="font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: bold; margin: 5px 0 0 0;">
          No. ${noSurat || '......................................................'}
        </p>
      </div>

      <div style="font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.8; text-align: justify;">
        <p style="margin: 0 0 15px 0;">Yang bertanda tangan di bawah ini, Dokter Pemeriksa pada RSUD Dr. R. Soedjono Selong menerangkan dengan sebenarnya bahwa:</p>
        
        <table style="width: 100%; border-collapse: collapse; border: none; margin: 20px 0; margin-left: 0;">
          <tr>
            <td style="width: 180px; padding: 6px 0; border: none; font-weight: normal;">Nama Pasien</td>
            <td style="width: 20px; padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000; font-weight: bold; text-transform: uppercase;">${patientName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; border: none; font-weight: normal;">No. Rekam Medis (RM)</td>
            <td style="padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000; font-family: monospace; font-weight: bold;">${patientNoRM}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; border: none; font-weight: normal;">Tanggal Lahir / Umur</td>
            <td style="padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000;">${formattedIndonesianDateBirth} &nbsp; (${ageStr})</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; border: none; font-weight: normal;">Alamat</td>
            <td style="padding: 6px 0; border: none;">:</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #000000;">${patientAddress}</td>
          </tr>
        </table>

        <p style="margin: 15px 0 10px 0;">Menerangkan perihal klinis medis sebagai berikut:</p>
        <div style="background-color: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; font-style: italic; line-height: 1.8; margin-bottom: 20px;">
          "${isiKeterangan || '-'}"
        </div>
        <p style="margin: 0;">
          Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.
        </p>
      </div>
    `;
  }

  // Determine Signee Titles based on letter type
  let signeeTitle1 = '';
  let signeeTitle2 = '';
  if (jenisSurat === 'opname') {
    signeeTitle1 = 'a.n. Direktur RSUD Dr. R. Soedjono Selong.';
    signeeTitle2 = 'Dokter Pemeriksa';
  } else if (jenisSurat === 'rujuan') {
    signeeTitle1 = 'Hormat Kami,';
    signeeTitle2 = 'Dokter Pemeriksa / DPJP Utama';
  } else {
    signeeTitle1 = 'Dokter Pemeriksa,';
    signeeTitle2 = '';
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${letterTitle}</title>
      <meta charset="utf-8" />
      <style>
        @page {
          size: A4;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          background-color: #ffffff;
          font-family: 'Times New Roman', Times, serif;
          color: #000000;
          -webkit-print-color-adjust: exact;
        }
        #page-container {
          width: 21cm;
          min-height: 29.7cm;
          box-sizing: border-box;
          padding: 2.5cm 2cm 2cm 2.5cm; /* formal margins: left 2.5cm, top 2.5cm, right 2cm, bottom 2cm */
          background-color: #ffffff;
          display: flex;
          flex-direction: column;
        }
        .kop-table {
          width: 100%;
          border-collapse: collapse;
          border: none;
          margin: 0;
          padding: 0;
        }
        .kop-table td {
          border: none;
          padding: 0;
        }
        .kop-divider {
          border-bottom: 4px double #000000;
          width: 100%;
          margin-top: 10px;
          margin-bottom: 25px;
        }
        .signee-container {
          margin-top: 30px;
          padding-top: 15px;
          display: flex;
          justify-content: flex-end;
          font-family: Arial, Helvetica, sans-serif;
        }
        .signee-box {
          text-align: center;
          width: 320px;
          font-size: 13px;
        }
        .signee-name {
          font-weight: bold;
          text-decoration: underline;
          font-size: 14px;
          margin: 0;
        }
        .signee-nip {
          font-size: 11px;
          font-weight: bold;
          margin: 3px 0 0 0;
        }
      </style>
    </head>
    <body>
      <div id="page-container">
        <!-- Kop Surat Hospital (HTML Table Layout) -->
        <table class="kop-table">
          <tr>
            <td style="width: 80px; text-align: left; vertical-align: middle;">
              <img src="${LOMBOK_TIMUR_BASE64}" alt="Logo Lombok Timur" style="width: 75px; height: auto; display: block;" />
            </td>
            <td style="text-align: center; vertical-align: middle; padding: 0 10px;">
              <h2 style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; margin: 0; padding: 0; text-transform: uppercase; line-height: 1.2; color: #000000; letter-spacing: 0.5px;">
                PEMERINTAH KABUPATEN LOMBOK TIMUR
              </h2>
              <h1 style="font-family: Arial, Helvetica, sans-serif; font-size: 19px; font-weight: 900; margin: 4px 0; padding: 0; text-transform: uppercase; line-height: 1.2; color: #000000; letter-spacing: 0.5px;">
                RSUD Dr. R. SOEDJONO SELONG
              </h1>
              <p style="font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: normal; margin: 0; padding: 0; line-height: 1.3; color: #000000;">
                Jalan Prof. M. Yamin, SH No. 55 Selong Telp. (0376) 21415 Fax. (0376) 21415
              </p>
              <p style="font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: normal; margin: 2px 0 0 0; padding: 0; line-height: 1.3; color: #000000;">
                Website: www.rsud.lomboktimurkab.go.id
              </p>
            </td>
            <td style="width: 80px; text-align: right; vertical-align: middle;">
              <img src="${logoUrl || RSUD_SOEDJONO_BASE64}" onerror="this.onerror=null; this.src='${RSUD_SOEDJONO_BASE64}';" alt="Logo RSUD" style="width: 72px; height: auto; display: block; margin-left: auto;" />
            </td>
          </tr>
        </table>

        <!-- Line Separator -->
        <div class="kop-divider"></div>

        <!-- Dynamic Content -->
        ${letterContentHTML}

        <!-- Signee Footer Area -->
        <div class="signee-container">
          <div class="signee-box">
            <p style="margin: 0; font-family: Arial, Helvetica, sans-serif;">
              Selong, &nbsp; <span style="font-weight: bold;">${formattedPhotoDateCetak}</span>
            </p>
            ${signeeTitle1 ? `<p style="margin: 4px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-weight: normal;">${signeeTitle1}</p>` : ''}
            ${signeeTitle2 ? `<p style="margin: 2px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-weight: bold;">${signeeTitle2}</p>` : ''}
            
            <div style="height: 60px;"></div> <!-- Clear signature spacer with absolutely no helper text like (Tanda Tangan) -->
            
            <p class="signee-name">${dokterSignee || '......................................................'}</p>
            <p class="signee-nip">NIP. ${nipDokter || '......................................................'}</p>
          </div>
        </div>
      </div>

      <script>
        // Ensure everything is fully loaded before launching print dialog
        window.addEventListener('DOMContentLoaded', () => {
          const imgs = Array.from(document.querySelectorAll('img'));
          const promises = imgs.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
          });
          Promise.all(promises).then(() => {
            setTimeout(() => {
              window.print();
            }, 500);
          });
        });
      </script>
    </body>
    </html>
  `;
};

export const PatientLetterModalInner: React.FC<PatientLetterModalProps> = ({
  patient,
  onClose,
  onUpdatePatient,
  masterData,
  allPatients
}) => {
  // Letter type: 'opname' | 'rujuan' | 'lain'
  const [jenisSurat, setJenisSurat] = useState<'opname' | 'rujuan' | 'lain'>('opname');
  
  // Doctor and NIP Signee
  const [dokterSignee, setDokterSignee] = useState(patient?.dpjp || patient?.dpjpList?.[0] || '');
  const [nipDokter, setNipDokter] = useState('19821104 201101 1 003'); // Realistic editable NIP placeholder
  
  // Logo error state fallback
  const [leftLogoError, setLeftLogoError] = useState(false);

  // Standard letter parameters
  const [noSurat, setNoSurat] = useState('');
  const [tanggalCetak, setTanggalCetak] = useState('2026-07-01'); // Matches system date
  const [isLocked, setIsLocked] = useState(false);

  // Specific form states
  const [pekerjaan, setPekerjaan] = useState('Pegawai Swasta');
  
  // Referral specific form states
  const [rsTujuan, setRsTujuan] = useState('RSUP Provinsi NTB');
  const [diagnosisSementara, setDiagnosisSementara] = useState(patient?.diagnosaUtama || '');
  const [alasanMerujuk, setAlasanMerujuk] = useState('Memerlukan fasilitas NICU dan bedah sub-spesialis pediatrik lebih lanjut.');

  // Custom/Other letter specific form states
  const [perihal, setPerihal] = useState('SURAT KETERANGAN MEDIS');
  const [isiKeterangan, setIsKeterangan] = useState('Menyatakan bahwa pasien tersebut di atas telah menjalani observasi klinis pasca-tindakan bedah dan saat ini dalam kondisi stabil serta diperkenankan beristirahat di rumah selama 3 (tiga) hari kerja.');

  const [isSaved, setIsSaved] = useState(false);

  // Auto-generate suggested patient letter number based on Bed / Surgery Room sequence (R.BDH)
  // Format: [No Urut otomatis 3 digit]/R.BDH/RSUD/[Bulan dalam Romawi]/[Tahun Berjalan]
  const suggestedNumber = useMemo(() => {
    if (!allPatients || !Array.isArray(allPatients)) return "";
    // Check existing suratKeterangan in database to determine incremental number
    let maxSeq = 0;
    const regex = /(\d{3})\/R\.BDH\/RSUD\//;
    allPatients.forEach(p => {
      if (p && p.suratKeterangan) {
        const match = p.suratKeterangan.match(regex);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    });

    const nextSeq = maxSeq + 1;
    const seqStr = String(nextSeq).padStart(3, '0');

    // Real-time date
    const printDate = new Date(tanggalCetak || '2026-07-01');
    const year = isNaN(printDate.getTime()) ? 2026 : printDate.getFullYear();
    const month = String(isNaN(printDate.getTime()) ? 7 : printDate.getMonth() + 1);
    const roman = getRomanMonth(month);

    return `${seqStr}/R.BDH/RSUD/${roman}/${year}`;
  }, [allPatients, tanggalCetak]);

  // Set default suggested number or load locked existing number from database
  useEffect(() => {
    const existing = getExistingLetterNumber(patient?.suratKeterangan, jenisSurat);
    if (existing) {
      setNoSurat(existing);
      setIsLocked(true);
    } else {
      setNoSurat(suggestedNumber);
      setIsLocked(false);
    }
  }, [patient?.suratKeterangan, jenisSurat, suggestedNumber]);

  const handleGenerateAuto = () => {
    setNoSurat(suggestedNumber);
    setIsLocked(false);
  };

  const getLetterTitleText = () => {
    if (jenisSurat === 'opname') return 'Surat Keterangan Opname';
    if (jenisSurat === 'rujuan') return 'Surat Rujukan Pasien';
    return perihal || 'Surat Keterangan Medis';
  };

  const handleSave = () => {
    if (!patient?.id) return;
    const trimmedNoSurat = (noSurat || "").trim();
    // Generate beautiful metadata string to store in single 'suratKeterangan' field
    const prefix = jenisSurat === 'opname' ? 'Opname' : jenisSurat === 'rujuan' ? 'Rujukan' : 'Lainnya';
    const newEntry = `${prefix}: No. ${trimmedNoSurat} (${formatIndonesianDate(tanggalCetak)})`;
    
    // We can either append to existing history or overwrite. Appending makes it a true history log!
    let updatedHistory = newEntry;
    if (patient?.suratKeterangan && patient.suratKeterangan.trim().length > 0) {
      // Check if this letter is already in history to avoid redundant append
      if (!patient.suratKeterangan.includes(trimmedNoSurat)) {
        updatedHistory = `${patient.suratKeterangan}; ${newEntry}`;
      } else {
        updatedHistory = patient.suratKeterangan;
      }
    }

    onUpdatePatient(patient.id, {
      suratKeterangan: updatedHistory,
      dpjp: dokterSignee // Update DPJP if updated here
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!patient?.id) return;
    const trimmedNoSurat = (noSurat || "").trim();
    // Auto-save history values to database first
    const prefix = jenisSurat === 'opname' ? 'Opname' : jenisSurat === 'rujuan' ? 'Rujukan' : 'Lainnya';
    const newEntry = `${prefix}: No. ${trimmedNoSurat} (${formatIndonesianDate(tanggalCetak)})`;
    
    let updatedHistory = newEntry;
    if (patient?.suratKeterangan && patient.suratKeterangan.trim().length > 0) {
      if (!patient.suratKeterangan.includes(trimmedNoSurat)) {
        updatedHistory = `${patient.suratKeterangan}; ${newEntry}`;
      } else {
        updatedHistory = patient.suratKeterangan;
      }
    }

    onUpdatePatient(patient.id, {
      suratKeterangan: updatedHistory,
      dpjp: dokterSignee
    });

    try {
      const printHTML = generatePrintHTML(
        jenisSurat,
        trimmedNoSurat,
        tanggalCetak,
        dokterSignee,
        nipDokter,
        pekerjaan,
        rsTujuan,
        diagnosisSementara,
        alasanMerujuk,
        perihal,
        isiKeterangan,
        patient,
        formatPhotoStyleDate,
        formatIndonesianDate,
        getAgeFromBirthDate,
        masterData?.settings?.logoUrl
      );

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printHTML);
        printWindow.document.close();
      } else {
        // Fallback if popup blocker is active
        window.focus();
        setTimeout(() => {
          window.print();
        }, 300);
      }
    } catch (err) {
      console.error("Print statement letter error:", err);
      alert("Gagal melakukan print. Silakan buka aplikasi di Tab Baru atau nonaktifkan popup blocker terlebih dahulu.");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-fade-in print-overlay font-sans">
      {/* Scoped CSS styling block for official A4 statement letter formatting */}
      <style>{`
        @media print {
          /* Hide all page content by default */
          body > #root > *,
          body > div:not(.print-overlay) {
            display: none !important;
          }
          /* Ensure our print-overlay itself is displayed */
          .print-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }
          /* Hide everything except the print area */
          .print-overlay > .no-print {
            display: none !important;
          }
          .print-overlay > #print-letter-area {
            display: block !important;
            visibility: visible !important;
          }
          #print-letter-area, #print-letter-area * {
            visibility: visible !important;
          }
          #print-letter-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 21cm !important;
            min-height: 29.7cm !important;
            margin: 0 !important;
            padding: 2.5cm 2cm 2cm 2.5cm !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            font-size: 14px !important;
            line-height: 1.6 !important;
            font-family: 'Times New Roman', Times, serif !important;
          }
          /* Print optimization resets */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Screen Modal View Container (Hidden when printing via .no-print) */}
      <div className="bg-slate-50 rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden no-print">
        {/* MODAL HEADER */}
        <div className="bg-white px-8 py-5 border-b border-slate-150 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#144272]/10 flex items-center justify-center text-[#144272]">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">MODUL ADM. CETAK SURAT KETERANGAN</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                Pasien: {patient?.name || "-"} | RM: {patient?.noRM || "-"} | Register: {patient?.noRegister || "-"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all outline-none border border-transparent cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6">
          
          {/* LEFT PANEL: Controls & Form Inputs */}
          <div className="w-full lg:w-[450px] bg-white rounded-3xl border border-slate-200/80 p-6 flex flex-col gap-5 shrink-0 shadow-sm overflow-y-auto max-h-full">
            
            {/* Dynamic Selector for Letter Type */}
            <div className="bg-slate-50 p-2 rounded-2xl border border-slate-200 flex gap-1">
              <button
                type="button"
                onClick={() => setJenisSurat('opname')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer border-none ${
                  jenisSurat === 'opname'
                    ? 'bg-[#144272] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 bg-transparent'
                }`}
              >
                Ket. Opname
              </button>
              <button
                type="button"
                onClick={() => setJenisSurat('rujuan')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer border-none ${
                  jenisSurat === 'rujuan'
                    ? 'bg-[#144272] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 bg-transparent'
                }`}
              >
                Rujukan
              </button>
              <button
                type="button"
                onClick={() => setJenisSurat('lain')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer border-none ${
                  jenisSurat === 'lain'
                    ? 'bg-[#144272] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 bg-transparent'
                }`}
              >
                Lain-Lain
              </button>
            </div>

            <div className="border-b border-slate-100 pb-2">
              <h4 className="text-[10px] font-black text-[#144272] uppercase tracking-widest">Parameter {getLetterTitleText()}</h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Gunakan form di bawah untuk mengubah detail draf cetak.</p>
            </div>

            <div className="space-y-4">
              {/* No. Surat (Auto generated & editable) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[9px] font-extrabold text-[#144272] uppercase tracking-wider">
                    Nomor Surat Resmi <span className="text-red-500 font-black">*</span>
                  </label>
                  {isLocked && (
                    <span className="bg-emerald-600 text-white font-black text-[7px] uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Check size={8} className="stroke-[4px]" /> Terkunci dari Database
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      className={`w-full text-[11px] font-bold text-slate-800 rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 transition-all font-mono ${
                        isLocked 
                          ? 'bg-emerald-50/20 border border-emerald-300 pr-8' 
                          : 'bg-slate-50 border border-slate-200'
                      }`}
                      value={noSurat}
                      placeholder="Contoh: 001/R.BDH/RSUD/VII/2026"
                      onChange={e => {
                        setNoSurat(e.target.value);
                        setIsLocked(false);
                      }}
                    />
                    {isLocked && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                        <Check size={12} className="stroke-[3px]" />
                      </div>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={handleGenerateAuto}
                    className={`p-2.5 rounded-xl transition-all cursor-pointer border flex items-center justify-center gap-1 ${
                      isLocked 
                        ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                        : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                    }`}
                    title={isLocked ? "Buka kunci & generate baru" : "Generate format otomatis (R.BDH/RSUD)"}
                  >
                    <RefreshCw size={14} className={isLocked ? "animate-spin-once" : ""} />
                  </button>
                </div>
              </div>

              {/* Tanggal Cetak Surat */}
              <div>
                <label className="text-[9px] font-extrabold text-[#144272] uppercase tracking-wider block mb-1">
                  Tanggal Cetak Surat
                </label>
                <input 
                  type="date" 
                  className="w-full text-[11px] font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 transition-all font-mono"
                  value={tanggalCetak}
                  onChange={e => setTanggalCetak(e.target.value)}
                />
              </div>

              {/* Dokter Signee / Pemeriksa */}
              <div>
                <label className="text-[9px] font-extrabold text-[#144272] uppercase tracking-wider block mb-1">
                  Dokter Penanggung Jawab / Pemeriksa <span className="text-red-500 font-black">*</span>
                </label>
                <select
                  className="w-full text-[11px] font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 transition-all"
                  value={dokterSignee}
                  onChange={e => setDokterSignee(e.target.value)}
                >
                  <option value="">-- Pilih Dokter DPJP --</option>
                  {(masterData.doctors || []).map(doc => (
                    <option key={doc} value={doc}>{doc}</option>
                  ))}
                  {patient?.dpjpList && patient.dpjpList.map(doc => (
                    <option key={doc} value={doc}>{doc}</option>
                  ))}
                </select>
              </div>

              {/* NIP Dokter */}
              <div>
                <label className="text-[9px] font-extrabold text-[#144272] uppercase tracking-wider block mb-1">
                  Nomor Induk Pegawai (NIP) Dokter
                </label>
                <input 
                  type="text" 
                  className="w-full text-[11px] font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 transition-all"
                  value={nipDokter}
                  placeholder="Isi NIP dokter pemeriksa..."
                  onChange={e => setNipDokter(e.target.value)}
                />
              </div>

              {/* CONDITIONAL FORM FOR OPNAME (Opsi 1) */}
              {jenisSurat === 'opname' && (
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-150 space-y-3 animate-fade-in">
                  <span className="text-[8px] font-black uppercase text-amber-600 tracking-wider">Khusus Format Opname</span>
                  <div>
                    <label className="text-[9px] font-extrabold text-[#144272] uppercase tracking-wider block mb-1">
                      Pekerjaan Pasien
                    </label>
                    <input 
                      type="text" 
                      className="w-full text-[11px] font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-300 transition-all"
                      value={pekerjaan}
                      onChange={e => setPekerjaan(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* CONDITIONAL FORM FOR RUJUKAN (Opsi 2) */}
              {jenisSurat === 'rujuan' && (
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-150 space-y-3 animate-fade-in">
                  <span className="text-[8px] font-black uppercase text-[#144272] tracking-wider">Khusus Format Rujukan</span>
                  <div>
                    <label className="text-[9px] font-extrabold text-[#144272] uppercase tracking-wider block mb-1">
                      Rumah Sakit Tujuan Rujukan <span className="text-red-500 font-black">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="w-full text-[11px] font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-300 transition-all"
                      value={rsTujuan}
                      placeholder="Contoh: RSUP Dr. Sardjito"
                      onChange={e => setRsTujuan(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-extrabold text-[#144272] uppercase tracking-wider block mb-1">
                      Diagnosis Sementara <span className="text-red-500 font-black">*</span>
                    </label>
                    <textarea 
                      className="w-full h-16 text-[11px] font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-300 transition-all resize-none"
                      value={diagnosisSementara}
                      placeholder="Isi diagnosis sementara..."
                      onChange={e => setDiagnosisSementara(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-extrabold text-[#144272] uppercase tracking-wider block mb-1">
                      Alasan Merujuk <span className="text-red-500 font-black">*</span>
                    </label>
                    <textarea 
                      className="w-full h-16 text-[11px] font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-300 transition-all resize-none"
                      value={alasanMerujuk}
                      placeholder="Isi alasan klinis merujuk..."
                      onChange={e => setAlasanMerujuk(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* CONDITIONAL FORM FOR OTHER LETTERS (Opsi 3) */}
              {jenisSurat === 'lain' && (
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-150 space-y-3 animate-fade-in">
                  <span className="text-[8px] font-black uppercase text-purple-600 tracking-wider">Khusus Format Keterangan Lain</span>
                  <div>
                    <label className="text-[9px] font-extrabold text-[#144272] uppercase tracking-wider block mb-1">
                      Perihal / Judul Surat <span className="text-red-500 font-black">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="w-full text-[11px] font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-300 transition-all"
                      value={perihal}
                      placeholder="Contoh: SURAT KETERANGAN BEBAS NARKOBA"
                      onChange={e => setPerihal(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-extrabold text-[#144272] uppercase tracking-wider block mb-1">
                      Isi Keterangan Medis Tambahan <span className="text-red-500 font-black">*</span>
                    </label>
                    <textarea 
                      className="w-full h-24 text-[11px] font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-300 transition-all resize-none"
                      value={isiKeterangan}
                      placeholder="Tuliskan keterangan klinis spesifik..."
                      onChange={e => setIsKeterangan(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Display history list from patient record */}
              {patient?.suratKeterangan && (
                <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                  <span className="text-[8px] font-black uppercase text-indigo-700 tracking-widest block mb-1">Histori Surat Terkait Pasien</span>
                  <p className="text-[9px] text-slate-600 font-bold leading-normal font-mono">
                    {patient.suratKeterangan}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
              <button 
                type="button"
                onClick={handleSave}
                className="w-full py-3 px-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-all font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border-none"
              >
                {isSaved ? (
                  <>
                    <Check size={14} className="text-emerald-600 stroke-[3px]" />
                    Simpan Histori Database Sukses!
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Kunci & Simpan Database
                  </>
                )}
              </button>
              
              <button 
                type="button"
                onClick={handlePrint}
                className="w-full py-3 px-4 rounded-2xl bg-[#144272] text-white hover:bg-[#0f345c] transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-100 border-none"
              >
                <Printer size={14} />
                Cetak Surat PDF (A4)
              </button>
            </div>
          </div>

          {/* RIGHT PANEL: Live A4 Layout Preview (Screen display ONLY) */}
          <div className="flex-1 bg-slate-200/55 rounded-[2.5rem] border border-slate-250 p-6 flex flex-col items-center justify-start overflow-y-auto">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-4">💡 Pratinjau Kertas Kerja Cetak (A4 Standard)</span>
            
            {/* Paper Container for Screen Preview */}
            <div 
              className="bg-white w-full max-w-[21cm] min-h-[29.7cm] shadow-xl border border-slate-300 p-[2.5cm] flex flex-col text-black font-serif text-[14px] leading-relaxed relative animate-fade-in"
            >
              <DocumentContent 
                jenisSurat={jenisSurat}
                noSurat={noSurat}
                tanggalCetak={tanggalCetak}
                dokterSignee={dokterSignee}
                nipDokter={nipDokter}
                pekerjaan={pekerjaan}
                rsTujuan={rsTujuan}
                diagnosisSementara={diagnosisSementara}
                alasanMerujuk={alasanMerujuk}
                perihal={perihal}
                isiKeterangan={isiKeterangan}
                patient={patient}
                logoUrl={masterData?.settings?.logoUrl}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Real Print Container (Invisible on Screen, Shown ONLY when printing) */}
      <div 
        id="print-letter-area" 
        className="hidden print:flex flex-col bg-white text-black font-serif text-[14px] leading-relaxed relative"
        style={{
          width: '21cm',
          minHeight: '29.7cm',
          boxSizing: 'border-box',
          padding: '2.5cm 2cm 2cm 2.5cm',
          backgroundColor: '#ffffff',
          color: '#000000'
        }}
      >
        <DocumentContent 
          jenisSurat={jenisSurat}
          noSurat={noSurat}
          tanggalCetak={tanggalCetak}
          dokterSignee={dokterSignee}
          nipDokter={nipDokter}
          pekerjaan={pekerjaan}
          rsTujuan={rsTujuan}
          diagnosisSementara={diagnosisSementara}
          alasanMerujuk={alasanMerujuk}
          perihal={perihal}
          isiKeterangan={isiKeterangan}
          patient={patient}
          logoUrl={masterData?.settings?.logoUrl}
        />
      </div>
    </div>
  );
};

export class SafeErrorBoundary extends Component<any, any> {
  state: any;
  props: any;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("SafeErrorBoundary caught an error in PatientLetterModal:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-red-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4 animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2">Terjadi Kesalahan Teknis</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Sistem gagal memuat modul surat keterangan pasien ini. Jangan khawatir, sisa aplikasi tetap berjalan aman!
            </p>
            <button
              onClick={() => window.location.reload()}
              className="py-2.5 px-6 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all uppercase tracking-wider active:scale-95"
            >
              Segarkan Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const PatientLetterModal: React.FC<PatientLetterModalProps> = (props) => {
  return (
    <SafeErrorBoundary>
      <PatientLetterModalInner {...props} />
    </SafeErrorBoundary>
  );
};
