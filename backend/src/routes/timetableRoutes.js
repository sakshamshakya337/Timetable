/**
 * routes/timetableRoutes.js
 * Comprehensive REST API endpoints for the LPU V2 Engine
 */
'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const { parseCourseMaster } = require('../excelParser');
const { TimetableScheduler, ScheduleState, validateSchedule, summarizeSchedule, DAYS, ALL_SLOTS } = require('../scheduler');
const db = require('../config/firebase');

// ── Multer — memory storage, xlsx/xls only ────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') return cb(null, true);
    cb(new Error('Only .xlsx and .xls files are accepted'));
  },
});

let parsed = null;
const fs = require('fs');
const getD = () => { if (!parsed) throw new Error('No Excel uploaded. POST /api/timetable/upload first.'); return parsed; };

// ── Auto-load Course Master on startup ───────────────────────────────────────
function autoLoadCourseMaster() {
  const excelPath = path.join(__dirname, '..', '..', '..', 'Frontend', 'Course Master 25261 updated.xlsx');
  try {
    if (fs.existsSync(excelPath)) {
      console.log('[Startup] Auto-loading Course Master from:', excelPath);
      parsed = parseCourseMaster(excelPath);
      console.log(`[Startup] Auto-load OK: ${parsed.meta.totalPrograms} programs loaded.`);
    } else {
      console.log('[Startup] Course Master not found at:', excelPath);
      console.log('[Startup] Waiting for manual upload via POST /api/timetable/upload');
    }
  } catch (err) {
    console.error('[Startup] Auto-load failed:', err.message);
  }
}
autoLoadCourseMaster();

// ─────────────────────────────────────────────────────────────────────────────
// POST /upload
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload', upload.single('excel'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file. Send Excel as multipart field "excel".' });
    console.log(`[Upload] Parsing: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);
    parsed = parseCourseMaster(req.file.buffer);
    console.log(`[Upload] OK: ${parsed.meta.totalPrograms} programs, ${parsed.meta.totalCourses} courses, ${parsed.meta.totalBaskets} baskets`);
    res.json({ success: true, message: `Parsed ${req.file.originalname}`, meta: parsed.meta, programList: parsed.programList });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Dev: load from file path
router.post('/upload/path', (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath required' });
    const fs = require('fs');
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: `Not found: ${filePath}` });
    parsed = parseCourseMaster(filePath);
    res.json({ success: true, meta: parsed.meta, programList: parsed.programList });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/programs', (req, res) => {
  try { res.json({ success: true, programs: getD().programList }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/programs/:code/years', (req, res) => {
  try {
    const d = getD();
    const prog = d.programs[req.params.code];
    if (!prog) return res.status(404).json({ error: `Program ${req.params.code} not found` });
    const years = Object.entries(prog.yearData).map(([yr, yd]) => ({
      year: Number(yr), semester: yd.semester,
      label: `Year ${yr} (Semester ${yd.semester})`,
      coreCount: yd.coreCourses.length, electiveGroups: Object.keys(yd.electiveGroups).length,
      labCount: yd.labCourses.length, projectCount: yd.projectCourses.length,
    })).sort((a, b) => a.year - b.year);
    res.json({ success: true, programCode: req.params.code, programName: prog.programName, years });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/courses', (req, res) => {
  try {
    const d = getD();
    const { program, year } = req.query;
    if (!program || !year) return res.status(400).json({ error: 'program and year required' });
    const prog = d.programs[program];
    if (!prog) return res.status(404).json({ error: `Program ${program} not found` });
    const yd = prog.yearData[Number(year)];
    if (!yd) return res.status(404).json({ error: `Year ${year} not found for ${program}` });

    res.json({
      success: true, program, programName: prog.programName, year: Number(year), semester: yd.semester,
      courses: {
        core: yd.coreCourses.map(fmtCourse),
        electives: Object.entries(yd.electiveGroups).map(([bn, eg]) => ({
          basketName: bn, label: eg.label, courseType: eg.courseType,
          courseTypeLabel: eg.courseTypeLabel, optionCount: eg.options.length,
          options: eg.options.map(fmtCourse),
        })),
        projects: yd.projectCourses.map(fmtCourse),
        labs: yd.labCourses.map(fmtCourse),
        theory: yd.theoryCourses.map(fmtCourse),
      },
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ELECTIVES — All endpoints for the Electives page
// ─────────────────────────────────────────────────────────────────────────────
router.get('/electives', (req, res) => {
  try {
    const d = getD();
    const baskets = Object.values(d.electiveBaskets).map(fmtBasket);
    res.json({
      success: true,
      totalBaskets: baskets.length,
      totalOptions: baskets.reduce((s, b) => s + b.optionCount, 0),
      baskets,
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/electives/summary', (req, res) => {
  try {
    const d = getD();
    res.json({
      success: true,
      totalBaskets: Object.keys(d.electiveBaskets).length,
      groups: d.electiveSummary,
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/electives/by-program', (req, res) => {
  try {
    const d = getD();
    const { program } = req.query;
    if (!program) return res.status(400).json({ error: 'program query param required' });

    const baskets = Object.values(d.electiveBaskets)
      .filter(b => b.programs.includes(program))
      .map(fmtBasket);

    res.json({ success: true, program, totalBaskets: baskets.length, baskets });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/electives/by-type', (req, res) => {
  try {
    const d = getD();
    const { type } = req.query;
    if (!type) return res.status(400).json({ error: 'type query param required' });

    const baskets = Object.values(d.electiveBaskets)
      .filter(b => b.courseType === type.toUpperCase())
      .map(fmtBasket);

    const group = d.electiveSummary.find(g => g.courseType === type.toUpperCase());
    res.json({
      success: true,
      courseType: type.toUpperCase(),
      courseTypeLabel: group ? group.courseTypeLabel : type,
      totalBaskets: baskets.length,
      baskets,
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/electives/basket/:basketName', (req, res) => {
  try {
    const d = getD();
    const basket = d.electiveBaskets[req.params.basketName];
    if (!basket) return res.status(404).json({ error: `Basket "${req.params.basketName}" not found` });
    res.json({ success: true, basket: fmtBasket(basket) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/electives/course/:courseCode', (req, res) => {
  try {
    const d = getD();
    const code = req.params.courseCode.toUpperCase();
    const results = Object.values(d.electiveBaskets)
      .filter(b => b.options.some(o => o.courseCode === code))
      .map(b => ({
        basketName: b.basketName,
        label: b.label,
        courseType: b.courseType,
        courseTypeLabel: b.courseTypeLabel,
        programs: b.programs,
        years: b.years,
        course: b.options.find(o => o.courseCode === code),
      }));

    res.json({ success: true, courseCode: code, appearsInBaskets: results.length, baskets: results });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE — Single section
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const d = getD();
    const { program, year, section, teachers, rooms, electiveChoices, sharedState, selectedSubjects } = req.body;

    console.log('[Generate] Request received:', {
      program,
      year,
      section,
      teachersCount: teachers?.length,
      roomsCount: rooms?.length,
      electiveChoices,
      selectedSubjectsCount: selectedSubjects?.length
    });

    if (!program || !year || !section) return res.status(400).json({ error: 'program, year, section required' });
    if (!teachers?.length) return res.status(400).json({ error: 'teachers array required' });
    if (!rooms?.length) return res.status(400).json({ error: 'rooms array required' });

    const prog = d.programs[program];
    if (!prog) return res.status(404).json({ error: `Program ${program} not found` });
    const yd = prog.yearData[Number(year)];
    if (!yd) return res.status(404).json({ error: `Year ${year} not found` });

    let allCourses = [
      ...yd.coreCourses,
      ...Object.values(yd.electiveGroups).flatMap(eg => eg.options),
    ];

    if (selectedSubjects && Array.isArray(selectedSubjects)) {
      allCourses = allCourses.filter(c => selectedSubjects.includes(c.courseCode));
    }

    console.log('[Generate] Courses to schedule:', allCourses.length);
    console.log('[Generate] Teachers:', teachers.map(t => ({ id: t.id, name: t.name, courseCode: t.courseCode })));
    console.log('[Generate] Rooms:', rooms.map(r => ({ id: r.id, name: r.name, type: r.type })));

    const state = new ScheduleState();
    if (sharedState) {
      Object.assign(state.teacherBusy, sharedState.teacherBusy || {});
      Object.assign(state.roomBusy, sharedState.roomBusy || {});
      Object.assign(state.sectionBusy, sharedState.sectionBusy || {});
    }

    const result = new TimetableScheduler(state, section, allCourses, teachers, rooms, electiveChoices || {}).generate();

    console.log('[Generate] Result:', {
      scheduled: Object.values(result.schedule).flatMap(day => Object.values(day)).filter(Boolean).length,
      unscheduled: result.unscheduled.length,
      warnings: result.warnings.length
    });

    // Split schedule into G1 and G2 (both groups get the same schedule for now)
    const scheduleG1 = {};
    const scheduleG2 = {};

    for (const day of DAYS) {
      scheduleG1[day] = {};
      scheduleG2[day] = {};
      for (const slot of ALL_SLOTS) {
        const entry = result.schedule[day]?.[slot.index];
        if (entry) {
          scheduleG1[day][slot.index] = entry;
          scheduleG2[day][slot.index] = entry;
        }
      }
    }

    // ── AUTO-SAVE TO FIREBASE (Admin SDK syntax) ──
    try {
      const sanitizedSection = section.replace(/[\.\#\$\/\\[\]]/g, '_');
      const timetableId = `${program}_Y${year}_${sanitizedSection}`;

      const timetableData = {
        sectionKey: result.sectionKey,
        programName: prog.programName,
        schedule: result.schedule,
        scheduleG1,
        scheduleG2,
        grid: result.grid,
        unscheduled: result.unscheduled,
        warnings: result.warnings,
        meta: { program, programName: prog.programName, year: Number(year), section, semester: yd.semester },
        updatedAt: new Date().toISOString()
      };

      if (db) {
        await db.ref(`generated_timetables/${timetableId}`).set(timetableData);
        console.log(`[Route] Timetable saved to database: ${timetableId}`);
      } else {
        console.warn('[Route] Skipping auto-save: Firebase DB not initialized');
      }
    } catch (saveErr) {
      console.error('[Route] Failed to auto-save timetable:', saveErr.message);
    }

    res.json({
      success: true,
      sectionKey: result.sectionKey,
      programName: prog.programName,
      grid: result.grid,
      schedule: result.schedule,
      scheduleG1,
      scheduleG2,
      unscheduled: result.unscheduled,
      warnings: result.warnings,
      validation: validateSchedule(result.schedule, section),
      summary: summarizeSchedule(result.schedule),
      updatedState: { teacherBusy: state.teacherBusy, roomBusy: state.roomBusy, sectionBusy: state.sectionBusy },
      meta: { program, programName: prog.programName, year: Number(year), section, semester: yd.semester, days: DAYS, slots: ALL_SLOTS },
    });
  } catch (e) { console.error('[Generate]', e); res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY / VALIDATE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/summary', (req, res) => {
  try {
    const d = getD();
    res.json({
      success: true, meta: d.meta,
      programs: d.programList,
      electiveSummary: d.electiveSummary,
      totalElectiveBaskets: Object.keys(d.electiveBaskets).length,
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/validate', (req, res) => {
  try {
    const { schedule, sectionKey } = req.body;
    if (!schedule) return res.status(400).json({ error: 'schedule required' });
    res.json({ success: true, ...validateSchedule(schedule, sectionKey || 'unknown') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtCourse(c) {
  return {
    courseCode: c.courseCode, courseTitle: c.courseTitle,
    L: c.L, T: c.T, P: c.P,
    courseType: c.courseType, courseTypeLabel: c.courseTypeLabel,
    subjectType: c.subjectType,
    isElective: c.isElective, isLab: c.isLab, isProject: c.isProject,
    basketName: c.basketName,
    theorySlotsPerWeek: c.theorySlotsPerWeek, labBlocksPerWeek: c.labBlocksPerWeek,
    labPair: c.labPair || null, theoryPair: c.theoryPair || null,
  };
}

function fmtBasket(b) {
  return {
    basketName: b.basketName,
    label: b.label,
    courseType: b.courseType,
    courseTypeLabel: b.courseTypeLabel,
    programs: b.programs,
    years: b.years,
    optionCount: b.options.length,
    options: b.options.map(o => ({
      courseCode: o.courseCode, courseTitle: o.courseTitle,
      L: o.L, T: o.T, P: o.P,
      subjectType: o.subjectType, isLab: o.isLab,
      theorySlotsPerWeek: o.theorySlotsPerWeek,
      labBlocksPerWeek: o.labBlocksPerWeek,
    })),
  };
}

module.exports = router;
