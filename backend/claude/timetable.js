/**
 * routes/timetable.js
 * REST API endpoints for the LPU timetable generation system.
 *
 * BASE URL: /api/timetable
 *
 * ENDPOINTS:
 *   GET  /programs              → List all programs (BCA, MCA, BSc.IT, MSc.IT...)
 *   GET  /programs/:code/years  → List years for a program
 *   GET  /courses               → Get courses for program+year (with elective structure)
 *   POST /generate              → Generate timetable for a section
 *   GET  /electives/:basketName → Get elective options for a basket
 *   POST /validate              → Validate a generated timetable
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { readCourseMaster } = require('../src/excelReader');
const { generateTimetable, validateTimetable, formatScheduleGrid, DAYS, SLOTS } = require('../src/timetableEngine');

// ── Load course master once at startup ───────────────────────────────────────
let courseMasterData = null;

function getCourseMaster() {
  if (!courseMasterData) {
    const excelPath = path.resolve(__dirname, '..', 'Course Master 25261 updated.xlsx');
    try {
      courseMasterData = readCourseMaster(excelPath);
      console.log('[CourseMaster] Loaded successfully. Programs:', Object.keys(courseMasterData.timetableInput));
    } catch (err) {
      console.error('[CourseMaster] Failed to load:', err.message);
      throw err;
    }
  }
  return courseMasterData;
}

// ── Reload endpoint (dev use) ────────────────────────────────────────────────
router.post('/reload', (req, res) => {
  courseMasterData = null;
  try {
    const data = getCourseMaster();
    res.json({ success: true, programs: data.programList.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /programs
// Returns list of all programs for the dropdown
// ─────────────────────────────────────────────────────────────────────────────
router.get('/programs', (req, res) => {
  try {
    const data = getCourseMaster();
    res.json({
      success: true,
      programs: data.programList,
      // e.g. [{ officialCode: 'P123', programName: 'BCA', years: [1,2,3] }, ...]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /programs/:code/years
// Returns years and semester info for a program
// ─────────────────────────────────────────────────────────────────────────────
router.get('/programs/:code/years', (req, res) => {
  try {
    const data = getCourseMaster();
    const { code } = req.params;
    const prog = data.timetableInput[code];
    if (!prog) return res.status(404).json({ error: `Program ${code} not found` });

    const years = Object.keys(prog.yearData).map(Number).sort();
    res.json({
      success: true,
      programCode: code,
      programName: prog.programName,
      years: years.map((y) => ({
        year: y,
        semester: (y - 1) * 2 + 1,
        label: `Year ${y} (Semester ${(y - 1) * 2 + 1})`,
        courseSummary: {
          core: prog.yearData[y].coreCourses.length,
          electives: Object.keys(prog.yearData[y].electiveGroups).length,
          labs: prog.yearData[y].labCourses.length,
          projects: prog.yearData[y].projectCourses.length,
        },
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /courses?program=P123&year=1
// Returns full course list for program+year including elective baskets
// ─────────────────────────────────────────────────────────────────────────────
router.get('/courses', (req, res) => {
  try {
    const data = getCourseMaster();
    const { program, year } = req.query;

    if (!program || !year) {
      return res.status(400).json({ error: 'program and year are required' });
    }

    const prog = data.timetableInput[program];
    if (!prog) return res.status(404).json({ error: `Program ${program} not found` });

    const yd = prog.yearData[Number(year)];
    if (!yd) return res.status(404).json({ error: `Year ${year} not found for ${program}` });

    // Format elective groups nicely
    const electiveGroups = Object.entries(yd.electiveGroups).map(([bn, eg]) => ({
      basketName: bn,
      category: eg.basket.category,
      courseType: eg.basket.courseType,
      title: eg.basket.title,
      options: eg.options.map((o) => ({
        courseCode: o.courseCode,
        courseTitle: o.courseTitle,
        L: o.L, T: o.T, P: o.P,
        subjectType: o.subjectType,
        isLab: o.isLab,
        weeklyHours: o.theoryHours + (o.labHours || 0),
      })),
    }));

    res.json({
      success: true,
      program,
      programName: prog.programName,
      year: Number(year),
      courses: {
        core: yd.coreCourses.map(formatCourse),
        labs: yd.labCourses.map(formatCourse),
        theory: yd.theoryCourses.map(formatCourse),
        electives: electiveGroups,
        projects: yd.projectCourses.map(formatCourse),
      },
      totalWeeklyHours: calcTotalHours(yd),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /electives/:basketName
// Returns all options for an elective basket
// ─────────────────────────────────────────────────────────────────────────────
router.get('/electives/:basketName', (req, res) => {
  try {
    const data = getCourseMaster();
    const basket = data.electiveBaskets[req.params.basketName];
    if (!basket) return res.status(404).json({ error: 'Basket not found' });
    res.json({ success: true, basket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /generate
// Generates a timetable for one section
//
// Body:
// {
//   program: 'P123',
//   year: 1,
//   section: 'A',
//   teachers: [
//     { id: 't1', name: 'Dr. Sharma', courseCode: 'CAP172' },
//     { id: 't2', name: 'Dr. Singh', courseCode: 'MTH136' },
//     ...
//   ],
//   rooms: [
//     { id: 'r1', name: 'Room 101', type: 'THEORY', capacity: 60 },
//     { id: 'lab1', name: 'CS Lab 1', type: 'LAB', capacity: 30 },
//     ...
//   ],
//   electiveChoices: {
//     'P123-5-2023-ME2': 'CAP473',   // chosen elective code per basket
//     'P123-5-2023-SEC3': 'CAP460',
//   },
//   globalState: {}   // pass the same object across multiple section calls to detect clashes
// }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate', (req, res) => {
  try {
    const data = getCourseMaster();
    const { program, year, section, teachers, rooms, electiveChoices, globalState } = req.body;

    if (!program || !year || !section) {
      return res.status(400).json({ error: 'program, year, and section are required' });
    }
    if (!teachers || !Array.isArray(teachers)) {
      return res.status(400).json({ error: 'teachers array is required' });
    }
    if (!rooms || !Array.isArray(rooms)) {
      return res.status(400).json({ error: 'rooms array is required' });
    }

    const prog = data.timetableInput[program];
    if (!prog) return res.status(404).json({ error: `Program ${program} not found` });

    const yd = prog.yearData[Number(year)];
    if (!yd) return res.status(404).json({ error: `Year ${year} not found` });

    // Flatten all courses for this year
    const allCourses = [
      ...yd.coreCourses,
      ...Object.values(yd.electiveGroups).flatMap((eg) => eg.options),
    ];

    const state = globalState || {};

    const result = generateTimetable({
      programCode: program,
      year: Number(year),
      section,
      courses: allCourses,
      teachers,
      rooms,
      electiveChoices: electiveChoices || {},
      globalState: state,
    });

    // Format as grid for display
    const grid = formatScheduleGrid(result.schedule);

    res.json({
      success: true,
      sectionKey: result.sectionKey,
      grid,
      schedule: result.schedule,
      unscheduled: result.unscheduled,
      warnings: result.warnings,
      meta: {
        program,
        programName: prog.programName,
        year: Number(year),
        section,
        days: DAYS,
        slots: SLOTS,
      },
    });
  } catch (err) {
    console.error('[Generate Error]', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /validate
// Validates a timetable for conflicts
// ─────────────────────────────────────────────────────────────────────────────
router.post('/validate', (req, res) => {
  try {
    const { schedule } = req.body;
    if (!schedule) return res.status(400).json({ error: 'schedule is required' });
    const result = validateTimetable(schedule);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatCourse(c) {
  return {
    courseCode: c.courseCode,
    courseTitle: c.courseTitle,
    L: c.L, T: c.T, P: c.P,
    courseType: c.courseType,
    category: c.category,
    subjectType: c.subjectType,
    isLab: c.isLab,
    isProject: c.isProject,
    theoryHours: c.theoryHours,
    labHours: c.labHours,
    basketName: c.basketName,
    isElective: c.isElective,
  };
}

function calcTotalHours(yd) {
  let theory = 0, lab = 0;
  for (const c of yd.coreCourses) {
    theory += c.theoryHours || 0;
    lab += c.labHours || 0;
  }
  return { theory, lab, total: theory + lab };
}

module.exports = router;
