import React, { useState, useEffect } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { db } from '../firebase';
import { Calendar, Trash2, Download, Clock, Printer, FileText, Table } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const SLOT_LABELS = {
  1: '9:00 – 10:00',
  2: '10:00 – 11:00',
  3: '11:00 – 12:00',
  4: '12:00 – 1:00 (Lunch) 🍽️',
  5: '1:00 – 2:00',
  6: '2:00 – 3:00',
  7: '3:00 – 4:00',
  8: '4:00 – 5:00',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const ALL_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];
const GAP_SLOTS = [4];

const CATEGORY_COLORS = {
  CORE: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  LANGUAGE: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  ELECTIVE: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  LAB: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  PROJECT: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
};

const SavedTimetables = () => {
  const [timetables, setTimetables] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const ttRef = ref(db, 'generated_timetables');
    onValue(ttRef, (snapshot) => {
      if (snapshot.exists()) {
        setTimetables(snapshot.val());
      } else {
        setTimetables({});
      }
      setLoading(false);
    });
  }, []);

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this timetable permanently?')) {
      remove(ref(db, `generated_timetables/${id}`));
      if (selectedId === id) setSelectedId(null);
    }
  };

  const exportPDF = (tt) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const title = `${tt.meta?.programCode} - Year ${tt.meta?.year} - Sec ${tt.meta?.section}`;
    
    doc.setFontSize(18);
    doc.text(`Timetable: ${title}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date(tt.updatedAt).toLocaleString()}`, 14, 22);

    ['G1', 'G2'].forEach((group, idx) => {
      if (idx > 0) doc.addPage('l', 'mm', 'a4');
      
      doc.setFontSize(14);
      doc.text(`GROUP ${group.slice(1)} SCHEDULE`, 14, 15);

      const tableData = ALL_SLOTS.map(slotIdx => {
        const row = [SLOT_LABELS[slotIdx]];
        DAYS.forEach(day => {
          const schedule = group === 'G1' ? tt.scheduleG1 : tt.scheduleG2;
          const session = schedule?.[day]?.[slotIdx];
          if (session && !session.isGap) {
            row.push(`${session.courseCode}\n${session.teacher?.name || session.teacher || 'TBA'}\n${session.room?.name || session.room || 'TBA'}\n(${session.type}${session.group === 'Combined' ? '-All' : ''})`);
          } else if (session?.isGap || GAP_SLOTS.includes(slotIdx)) {
            row.push('LUNCH BREAK');
          } else {
            row.push('');
          }
        });
        return row;
      });

      doc.autoTable({
        startY: 25,
        head: [['Time', ...DAYS]],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [30, 58, 138], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
    });

    doc.save(`${tt.meta?.programCode}_Y${tt.meta?.year}_Sec${tt.meta?.section}_Timetable.pdf`);
  };

  const exportExcel = (tt) => {
    const wb = XLSX.utils.book_new();
    
    ['G1', 'G2'].forEach(group => {
      const data = [['Time', ...DAYS]];
      ALL_SLOTS.forEach(slotIdx => {
        const row = [SLOT_LABELS[slotIdx]];
        DAYS.forEach(day => {
          const schedule = group === 'G1' ? tt.scheduleG1 : tt.scheduleG2;
          const session = schedule?.[day]?.[slotIdx];
          if (session && !session.isGap) {
            row.push(`${session.courseCode} | ${session.teacher?.name || session.teacher || 'TBA'} | ${session.room?.name || session.room || 'TBA'} (${session.type})`);
          } else if (session?.isGap || GAP_SLOTS.includes(slotIdx)) {
            row.push('LUNCH BREAK');
          } else {
            row.push('-');
          }
        });
        data.push(row);
      });
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, `Group ${group.slice(1)}`);
    });

    XLSX.writeFile(wb, `${tt.meta?.programCode}_Timetable.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const selectedTT = selectedId ? timetables[selectedId] : null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Saved Timetables</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">View and manage all academic schedules generated by the system.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* List of Timetables */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Generated Schedules</h3>
          {Object.entries(timetables).length === 0 ? (
            <div className="p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-500 italic">
              No timetables generated yet.
            </div>
          ) : (
            Object.entries(timetables).map(([id, tt]) => (
              <div 
                key={id} 
                onClick={() => setSelectedId(id)}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all group relative ${
                  selectedId === id ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-white dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm hover:border-blue-200'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-lg">{tt.meta?.programCode || id}</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(id); }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <Calendar size={12} /> Year {tt.meta?.year} • Sec {tt.meta?.section}
                </div>
                <div className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock size={10} /> Saved: {new Date(tt.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* View Grid */}
        <div className="lg:col-span-8">
          {selectedTT ? (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold">{selectedTT.meta?.programCode} Timetable</h2>
                  <p className="text-gray-500">Year {selectedTT.meta?.year} • Section {selectedTT.meta?.section}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => exportPDF(selectedTT)} className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-700 flex items-center gap-2 text-sm transition-all shadow-md">
                    <FileText size={18}/> PDF
                  </button>
                  <button onClick={() => exportExcel(selectedTT)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 flex items-center gap-2 text-sm transition-all shadow-md">
                    <Table size={18}/> Excel
                  </button>
                  <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 text-sm transition-all shadow-md">
                    <Printer size={18}/> Print
                  </button>
                </div>
              </div>

              <div className="space-y-12">
                {['G1', 'G2'].map(groupKey => (
                  <div key={groupKey}>
                    <div className="bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold inline-block mb-4">GROUP {groupKey.slice(1)}</div>
                    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
                      <table className="w-full border-collapse min-w-[800px]">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-700/50">
                            <th className="p-3 text-[10px] font-black uppercase text-gray-400 w-24 border-r dark:border-gray-700">Time</th>
                            {DAYS.map(day => <th key={day} className="p-3 text-[10px] font-black uppercase text-gray-400 border-r dark:border-gray-700">{day}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {ALL_SLOTS.map(slotIdx => (
                            <tr key={slotIdx} className="border-t dark:border-gray-700">
                              <td className="p-3 bg-gray-50/50 dark:bg-gray-800/50 text-[10px] font-bold text-center border-r dark:border-gray-700">{SLOT_LABELS[slotIdx]}</td>
                              {DAYS.map(day => {
                                const schedule = groupKey === 'G1' ? selectedTT.scheduleG1 : selectedTT.scheduleG2;
                                const session = schedule?.[day]?.[slotIdx];
                                const isGap = session?.isGap || GAP_SLOTS.includes(slotIdx);
                                const isCombined = session?.group === 'Combined';
                                const categoryClass = session ? CATEGORY_COLORS[session.category] || (session.type === 'LAB' ? CATEGORY_COLORS.LAB : CATEGORY_COLORS.CORE) : '';

                                return (
                                  <td key={day} className={`p-2 border-r dark:border-gray-700 min-h-[80px] ${isGap ? 'bg-gray-50/30 dark:bg-gray-900/20' : ''}`}>
                                    {session && !session.isGap ? (
                                      <div className={`p-2 rounded-lg border h-full relative ${categoryClass}`}>
                                        {isCombined && <div className="absolute -top-1.5 -right-1 bg-indigo-600 text-white text-[6px] font-black px-1 rounded-full uppercase">All</div>}
                                        <div className="font-bold text-[10px] truncate">{session.courseCode}</div>
                                        <div className="text-[8px] text-gray-500 line-clamp-1 mb-1">{session.teacher?.name || session.teacher || 'TBA'}</div>
                                        <div className="text-[8px] text-gray-500 line-clamp-1 mb-1">{session.room?.name || session.room || 'TBA'}</div>
                                        <div className="text-[8px] font-black uppercase tracking-tighter bg-white/50 dark:bg-black/20 px-1 rounded inline-block">{session.type}</div>
                                      </div>
                                    ) : isGap ? (
                                      <div className="h-full flex items-center justify-center text-[8px] text-gray-300 font-bold uppercase tracking-widest italic">Lunch</div>
                                    ) : null}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400">
              <Calendar size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Select a timetable from the list to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedTimetables;
