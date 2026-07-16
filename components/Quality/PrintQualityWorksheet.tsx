import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  Printer, FileText, Calendar, Search, ArrowLeft, 
  CheckCircle2, AlertCircle, RefreshCw, ChevronRight,
  ClipboardCheck, Users, ShieldAlert, BadgeInfo
} from 'lucide-react';
import { QualityIndicator, QualityMeasurement, Patient, DailyReportEntry } from '../../types';
import { Button } from '../Button';

interface PrintQualityWorksheetProps {
  indicators: QualityIndicator[];
  measurements: QualityMeasurement[];
  patients: Patient[];
  dailyReports: DailyReportEntry[];
  selectedDate?: string;
  setSelectedDate?: (date: string) => void;
}

export const PrintQualityWorksheet: React.FC<PrintQualityWorksheetProps> = ({
  indicators,
  measurements,
  patients,
  dailyReports,
  selectedDate: propsSelectedDate,
  setSelectedDate: propsSetSelectedDate
}) => {
  const [localSelectedDate, setLocalSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const selectedDate = propsSelectedDate || localSelectedDate;
  const setSelectedDate = propsSetSelectedDate || setLocalSelectedDate;
  const [searchTerm, setSearchTerm] = useState('');

  // Filter measurements for the selected date
  const filteredMeasurements = useMemo(() => {
    return measurements.filter(m => m.date === selectedDate);
  }, [measurements, selectedDate]);

  // Combine indicators with corresponding measurements for this date
  const worksheetEntries = useMemo(() => {
    return indicators.map(ind => {
      const match = filteredMeasurements.find(m => m.indicatorId === ind.id);
      
      let auditRowsArray: any[] = [];
      if (match && match.auditData) {
        if (Array.isArray(match.auditData)) {
          auditRowsArray = match.auditData;
        } else if (typeof match.auditData === 'object') {
          auditRowsArray = Object.entries(match.auditData).map(([patId, auditRec]: [string, any]) => {
            const pat = patients.find(p => p.id === patId);
            const isRecCompliant = !!(
              auditRec &&
              auditRec.anamnesis &&
              auditRec.pemeriksaanFisik &&
              auditRec.diagnosis &&
              auditRec.rencanaTerapi &&
              auditRec.ttdDPJP &&
              auditRec.kurang24h
            );
            
            return {
              patientId: patId,
              patientName: pat ? pat.name : `Pasien (${patId})`,
              noRM: pat ? pat.noRM : '-',
              origin: pat ? pat.asalMasuk : '-',
              dpjp: pat ? (pat.dpjpList || []).join(', ') : '-',
              procedure: `Asesmen: Anamnesis(${auditRec.anamnesis?'✓':'-'}), Fisik(${auditRec.pemeriksaanFisik?'✓':'-'}), Diagnosis(${auditRec.diagnosis?'✓':'-'}), Rencana(${auditRec.rencanaTerapi?'✓':'-'}), TTD DPJP(${auditRec.ttdDPJP?'✓':'-'}), <24j(${auditRec.kurang24h?'✓':'-'})`,
              compliance: isRecCompliant,
              documented: isRecCompliant,
              status: isRecCompliant ? 'PERFORMED' : 'NOT_PERFORMED'
            };
          });
        }
      }

      return {
        indicator: ind,
        measurement: match || null,
        num: match ? match.numeratorValue : 0,
        den: match ? match.denominatorValue : 0,
        result: match && match.denominatorValue > 0 
          ? (match.numeratorValue / match.denominatorValue) * 100 
          : 0,
        audited: !!match,
        recordedBy: match ? match.recordedBy : '-',
        auditRows: auditRowsArray
      };
    }).filter(entry => 
      entry.indicator.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.indicator.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [indicators, filteredMeasurements, searchTerm, patients]);

  // Export all measurements to Excel
  const exportToExcel = () => {
    const tableData = worksheetEntries.map(entry => {
      return {
        'KODE INDIKATOR': entry.indicator.id.toUpperCase(),
        'INDIKATOR MUTU': entry.indicator.title,
        'KATEGORI': entry.indicator.category,
        'NUMERATOR (PEMBILANG)': entry.num,
        'DENOMINATOR (PENYEBUT)': entry.den,
        'PENCAPAIAN (%)': entry.den > 0 ? `${entry.result.toFixed(2)}%` : '0%',
        'TARGET (%)': `${entry.indicator.target}%`,
        'STATUS': entry.den > 0 && entry.result >= entry.indicator.target ? 'TERCAPAI' : 'BELUM TERCAPAI',
        'DIINPUT OLEH': entry.recordedBy,
        'TANGGAL AUDIT': selectedDate
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kertas Kerja Mutu');

    // Add another sheet listing detailed audit logs if available
    const auditDetails: any[] = [];
    worksheetEntries.forEach(entry => {
      if (entry.auditRows && entry.auditRows.length > 0) {
        entry.auditRows.forEach((row: any, idx: number) => {
          if (entry.indicator.id === 'operasi-elektif-1') {
            auditDetails.push({
              'INDIKATOR': entry.indicator.title,
              'DETAIL #': idx + 1,
              'HARI TANGGAL': row.date || selectedDate || '-',
              'NAMA PASIEN': row.patientName || '-',
              'NO RM': row.noRM || '-',
              'ASAL MASUK': row.origin || '-',
              'DPJP': row.dpjp || row.operator || '-',
              'TGL MRS': row.admissionDate || '-',
              'RENCANA OP': row.planDate || '-',
              'TGL OP': row.opDate || '-',
              'DIAGNOSA': row.diagnosis || '-',
              'NAMA TINDAKAN': row.procedure || '-',
              'STATUS OPERASI': row.status === 'PERFORMED' ? 'TERLAKSANA' : row.status === 'DELAYED' ? 'DITUNDA' : row.status === 'CANCELLED' ? 'DIBATALKAN' : 'SCHEDULED',
              'ALASAN PENUNDAAN': row.delayReason || '-'
            });
          } else {
            auditDetails.push({
              'INDIKATOR': entry.indicator.title,
              'DETAIL #': idx + 1,
              'IDENTITAS PASIEN': row.patientName || row.patientId || '-',
              'OPERATOR / DOKTER': row.doctor || row.operator || '-',
              'STATUS / PROSEDUR': row.procedure || row.actionType || row.action || row.status || '-',
              'TERDOKUMENTASI? / PATUH?': (row.status === 'PERFORMED' || row.compliance || row.documented === 'true' || row.compliance === 'true' || row.documented === true || row.compliance === true) ? 'YA' : 'TIDAK'
            });
          }
        });
      }
    });

    if (auditDetails.length > 0) {
      const detailedWorksheet = XLSX.utils.json_to_sheet(auditDetails);
      XLSX.utils.book_append_sheet(workbook, detailedWorksheet, 'Detail Audit Pasien');
    }

    XLSX.writeFile(workbook, `Kertas_Kerja_Mutu_${selectedDate}.xlsx`);
  };

  // Generate a beautiful, formal PDF report using jsPDF
  const exportToPDF = () => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFillColor(20, 66, 114); // Indigo Theme color
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN KERTAS KERJA PENGUKURAN MUTU', 15, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tanggal Pengukuran: ${selectedDate} | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 15, 30);

    // Summary Table
    const tableHeaders = [['Kode', 'Indikator Mutu', 'Kategori', 'Num', 'Den', 'Capaian', 'Target', 'Status']];
    const tableRows = worksheetEntries.map(entry => {
      const status = entry.den === 0 
        ? 'N/A' 
        : (entry.result >= entry.indicator.target ? 'TERCAPAI' : 'BELUM TERCAPAI');
      return [
        entry.indicator.id.toUpperCase(),
        entry.indicator.title,
        entry.indicator.category,
        entry.num.toString(),
        entry.den.toString(),
        entry.den > 0 ? `${entry.result.toFixed(1)}%` : '0%',
        `${entry.indicator.target}%`,
        status
      ];
    });

    doc.autoTable({
      head: tableHeaders,
      body: tableRows,
      startY: 48,
      theme: 'grid',
      headStyles: { fillFill: [20, 66, 114], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      columnStyles: {
        1: { cellWidth: 70 }, // Widen indicator title
      }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 12;

    // Detailed lists for Indicators with audit entries
    worksheetEntries.forEach(entry => {
      if (entry.auditRows.length > 0) {
        // Prevent drawing off the page context
        if (currentY > 240) {
          doc.addPage();
          currentY = 15;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 66, 114);
        doc.text(`Detail Audit: ${entry.indicator.title}`, 15, currentY);
        
        const detailsHeaders = [['Pasien / RM', 'Detail / Petugas atau Dokter', 'Keterangan Audit', 'Status Compliance']];
        const detailsRows = entry.auditRows.map((row: any) => {
          let complianceText = 'TIDAK';
          if (row.documented === true || row.documented === 'YA') {
            complianceText = 'PATUH';
          } else if (row.status === 'PERFORMED') {
            complianceText = 'PATUH';
          } else if (row.compliance) {
            const vals = Object.values(row.compliance);
            const allOk = vals.length > 0 && vals.every(v => v === true || v === 'true' || v === 'yes' || v === 1);
            complianceText = allOk ? 'PATUH (100%)' : 'TIDAK';
          } else if (row.morning || row.afternoon || row.night) {
             complianceText = 'TERISI';
          }

          return [
            row.patientName || '-',
            row.doctor || row.operator || row.prof || '-',
            row.procedure || row.actionType || row.action || 'Di-audit',
            complianceText
          ];
        });

        doc.autoTable({
          head: detailsHeaders,
          body: detailsRows,
          startY: currentY + 4,
          theme: 'striped',
          styles: { fontSize: 8 },
          margin: { left: 15, right: 15 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 12;
      }
    });

    doc.save(`Kertas_Kerja_Mutu_${selectedDate}.pdf`);
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-800 pb-20">
      {/* Immersive Dark Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-[#144272] p-10 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h3 className="text-3xl lg:text-4xl font-black tracking-tight uppercase flex items-center gap-3">
              <Printer size={36} className="text-blue-400" /> Cetak & Ekspor Kertas Kerja Mutu
            </h3>
            <p className="text-slate-300 text-xs lg:text-sm max-w-2xl font-medium">
              Sub-menu khusus untuk mencetak buku harian kertas kerja mutu unit, hasil audit kelayakan klinis, 
              evaluasi operasi elektif, and tingkat ketergantungan pasien.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 flex items-center gap-3 w-full md:w-auto shrink-0">
            <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-400">
              <Calendar size={18} />
            </div>
            <div className="flex-1 md:flex-none">
              <label className="block text-[8px] font-black uppercase text-blue-300 mb-0.5 tracking-wider">Tanggal Laporan</label>
              <input 
                type="date" 
                className="bg-transparent border-none text-md font-black focus:ring-0 outline-none p-0 cursor-pointer text-white"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Buttons and Search Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-6 rounded-[2rem] border shadow-sm">
        <div className="relative w-full lg:max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari indikator mutu..."
            className="w-full pl-12 pr-6 py-3 border rounded-2xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-4 w-full lg:w-auto">
          <Button 
            onClick={exportToExcel}
            className="flex-1 lg:flex-none py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
          >
            <FileText size={16} /> Ekspor Excel ({worksheetEntries.length})
          </Button>
          <Button 
            onClick={exportToPDF}
            className="flex-1 lg:flex-none py-3 px-6 rounded-2xl bg-[#144272] hover:bg-opacity-95 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
          >
            <Printer size={16} /> Cetak PDF (Kertas Kerja)
          </Button>
        </div>
      </div>

      {/* Grid of Indicator Sheets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-50 p-6 rounded-[2rem] border space-y-4">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <BadgeInfo size={16}/> Ringkasan Kepatuhan
            </h4>
            <div className="divide-y divide-slate-100">
              {worksheetEntries.map(entry => {
                const compliant = entry.den > 0 && entry.result >= entry.indicator.target;
                return (
                  <div key={entry.indicator.id} className="py-3 flex justify-between items-center gap-2 text-xs">
                    <span className="font-bold text-slate-600 truncate max-w-[150px]">{entry.indicator.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-slate-800">{entry.den > 0 ? `${entry.result.toFixed(0)}%` : '0%'}</span>
                      {entry.den === 0 ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
                      ) : compliant ? (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      ) : (
                        <AlertCircle size={14} className="text-red-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {worksheetEntries.map(entry => {
            const hasAudit = entry.auditRows.length > 0;
            return (
              <div key={entry.indicator.id} className="bg-white border rounded-[2rem] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
                <div className="p-8 border-b flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="px-3 py-1 bg-slate-100 rounded-full font-black text-[8px] uppercase tracking-wider text-slate-500">
                      {entry.indicator.category}
                    </span>
                    <h5 className="text-lg font-black text-slate-800 tracking-tight leading-normal mt-1">
                      {entry.indicator.title}
                    </h5>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-[#144272] tracking-tighter">
                      {entry.num} / {entry.den}
                    </div>
                    <span className="font-bold text-[9px] text-slate-400 uppercase tracking-widest">
                      Hasil: {entry.den > 0 ? entry.result.toFixed(1) : '0'}% | Target: {entry.indicator.target}%
                    </span>
                  </div>
                </div>

                <div className="p-6 bg-slate-50/50 flex-1">
                  {hasAudit ? (
                    <div className="overflow-x-auto border bg-white rounded-2xl">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-[#144272]/5 text-[#144272] font-black uppercase text-[9px]">
                          <tr>
                            <th className="p-4">Pasien</th>
                            <th className="p-4">Petugas / Operator</th>
                            <th className="p-4">Tindakan / Prosedur</th>
                            <th className="p-4 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {entry.auditRows.map((row: any, idx: number) => {
                            let compliant = false;
                            if (row.documented === true || row.documented === 'YA') {
                              compliant = true;
                            } else if (row.status === 'PERFORMED') {
                              compliant = true;
                            } else if (row.compliance) {
                              compliant = (Object.values(row.compliance).length > 0 && Object.values(row.compliance).every(v => v === true || v === 'true' || v === 'yes' || v === 1));
                            } else if (row.morning || row.afternoon || row.night) {
                              compliant = true;
                            }

                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-4 font-bold text-slate-800">
                                  {row.patientName || row.patientId || '-'} {row.noRM ? `(${row.noRM})` : ''}
                                  {row.origin && <span className="block text-[8px] font-black text-slate-400 mt-0.5 uppercase tracking-wide">Asal: {row.origin}</span>}
                                </td>
                                <td className="p-4 text-indigo-600 font-bold">{row.dpjp || row.doctor || row.operator || row.prof || '-'}</td>
                                <td className="p-4 text-[11px] font-mono">{row.procedure || row.actionType || row.action || 'Audit detail'}</td>
                                <td className="p-4 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                    compliant ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                  }`}>
                                    {compliant ? 'PATUH' : 'TIDAK'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs italic font-semibold">
                      Belum ada data audit tersimpan untuk tanggal ini. Hubungi PIC Mutu untuk mengisi Kertas Kerja.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
