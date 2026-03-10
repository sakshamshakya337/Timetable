/**
 * TimetableGenerator.jsx
 * Main frontend component for LPU timetable generation.
 * 
 * Flow: Select Program → Year → Section → Assign Teachers → Assign Rooms
 *       → Choose Electives → Generate → View Grid
 *
 * Connects to backend at VITE_API_URL (default: http://localhost:3001)
 */

import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Slot labels ──────────────────────────────────────────────────────────────
const SLOT_LABELS = {
  0: '8:00–9:00',
  1: '9:00–10:00',
  2: '10:00–11:00',
  3: '11:00–12:00',
  4: '12:00–1:00',
  5: '1:00–2:00 🍽️',
  6: '2:00–3:00',
  7: '3:00–4:00',
  8: '4:00–5:00',
};
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const VALID_SLOTS = [0, 1, 2, 3, 4, 6, 7, 8];

const CATEGORY_COLORS = {
  CORE: '#dbeafe',
  LANGUAGE: '#fef9c3',
  ELECTIVE_SKILL: '#dcfce7',
  ELECTIVE_GENERIC: '#fce7f3',
  ELECTIVE_SPECIALIZATION: '#ede9fe',
  ELECTIVE_DISCIPLINE: '#ffedd5',
  HONOURS_CORE: '#cffafe',
  PROJECT_WORK: '#fee2e2',
  PROJECT_SEMINAR: '#fee2e2',
  LAB: '#d1fae5',
};

export default function TimetableGenerator() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1); // 1=program 2=year 3=section 4=teachers 5=rooms 6=electives 7=generate

  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [programYears, setProgramYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [section, setSection] = useState('A');

  const [courseData, setCourseData] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([
    { id: 'r1', name: 'Room 101', type: 'THEORY', capacity: 60 },
    { id: 'lab1', name: 'CS Lab 1', type: 'LAB', capacity: 30 },
  ]);
  const [electiveChoices, setElectiveChoices] = useState({});

  const [timetableResult, setTimetableResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Fetch programs on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/timetable/programs`)
      .then((r) => r.json())
      .then((d) => setPrograms(d.programs || []))
      .catch(() => setError('Cannot connect to backend. Ensure server is running.'));
  }, []);

  // ── Fetch years when program selected ─────────────────────────────────────
  useEffect(() => {
    if (!selectedProgram) return;
    fetch(`${API}/api/timetable/programs/${selectedProgram}/years`)
      .then((r) => r.json())
      .then((d) => setProgramYears(d.years || []));
  }, [selectedProgram]);

  // ── Fetch courses when year selected ──────────────────────────────────────
  useEffect(() => {
    if (!selectedProgram || !selectedYear) return;
    fetch(`${API}/api/timetable/courses?program=${selectedProgram}&year=${selectedYear}`)
      .then((r) => r.json())
      .then((d) => {
        setCourseData(d);
        // Initialize teacher entries for all courses
        const allCourses = [
          ...(d.courses?.core || []),
          ...(d.courses?.electives || []).flatMap((eg) => eg.options),
        ];
        const uniqueCodes = [...new Set(allCourses.map((c) => c.courseCode))];
        setTeachers(
          uniqueCodes.map((code) => {
            const c = allCourses.find((x) => x.courseCode === code);
            return { id: `t_${code}`, name: '', courseCode: code, courseTitle: c?.courseTitle || '' };
          })
        );
        // Reset elective choices
        setElectiveChoices({});
      });
  }, [selectedProgram, selectedYear]);

  // ── Generate timetable ────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/timetable/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program: selectedProgram,
          year: Number(selectedYear),
          section,
          teachers: teachers.filter((t) => t.name.trim()),
          rooms,
          electiveChoices,
          globalState: {},
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setTimetableResult(data);
      setStep(7);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProgram, selectedYear, section, teachers, rooms, electiveChoices]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <h1 style={{ color: '#1e3a8a', marginBottom: 4 }}>LPU Timetable Generator</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>School of Computer Applications</p>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, marginBottom: 16, color: '#b91c1c' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── STEP INDICATOR ─────────────────────────────────────────────── */}
      <StepBar step={step} />

      {/* ── STEP 1: Program ──────────────────────────────────────────────── */}
      {step === 1 && (
        <Card title="Step 1 – Select Program">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {programs.map((p) => (
              <button
                key={p.officialCode}
                onClick={() => { setSelectedProgram(p.officialCode); setStep(2); }}
                style={btnStyle(selectedProgram === p.officialCode)}
              >
                <strong>{p.programName}</strong>
                <span style={{ fontSize: 12, display: 'block', color: '#64748b' }}>{p.officialCode} · {p.totalYears} years</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ── STEP 2: Year ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <Card title="Step 2 – Select Year">
          <BackBtn onClick={() => setStep(1)} />
          <div style={{ display: 'flex', gap: 12 }}>
            {programYears.map((y) => (
              <button
                key={y.year}
                onClick={() => { setSelectedYear(y.year); setStep(3); }}
                style={btnStyle(selectedYear === y.year)}
              >
                <strong>{y.label}</strong>
                <span style={{ fontSize: 11, display: 'block', color: '#64748b' }}>
                  {y.courseSummary.core} core · {y.courseSummary.electives} elective groups · {y.courseSummary.labs} labs
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ── STEP 3: Section ──────────────────────────────────────────────── */}
      {step === 3 && (
        <Card title="Step 3 – Section">
          <BackBtn onClick={() => setStep(2)} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {['A', 'B', 'C', 'D'].map((s) => (
              <button key={s} onClick={() => setSection(s)} style={btnStyle(section === s)}>{s}</button>
            ))}
            <input
              placeholder="Custom section..."
              value={section}
              onChange={(e) => setSection(e.target.value.toUpperCase())}
              style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 12px', width: 140 }}
            />
            <button onClick={() => setStep(4)} style={primaryBtn}>Continue →</button>
          </div>
        </Card>
      )}

      {/* ── STEP 4: Teacher Assignment ───────────────────────────────────── */}
      {step === 4 && courseData && (
        <Card title="Step 4 – Assign Teachers">
          <BackBtn onClick={() => setStep(3)} />
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>
            Enter teacher name for each subject. Leave blank if not yet assigned.
          </p>

          {/* Core courses */}
          <h4 style={{ color: '#1e3a8a', marginBottom: 8 }}>Core Subjects</h4>
          {teachers
            .filter((t) => {
              const c = courseData.courses?.core?.find((x) => x.courseCode === t.courseCode);
              return c && !c.isElective;
            })
            .map((t) => (
              <TeacherRow key={t.courseCode} t={t} teachers={teachers} setTeachers={setTeachers} />
            ))}

          {/* Elective subjects */}
          {courseData.courses?.electives?.length > 0 && (
            <>
              <h4 style={{ color: '#7c3aed', marginBottom: 8, marginTop: 16 }}>Elective Subjects</h4>
              {teachers
                .filter((t) => {
                  const allOpts = courseData.courses?.electives?.flatMap((eg) => eg.options) || [];
                  return allOpts.find((x) => x.courseCode === t.courseCode);
                })
                .map((t) => (
                  <TeacherRow key={t.courseCode} t={t} teachers={teachers} setTeachers={setTeachers} isElective />
                ))}
            </>
          )}

          <button onClick={() => setStep(5)} style={{ ...primaryBtn, marginTop: 16 }}>Continue →</button>
        </Card>
      )}

      {/* ── STEP 5: Rooms ────────────────────────────────────────────────── */}
      {step === 5 && (
        <Card title="Step 5 – Rooms">
          <BackBtn onClick={() => setStep(4)} />
          <RoomManager rooms={rooms} setRooms={setRooms} />
          <button onClick={() => setStep(6)} style={{ ...primaryBtn, marginTop: 16 }}>Continue →</button>
        </Card>
      )}

      {/* ── STEP 6: Elective Choices ─────────────────────────────────────── */}
      {step === 6 && courseData && (
        <Card title="Step 6 – Choose Electives">
          <BackBtn onClick={() => setStep(5)} />
          {courseData.courses?.electives?.length === 0 ? (
            <p style={{ color: '#64748b' }}>No elective baskets for this year.</p>
          ) : (
            courseData.courses.electives.map((eg) => (
              <div key={eg.basketName} style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#7c3aed' }}>{eg.title}</strong>
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>[{eg.category}] · {eg.basketName}</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {eg.options.map((opt) => (
                    <button
                      key={opt.courseCode}
                      onClick={() => setElectiveChoices((prev) => ({ ...prev, [eg.basketName]: opt.courseCode }))}
                      style={{
                        ...btnStyle(electiveChoices[eg.basketName] === opt.courseCode),
                        fontSize: 12,
                      }}
                    >
                      <strong>{opt.courseCode}</strong>
                      <span style={{ display: 'block', fontWeight: 'normal', color: '#64748b' }}>
                        {opt.courseTitle.length > 35 ? opt.courseTitle.slice(0, 35) + '…' : opt.courseTitle}
                      </span>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>
                        L={opt.L} T={opt.T} P={opt.P} · {opt.subjectType}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
          <button onClick={handleGenerate} disabled={loading} style={{ ...primaryBtn, marginTop: 8, background: '#16a34a' }}>
            {loading ? '⏳ Generating...' : '🗓️ Generate Timetable'}
          </button>
        </Card>
      )}

      {/* ── STEP 7: Timetable Grid ───────────────────────────────────────── */}
      {step === 7 && timetableResult && (
        <Card title={`Timetable – ${timetableResult.meta.programName} · Year ${timetableResult.meta.year} · Section ${timetableResult.meta.section}`}>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(6)} style={secondaryBtn}>← Back</button>
            <button onClick={() => window.print()} style={primaryBtn}>🖨️ Print</button>
          </div>

          {timetableResult.warnings.length > 0 && (
            <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <strong>⚠️ Warnings:</strong>
              <ul style={{ margin: '4px 0 0 16px', fontSize: 12 }}>
                {timetableResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {timetableResult.unscheduled.length > 0 && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <strong>❌ Unscheduled:</strong>
              <ul style={{ margin: '4px 0 0 16px', fontSize: 12 }}>
                {timetableResult.unscheduled.map((u, i) => (
                  <li key={i}>{u.courseCode} – {u.courseTitle}: {u.reason}</li>
                ))}
              </ul>
            </div>
          )}

          <TimetableGrid grid={timetableResult.grid} />
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TimetableGrid({ grid }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={th}>Time</th>
            {DAYS.map((d) => <th key={d} style={th}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {VALID_SLOTS.map((slotIdx) => {
            const row = grid?.find((r) => r.slotIndex === slotIdx);
            return (
              <tr key={slotIdx}>
                <td style={{ ...td, background: '#f1f5f9', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11 }}>
                  {SLOT_LABELS[slotIdx]}
                </td>
                {DAYS.map((day) => {
                  const cell = row ? row[day] : null;
                  return (
                    <td key={day} style={{
                      ...td,
                      background: cell
                        ? CATEGORY_COLORS[cell.category] || (cell.type === 'LAB' ? '#d1fae5' : '#fff')
                        : '#fafafa',
                      verticalAlign: 'top',
                    }}>
                      {cell ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{cell.courseCode}</div>
                          <div style={{ fontSize: 10, color: '#475569' }}>
                            {cell.courseTitle?.length > 28 ? cell.courseTitle.slice(0, 28) + '…' : cell.courseTitle}
                          </div>
                          {cell.teacher && <div style={{ fontSize: 10, color: '#6366f1' }}>👤 {cell.teacher.name}</div>}
                          {cell.room && <div style={{ fontSize: 10, color: '#0891b2' }}>🏫 {cell.room.name}</div>}
                          <div style={{
                            display: 'inline-block', fontSize: 9, padding: '1px 5px', borderRadius: 4,
                            background: cell.type === 'LAB' ? '#6ee7b7' : '#bfdbfe', color: '#1e3a8a', marginTop: 2
                          }}>
                            {cell.type}{cell.isElective ? ' · ELECTIVE' : ''}
                          </div>
                          {cell.note && <div style={{ fontSize: 9, color: '#94a3b8' }}>{cell.note}</div>}
                        </div>
                      ) : <span style={{ color: '#cbd5e1', fontSize: 10 }}>—</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TeacherRow({ t, teachers, setTeachers, isElective }) {
  const update = (val) => setTeachers(teachers.map((x) => x.id === t.id ? { ...x, name: val } : x));
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
      <span style={{
        width: 90, fontSize: 11, fontWeight: 600, color: isElective ? '#7c3aed' : '#1e3a8a',
        background: isElective ? '#ede9fe' : '#dbeafe', borderRadius: 4, padding: '2px 6px'
      }}>{t.courseCode}</span>
      <span style={{ flex: 1, fontSize: 12, color: '#475569' }}>
        {t.courseTitle?.length > 45 ? t.courseTitle.slice(0, 45) + '…' : t.courseTitle}
      </span>
      <input
        placeholder="Teacher name..."
        value={t.name}
        onChange={(e) => update(e.target.value)}
        style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '5px 10px', width: 180, fontSize: 12 }}
      />
    </div>
  );
}

function RoomManager({ rooms, setRooms }) {
  const addRoom = () => setRooms([...rooms, { id: `r${Date.now()}`, name: '', type: 'THEORY', capacity: 60 }]);
  const update = (id, field, val) => setRooms(rooms.map((r) => r.id === id ? { ...r, [field]: val } : r));
  const remove = (id) => setRooms(rooms.filter((r) => r.id !== id));

  return (
    <div>
      {rooms.map((r) => (
        <div key={r.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input placeholder="Room name" value={r.name} onChange={(e) => update(r.id, 'name', e.target.value)}
            style={inputStyle} />
          <select value={r.type} onChange={(e) => update(r.id, 'type', e.target.value)} style={inputStyle}>
            <option value="THEORY">Theory Room</option>
            <option value="LAB">Computer Lab</option>
          </select>
          <input type="number" placeholder="Capacity" value={r.capacity}
            onChange={(e) => update(r.id, 'capacity', Number(e.target.value))}
            style={{ ...inputStyle, width: 90 }} />
          <button onClick={() => remove(r.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      ))}
      <button onClick={addRoom} style={secondaryBtn}>+ Add Room</button>
    </div>
  );
}

function StepBar({ step }) {
  const steps = ['Program', 'Year', 'Section', 'Teachers', 'Rooms', 'Electives', 'Timetable'];
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
      {steps.map((s, i) => (
        <div key={s} style={{
          flex: 1, textAlign: 'center', padding: '8px 4px', fontSize: 12, fontWeight: step === i + 1 ? 700 : 400,
          background: step === i + 1 ? '#1e3a8a' : step > i + 1 ? '#3b82f6' : 'transparent',
          color: step >= i + 1 ? '#fff' : '#64748b',
        }}>
          {step > i + 1 ? '✓ ' : `${i + 1}. `}{s}
        </div>
      ))}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 16px', color: '#1e3a8a' }}>{title}</h3>
      {children}
    </div>
  );
}

function BackBtn({ onClick }) {
  return <button onClick={onClick} style={{ ...secondaryBtn, marginBottom: 12 }}>← Back</button>;
}

// ── Styles ───────────────────────────────────────────────────────────────────
const btnStyle = (active) => ({
  padding: '10px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
  border: active ? '2px solid #1e3a8a' : '1px solid #e2e8f0',
  background: active ? '#dbeafe' : '#f8fafc',
  transition: 'all 0.15s',
});
const primaryBtn = {
  padding: '10px 20px', borderRadius: 8, background: '#1e3a8a', color: '#fff',
  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
};
const secondaryBtn = {
  padding: '8px 16px', borderRadius: 8, background: '#f1f5f9', color: '#1e3a8a',
  border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 13,
};
const inputStyle = {
  border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 10px', fontSize: 13,
};
const th = {
  background: '#1e3a8a', color: '#fff', padding: '8px 10px', textAlign: 'center',
  border: '1px solid #1d4ed8', fontWeight: 600, fontSize: 12,
};
const td = {
  border: '1px solid #e2e8f0', padding: '6px 8px', minWidth: 120, minHeight: 60,
};
