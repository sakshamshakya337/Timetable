/**
 * Timetable.jsx
 * Main frontend component for LPU timetable generation.
 * 
 * Flow: Select Program → Year → Section → Assign Teachers → Assign Rooms
 *       → Choose Electives → Generate → View Grid
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Play, Loader2, AlertTriangle, Settings, Printer, ArrowLeft, FileText, Table } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const API = 'http://localhost:5000/timetable';

// ── Slot labels ──────────────────────────────────────────────────────────────
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
const GAP_SLOTS = [4];
const ALL_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];

const CATEGORY_COLORS = {
  CORE: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  LANGUAGE: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  ELECTIVE: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  LAB: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  PROJECT: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
};

export default function Timetable() {
  const [step, setStep] = useState(1);
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [programYears, setProgramYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [availableSections, setAvailableSections] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [customSectionInput, setCustomSectionInput] = useState('');

  const [courseData, setCourseData] = useState(null);
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [teachers, setTeachers] = useState([]); // List of teacher assignment slots conceptually
  const [teacherAssignments, setTeacherAssignments] = useState({}); // { [section]: { [slotId]: teacherId } }
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [electiveChoices, setElectiveChoices] = useState({});
  const [generateAllCombinations, setGenerateAllCombinations] = useState(false);

  const [timetableResult, setTimetableResult] = useState(null);
  const [allTimetables, setAllTimetables] = useState([]);
  const [selectedTimetableIndex, setSelectedTimetableIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Auto-load existing timetable if it exists ──
  useEffect(() => {
    if (!selectedProgram || !selectedYear || selectedSections.length === 0) return;

    // Load first section for preview
    const firstSection = selectedSections[0];
    const sanitizedSection = firstSection.replace(/[\.\#\$\/\\[\]]/g, '_');
    const timetableId = `${selectedProgram}_Y${selectedYear}_${sanitizedSection}`;
    const timetableRef = ref(db, `generated_timetables/${timetableId}`);

    const unsubscribe = onValue(timetableRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setTimetableResult(data);
      }
    });

    return () => unsubscribe();
  }, [selectedProgram, selectedYear, selectedSections]);

  useEffect(() => {
    // Fetch programs
    fetch(`${API}/programs`)
      .then((r) => r.json())
      .then((d) => setPrograms(d.programs || []))
      .catch(() => setError('Cannot connect to backend. Ensure server is running on port 5000.'));

    // Fetch available teachers for dropdown
    const teachersRef = ref(db, 'teachers');
    onValue(teachersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data).map(([id, t]) => ({
          id,
          name: t.full_name || t.name || t.Name || 'Unknown',
          code: t.teacher_id || t.code || t.Code || t.designation || 'N/A'
        }));
        setAvailableTeachers(list);
      }
    });

    // Fetch available rooms for selection
    const roomsRef = ref(db, 'rooms');
    onValue(roomsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data).map(([id, r]) => ({
          id,
          name: r.room_name || r.name || 'Unknown',
          type: (r.room_type || r.type || 'THEORY').toUpperCase().includes('LAB') ? 'LAB' : 'THEORY',
          capacity: parseInt(r.capacity_students || r.capacity || 60, 10)
        }));
        setAvailableRooms(list);
        // Default selection: all rooms
        setRooms(list);
      }
    });

    // Fetch available sections
    const sectionsRef = ref(db, 'sections');
    onValue(sectionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data).map(([id, s]) => ({
          id,
          name: s.section_name || s.name || id,
          semester: s.semester || 'N/A'
        }));
        setAvailableSections(list);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedProgram) return;
    fetch(`${API}/programs/${selectedProgram}/years`)
      .then((r) => r.json())
      .then((d) => setProgramYears(d.years || []));
  }, [selectedProgram]);

  useEffect(() => {
    if (!selectedProgram || !selectedYear) return;
    fetch(`${API}/courses?program=${selectedProgram}&year=${selectedYear}`)
      .then((r) => r.json())
      .then((d) => {
        setCourseData(d);
        const allCourses = [
          ...(d.courses?.core || []),
          ...(d.courses?.theory || []),
          ...(d.courses?.labs || []),
          ...(d.courses?.electives || []).flatMap((eg) => eg.options),
        ];
        const uniqueCodes = [...new Set(allCourses.map((c) => c.courseCode))];

        // Expand teacher assignments to be group-specific
        const expandedTeachers = [];
        uniqueCodes.forEach(code => {
          const c = allCourses.find(x => x.courseCode === code);
          const hasLab = c?.labHours > 0 || c?.P > 0;
          const hasTheory = c?.theoryHours > 0 || c?.L > 0 || c?.T > 0;

          if (hasTheory) {
            expandedTeachers.push({
              id: `t_${code}_combined`,
              name: '',
              courseCode: code,
              courseTitle: c?.courseTitle || '',
              group: 'Combined',
              label: 'Theory / Combined'
            });
          }
          if (hasLab) {
            expandedTeachers.push({
              id: `t_${code}_g1`,
              name: '',
              courseCode: code,
              courseTitle: c?.courseTitle || '',
              group: 'G1',
              label: 'Lab (Group 1)'
            });
            expandedTeachers.push({
              id: `t_${code}_g2`,
              name: '',
              courseCode: code,
              courseTitle: c?.courseTitle || '',
              group: 'G2',
              label: 'Lab (Group 2)'
            });
          }
        });

        setTeachers(expandedTeachers);
        setSelectedSubjects(uniqueCodes);
        setElectiveChoices({});
      });
  }, [selectedProgram, selectedYear]);

  const generateElectiveCombinations = (electives) => {
    if (!electives || electives.length === 0) return [{}];

    const combinations = [];
    const basketNames = electives.map(eg => eg.basketName);
    const options = electives.map(eg => eg.options);

    function generateCombos(index, current) {
      if (index === basketNames.length) {
        combinations.push({ ...current });
        return;
      }

      for (const option of options[index]) {
        current[basketNames[index]] = option.courseCode;
        generateCombos(index + 1, current);
      }
    }

    generateCombos(0, {});
    return combinations;
  };

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError('');
    setAllTimetables([]);

    try {
      // Validate inputs
      if (rooms.length === 0) {
        throw new Error('Please select at least one room before generating timetable');
      }
      if (selectedSections.length === 0) {
        throw new Error('Please select at least one section before generating timetable');
      }

      const generatedTimetables = [];
      let globalState = {};

      for (const sectionName of selectedSections) {
        // Build teachers for this section
        const assignedTeachers = teachers
          .filter(t => selectedSubjects.includes(t.courseCode))
          .map(t => {
            const dbId = teacherAssignments[sectionName]?.[t.id];
            const teacherData = availableTeachers.find(at => at.id === dbId);
            if (!teacherData) return null;
            return {
              id: dbId,
              name: teacherData.name,
              courseCode: t.courseCode,
              group: t.group,
              maxHrsPerWeek: 40
            };
          }).filter(Boolean);

        if (assignedTeachers.length === 0) {
          console.warn(`No teachers assigned for section ${sectionName}`);
          // Continue generating even if some sections lack teachers? Probably better to try.
        }

        if (generateAllCombinations && courseData?.courses?.electives?.length > 0) {
          // Generate all elective combinations
          const combinations = generateElectiveCombinations(courseData.courses.electives);

          for (let i = 0; i < combinations.length; i++) {
            const combo = combinations[i];
            const comboLabel = Object.entries(combo).map(([basket, code]) => code).join('-');

            const res = await fetch(`${API}/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                program: selectedProgram,
                year: Number(selectedYear),
                section: `${sectionName}-${comboLabel}`,
                teachers: assignedTeachers,
                rooms,
                electiveChoices: combo,
                selectedSubjects,
                sharedState: globalState,
              }),
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Generation failed');

            globalState = data.updatedState || globalState;

            generatedTimetables.push({
              ...data,
              sectionName: `${sectionName}-${comboLabel}`,
              electiveCombination: combo,
              combinationLabel: comboLabel
            });
          }
        } else {
          // Generate single timetable with selected electives
          const res = await fetch(`${API}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              program: selectedProgram,
              year: Number(selectedYear),
              section: sectionName,
              teachers: assignedTeachers,
              rooms,
              electiveChoices,
              selectedSubjects,
              sharedState: globalState,
            }),
          });

          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Generation failed');

          globalState = data.updatedState || globalState;

          generatedTimetables.push({
            ...data,
            sectionName: sectionName
          });
        }
      }

      if (generatedTimetables.length === 0) {
        throw new Error('No timetables generated.');
      }

      setAllTimetables(generatedTimetables);
      setSelectedTimetableIndex(0);
      setTimetableResult(generatedTimetables[0]);

      setStep(8);
    } catch (err) {
      setError(err.message);
      console.error('Generation error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProgram, selectedYear, selectedSections, teachers, teacherAssignments, rooms, electiveChoices, generateAllCombinations, courseData, selectedSubjects]);

  const exportPDF = (tt) => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const title = `${tt.programName || tt.meta?.programName || selectedProgram} - Year ${selectedYear} - Sec ${tt.sectionName}`;

      ['G1', 'G2'].forEach((group, idx) => {
        if (idx > 0) {
          doc.addPage('a4', 'landscape');
        }

        // Main title at the top
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`Timetable: ${title}`, 14, 10);

        // Generated date
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 15);

        // Version indicator (to verify new code is loaded)
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text('v2.0-FIXED', 260, 10);

        // Add a separator line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(14, 18, 283, 18);

        // Group header - prominent and well-spaced with blue background box
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255); // White text
        doc.setFillColor(30, 58, 138); // Blue background
        doc.rect(14, 22, 269, 7, 'F'); // Filled rectangle
        doc.text(`GROUP ${group.slice(1)} SCHEDULE`, 18, 27);

        // Reset text color for table
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');

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
          startY: 32,
          head: [['Time', ...DAYS]],
          body: tableData,
          theme: 'grid',
          styles: {
            fontSize: 7,
            cellPadding: 2,
            halign: 'center',
            valign: 'middle',
            overflow: 'linebreak'
          },
          headStyles: {
            fillColor: [30, 58, 138],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8
          },
          alternateRowStyles: {
            fillColor: [245, 247, 250]
          },
          columnStyles: {
            0: { cellWidth: 30, fontStyle: 'bold', fillColor: [240, 240, 240] }
          },
          margin: { top: 32, left: 14, right: 14 }
        });
      });

      doc.save(`${selectedProgram}_Y${selectedYear}_Sec${tt.sectionName}_Timetable.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Failed to generate PDF. Please check console for details.');
    }
  };

  const exportExcel = (tt) => {
    const wb = XLSX.utils.book_new();

    ['G1', 'G2'].forEach(group => {
      // Add header rows with group information
      const data = [
        [`GROUP ${group.slice(1)} SCHEDULE`],
        [`${tt.programName || tt.meta?.programName || selectedProgram} - Year ${selectedYear} - Section ${tt.sectionName}`],
        [`Generated on: ${new Date().toLocaleString()}`],
        [], // Empty row for spacing
        ['Time', ...DAYS] // Column headers
      ];

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

      // Style the header rows
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }); // Merge cells for group title
      ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }); // Merge cells for program info
      ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }); // Merge cells for date

      // Set column widths
      ws['!cols'] = [
        { wch: 20 }, // Time column
        { wch: 25 }, // Monday
        { wch: 25 }, // Tuesday
        { wch: 25 }, // Wednesday
        { wch: 25 }, // Thursday
        { wch: 25 }  // Friday
      ];

      XLSX.utils.book_append_sheet(wb, ws, `Group ${group.slice(1)}`);
    });

    XLSX.writeFile(wb, `${selectedProgram}_Y${selectedYear}_Sec${tt.sectionName}_Timetable.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 dark:text-white">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-blue-900 dark:text-blue-400">Timetable Scheduling Engine</h1>
        <p className="text-gray-600 dark:text-gray-400">Professional Academic Resource Management</p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      <div className="flex justify-between mb-8 bg-gray-100 dark:bg-gray-800 p-2 rounded-xl overflow-x-auto">
        {['Program', 'Year', 'Section', 'Subjects', 'Teachers', 'Rooms', 'Electives', 'Review'].map((s, i) => (
          <div key={s} className={`flex-1 text-center py-2 px-4 rounded-lg text-sm font-medium transition-colors ${step === i + 1 ? 'bg-blue-600 text-white shadow-lg' : step > i + 1 ? 'text-blue-600' : 'text-gray-500'
            }`}>
            {step > i + 1 ? '✓ ' : `${i + 1}. `}{s}
          </div>
        ))}
      </div>

      <main className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        {step === 1 && (
          <section>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings className="text-blue-600" /> Select Program</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {programs.map((p) => (
                <button
                  key={p.baseCode}
                  onClick={() => { setSelectedProgram(p.baseCode); setStep(2); }}
                  className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${selectedProgram === p.baseCode ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50'
                    }`}
                >
                  <div className="font-bold text-lg">{p.programName}</div>
                  <div className="text-sm text-gray-500">{p.baseCode}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <button onClick={() => setStep(1)} className="mb-6 flex items-center gap-2 text-blue-600 hover:underline"><ArrowLeft size={16} /> Back</button>
            <h2 className="text-xl font-bold mb-6">Select Year & Semester</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {programYears.map((y) => (
                <button
                  key={y.year}
                  onClick={() => { setSelectedYear(y.year); setStep(3); }}
                  className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${selectedYear === y.year ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50'
                    }`}
                >
                  <div className="font-bold text-lg">{y.label}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    {y.coreCount} Core • {y.electiveGroups} Electives • {y.labCount} Labs
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <button onClick={() => setStep(2)} className="mb-6 flex items-center gap-2 text-blue-600 hover:underline"><ArrowLeft size={16} /> Back</button>
            <h2 className="text-xl font-bold mb-2">Assign Academic Section</h2>
            <p className="text-gray-500 mb-6 text-sm">Select the real section for which you want to generate the timetable.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {availableSections
                .filter(s => {
                  if (!s.name) return false;
                  const progCode = selectedProgram?.toLowerCase() || '';
                  const yearStr = `y${selectedYear}`;
                  return s.name.toLowerCase().includes(progCode) || s.name.toLowerCase().includes(yearStr);
                })
                .map((s) => (
                  <label
                    key={s.id}
                    className={`flex items-start gap-3 text-left p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${selectedSections.includes(s.name) ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(s.name)}
                      onChange={() => {
                        if (selectedSections.includes(s.name)) {
                          setSelectedSections(selectedSections.filter(n => n !== s.name));
                        } else {
                          setSelectedSections([...selectedSections, s.name]);
                        }
                      }}
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-bold">{s.name}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Semester: {s.semester}</div>
                    </div>
                  </label>
                ))}
            </div>

            <div className="flex flex-wrap gap-4 items-end border-t dark:border-gray-800 pt-8">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Add Custom Section</label>
                <div className="flex gap-2">
                  <input
                    placeholder="Enter Section ID (e.g. BCA-Y1-SECA)"
                    value={customSectionInput}
                    onChange={(e) => setCustomSectionInput(e.target.value.toUpperCase())}
                    className="flex-1 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 focus:border-blue-600 outline-none font-bold"
                  />
                  <button
                    onClick={() => {
                      if (customSectionInput && !selectedSections.includes(customSectionInput)) {
                        setSelectedSections([...selectedSections, customSectionInput]);
                        setCustomSectionInput('');
                      }
                    }}
                    className="bg-gray-200 dark:bg-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 h-[52px]"
                  >
                    Add
                  </button>
                </div>
              </div>
              <button
                disabled={selectedSections.length === 0}
                onClick={() => setStep(4)}
                className="bg-blue-600 text-white px-12 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed h-[52px]"
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section>
            <button onClick={() => setStep(3)} className="mb-6 flex items-center gap-2 text-blue-600 hover:underline"><ArrowLeft size={16} /> Back</button>
            <h2 className="text-xl font-bold mb-2">Choose Subjects</h2>
            <p className="text-gray-500 mb-6 text-sm">Select the subjects you want to include in the generated timetables.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {teachers.reduce((acc, t) => {
                if (!acc.includes(t.courseCode)) acc.push(t.courseCode);
                return acc;
              }, []).map((code) => {
                const courseInfo = teachers.find(t => t.courseCode === code);
                return (
                  <label key={code} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedSubjects.includes(code) ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50'}`}>
                    <input
                      type="checkbox"
                      checked={selectedSubjects.includes(code)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSubjects([...selectedSubjects, code]);
                        else setSelectedSubjects(selectedSubjects.filter(c => c !== code));
                      }}
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-bold text-sm text-blue-600 dark:text-blue-400">{code}</div>
                      <div className="text-sm font-medium">{courseInfo?.courseTitle}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="mt-8 flex justify-end">
              <button disabled={selectedSubjects.length === 0} onClick={() => setStep(5)} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Continue</button>
            </div>
          </section>
        )}

        {step === 5 && (
          <section>
            <button onClick={() => setStep(4)} className="mb-6 flex items-center gap-2 text-blue-600 hover:underline"><ArrowLeft size={16} /> Back</button>
            <h2 className="text-xl font-bold mb-2">Assign Teachers</h2>
            <p className="text-gray-500 mb-6 text-sm">Assign faculty members per section for each selected subject.</p>
            <div className="space-y-6">
              {teachers.filter(t => selectedSubjects.includes(t.courseCode)).map((t) => (
                <div key={t.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4 border-b pb-3 dark:border-gray-700">
                    <div className="w-24 shrink-0 flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/30 rounded-lg py-2">
                      <div className="font-mono font-bold text-blue-600 text-xs">{t.courseCode}</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">{t.courseTitle}</div>
                      <div className="text-[10px] uppercase font-bold text-blue-500">{t.label}</div>
                    </div>
                    <div className="shrink-0 w-full md:w-auto">
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          const updated = { ...teacherAssignments };
                          selectedSections.forEach(sec => {
                            if (!updated[sec]) updated[sec] = {};
                            updated[sec][t.id] = val;
                          });
                          setTeacherAssignments(updated);
                          e.target.value = '';
                        }}
                        className="w-full text-xs border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded px-2 py-2 outline-none"
                      >
                        <option value="">Quick Apply to All Sections...</option>
                        {availableTeachers.map(at => (
                          <option key={at.id} value={at.id}>{at.name} ({at.code})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                    {selectedSections.map(sec => (
                      <div key={sec} className="flex items-center gap-2 text-sm">
                        <span className="w-32 font-medium truncate text-gray-600 dark:text-gray-400" title={sec}>{sec}</span>
                        <select
                          value={teacherAssignments[sec]?.[t.id] || ''}
                          onChange={(e) => {
                            const updated = { ...teacherAssignments };
                            if (!updated[sec]) updated[sec] = {};
                            updated[sec][t.id] = e.target.value;
                            setTeacherAssignments(updated);
                          }}
                          className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-1.5 focus:border-blue-600 outline-none text-sm"
                        >
                          <option value="">Select Teacher...</option>
                          {availableTeachers.map(at => (
                            <option key={at.id} value={at.id}>{at.name} ({at.code})</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => setStep(6)} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700">Continue</button>
            </div>
          </section>
        )}

        {step === 6 && (
          <section>
            <button onClick={() => setStep(5)} className="mb-6 flex items-center gap-2 text-blue-600 hover:underline"><ArrowLeft size={16} /> Back</button>
            <h2 className="text-xl font-bold mb-6">Select Rooms for this Schedule</h2>
            <p className="text-gray-500 mb-6 text-sm">Select the classrooms and labs available for this section's timetable.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {availableRooms.map((r) => (
                <label key={r.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${rooms.some(selected => selected.id === r.id) ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50'
                  }`}>
                  <input
                    type="checkbox"
                    checked={rooms.some(selected => selected.id === r.id)}
                    onChange={() => {
                      if (rooms.some(selected => selected.id === r.id)) {
                        setRooms(rooms.filter(selected => selected.id !== r.id));
                      } else {
                        setRooms([...rooms, r]);
                      }
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.type} • Cap: {r.capacity}</div>
                  </div>
                </label>
              ))}
            </div>

            {availableRooms.length === 0 && (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 italic text-sm">No rooms found in database. Please add them in the Rooms page first.</p>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button onClick={() => setStep(7)} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700">Continue</button>
            </div>
          </section>
        )}

        {step === 7 && (
          <section>
            <button onClick={() => setStep(6)} className="mb-6 flex items-center gap-2 text-blue-600 hover:underline"><ArrowLeft size={16} /> Back</button>
            <h2 className="text-xl font-bold mb-6">Choose Electives</h2>

            {courseData?.courses?.electives?.length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateAllCombinations}
                    onChange={(e) => setGenerateAllCombinations(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold text-blue-900 dark:text-blue-100">Generate All Elective Combinations</div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">
                      Create separate timetables for each possible elective combination ({generateElectiveCombinations(courseData.courses.electives).length} combinations)
                    </div>
                  </div>
                </label>
              </div>
            )}

            <div className="space-y-6">
              {courseData?.courses?.electives?.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">No elective baskets for this program year.</div>
              ) : (
                courseData?.courses?.electives?.map((eg) => (
                  <div key={eg.basketName} className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-purple-700">{eg.title}</h3>
                        <p className="text-xs text-gray-500">{eg.basketName}</p>
                      </div>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full uppercase tracking-wider">{eg.category}</span>
                    </div>

                    {!generateAllCombinations && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {eg.options.map((opt) => (
                          <button
                            key={opt.courseCode}
                            onClick={() => setElectiveChoices({ ...electiveChoices, [eg.basketName]: opt.courseCode })}
                            className={`text-left p-4 rounded-xl border-2 transition-all ${electiveChoices[eg.basketName] === opt.courseCode ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 shadow-md' : 'border-white dark:border-gray-800 bg-white dark:bg-gray-900'
                              }`}
                          >
                            <div className="font-bold text-sm mb-1">{opt.courseCode}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2 h-8">{opt.courseTitle}</div>
                            <div className="text-[10px] text-gray-400 font-mono">L={opt.L} T={opt.T} P={opt.P} • {opt.subjectType}</div>
                          </button>
                        ))}
                      </div>
                    )}

                    {generateAllCombinations && (
                      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <span className="font-bold">{eg.options.length} options</span> will be used to generate combinations:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {eg.options.map((opt) => (
                            <span key={opt.courseCode} className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium">
                              {opt.courseCode}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="mt-12 flex justify-center">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="bg-green-600 text-white px-12 py-4 rounded-2xl font-bold text-lg hover:bg-green-700 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Play size={20} />}
                {loading ? 'Generating Timetables...' : generateAllCombinations ? `Generate ${generateElectiveCombinations(courseData?.courses?.electives || []).length} Timetables` : 'Generate Timetable'}
              </button>
            </div>
          </section>
        )}

        {step === 8 && timetableResult && (
          <section>
            <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-bold">{timetableResult.programName || timetableResult.meta?.programName || 'Generated Timetable'}</h2>

                {allTimetables.length > 1 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Timetable View:</span>
                    <select
                      value={selectedTimetableIndex}
                      onChange={(e) => {
                        const index = parseInt(e.target.value);
                        setSelectedTimetableIndex(index);
                        setTimetableResult(allTimetables[index]);
                      }}
                      className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-lg px-3 py-1 text-sm font-medium"
                    >
                      {allTimetables.map((tt, idx) => (
                        <option key={idx} value={idx}>
                          {tt.sectionName} {tt.combinationLabel ? `(${tt.combinationLabel})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(7)} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"><ArrowLeft size={18} /> Back</button>
                <button onClick={() => exportPDF(timetableResult)} className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-700 flex items-center gap-2 text-sm transition-all shadow-md">
                  <FileText size={18} /> PDF
                </button>
                <button onClick={() => exportExcel(timetableResult)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 flex items-center gap-2 text-sm transition-all shadow-md">
                  <Table size={18} /> Excel
                </button>
                {allTimetables.length > 1 && (
                  <button
                    onClick={() => {
                      allTimetables.forEach((tt, idx) => {
                        setTimeout(() => exportPDF(tt), idx * 500);
                      });
                    }}
                    className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-purple-700 flex items-center gap-2 text-sm transition-all shadow-md"
                  >
                    <FileText size={18} /> Export All PDFs
                  </button>
                )}
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 text-sm transition-all shadow-md"><Printer size={18} /> Print</button>
              </div>
            </div>

            {/* Elective Combination Info */}
            {timetableResult.electiveCombination && Object.keys(timetableResult.electiveCombination).length > 0 && (
              <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl border border-purple-200 dark:border-purple-800">
                <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 mb-4">Selected Electives for this Timetable</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(timetableResult.electiveCombination).map(([basket, code]) => {
                    const elective = courseData?.courses?.electives
                      ?.find(eg => eg.basketName === basket)
                      ?.options.find(opt => opt.courseCode === code);
                    return (
                      <div key={basket} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-purple-200 dark:border-purple-700">
                        <div className="text-xs text-purple-600 dark:text-purple-400 font-bold mb-1">{basket}</div>
                        <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{code}</div>
                        {elective && <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{elective.courseTitle}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Timetable Grids for G1 and G2 */}
            <div className="space-y-12">
              {['G1', 'G2'].map(groupKey => (
                <div key={groupKey}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold">GROUP {groupKey.slice(1)}</div>
                    <div className="text-gray-400 text-sm font-medium">Weekly Schedule (Mon-Fri)</div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
                    <table className="w-full border-collapse min-w-[1000px]">
                      <thead>
                        <tr className="bg-blue-900 text-white">
                          <th className="p-4 text-sm font-bold border-r border-blue-800 w-32">Time</th>
                          {DAYS.map(day => (
                            <th key={day} className="p-4 text-sm font-bold border-r border-blue-800">{day}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ALL_SLOTS.map(slotIdx => (
                          <tr key={slotIdx} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="p-4 bg-gray-50 dark:bg-gray-800/50 font-bold text-[11px] border-r border-gray-200 dark:border-gray-800 text-center">
                              {SLOT_LABELS[slotIdx]}
                            </td>
                            {DAYS.map(day => {
                              const schedule = groupKey === 'G1' ? timetableResult?.scheduleG1 : timetableResult?.scheduleG2;
                              const session = schedule ? schedule[day]?.[slotIdx] : null;
                              const isGap = session?.isGap || GAP_SLOTS.includes(slotIdx);
                              const isCombined = session?.group === 'Combined';

                              const categoryClass = session ? CATEGORY_COLORS[session.category] || (session.type === 'LAB' ? CATEGORY_COLORS.LAB : CATEGORY_COLORS.CORE) : '';

                              return (
                                <td key={day} className={`p-3 border-r border-gray-100 dark:border-gray-800 min-h-[100px] vertical-top ${isGap ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}>
                                  {session && !session.isGap ? (
                                    <div className={`p-3 rounded-xl border-2 h-full shadow-sm relative ${categoryClass}`}>
                                      {isCombined && (
                                        <div className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-sm uppercase tracking-tighter">Combined</div>
                                      )}
                                      <div className="font-bold text-blue-900 dark:text-blue-100 text-xs mb-1">{session.courseCode}</div>
                                      <div className="text-[10px] text-gray-600 dark:text-gray-400 font-medium mb-3 line-clamp-2 h-6 leading-tight">{session.courseTitle}</div>
                                      <div className="space-y-1">
                                        <div className="text-[9px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">👤 {session.teacher?.name || session.teacher || 'TBA'}</div>
                                        <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">🏫 {session.room?.name || session.room || 'TBA'}</div>
                                      </div>
                                      <div className="mt-3 inline-block px-2 py-0.5 bg-white/60 dark:bg-black/20 text-[8px] font-black rounded-md uppercase tracking-tighter">
                                        {session.type}
                                      </div>
                                    </div>
                                  ) : isGap ? (
                                    <div className="h-full flex items-center justify-center text-[10px] text-gray-400 font-bold italic uppercase tracking-widest">Lunch Break</div>
                                  ) : (
                                    <div className="h-full flex items-center justify-center text-gray-200 dark:text-gray-800 font-bold text-2xl">—</div>
                                  )}
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

            {timetableResult.warnings?.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl mt-8">
                <div className="font-bold text-yellow-800 mb-2 flex items-center gap-2"><AlertTriangle size={18} /> Configuration Warnings</div>
                <ul className="text-sm text-yellow-700 list-disc ml-5 space-y-1">
                  {timetableResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {timetableResult.unscheduled?.length > 0 && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl mt-6">
                <div className="font-bold text-red-800 mb-2">Unscheduled Subjects</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {timetableResult.unscheduled.map((u, i) => (
                    <div key={i} className="text-xs bg-white/50 p-2 rounded border border-red-100">
                      <span className="font-bold">{u.courseCode}</span>: {u.reason || `${u.type} failed.`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
