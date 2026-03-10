/**
 * excelParser.js — Robust LPU Course Master Parser
 *
 * ELECTIVE ROW TYPES:
 *   TYPE A — Heading row:  CourseCode = null, BasketName = set  → basket slot marker
 *   TYPE B — Option row:   CourseCode = set,  BasketName = set  → actual course in basket
 *   TYPE C — Core row:     CourseCode = set,  BasketName = null → mandatory subject
 *
 * DEDUP RULE: Same CourseCode appears once per OfficialCode variant.
 *   e.g. CAP473 appears in P123, P123-Y, P123-L → stored only ONCE per basket.
 */
'use strict';
const XLSX = require('xlsx');

const ELECTIVE_TYPES = new Set(['SEC','GE','SP','DE','HC','PW']);
const PROJECT_TYPES  = new Set(['CR3A','CR3B']);

const TYPE_LABELS = {
  CR:'Core Required', CR1:'Core Required', CR2:'Core Required',
  CR3A:'Project/Seminar', CR3B:'Project/Seminar',
  LC:'Language/Communication', SEC:'Skill Enhancement',
  GE:'Generic Elective', SP:'Specialization Elective',
  DE:'Department Elective', HC:'Honours Core', PW:'Pathway/Project Work',
};

const PROG_NAMES = {
  P123:'BCA', P124:'MCA', P163:'BSc.IT', P164:'MSc.IT',
  P22A:'MCA (Lateral)', P16AJ:'MSc.IT (Lateral)',
  P1D4:'MCA (Direct)', P123A:'BCA (Honours)', P124A:'MCA (Honours)',
};

const COL_ALIASES = {
  OfficialCode:['officialcode','official_code','official code','programcode','program code'],
  pYear:       ['pyear','year','p_year','academic year','academicyear'],
  pTerm:       ['pterm','term','semester','p_term'],
  CourseCode:  ['coursecode','course_code','course code','code','subjectcode'],
  CourseTitle: ['coursetitle','course_title','course title','title','subjectname','subject name'],
  L:           ['l','lecture','lectures','lecture hrs','lhrs'],
  T:           ['t','tutorial','tutorials','tutorial hrs','thrs'],
  P:           ['p','practical','practicals','lab','practical hrs','phrs'],
  CourseType:  ['coursetype','course_type','course type','type','category'],
  BasketName:  ['basketname','basket_name','basket name','basket','electivebasket','elective basket'],
};

function getBase(code) {
  if (!code) return null;
  if (/^P\d{3}[A-Z]$/.test(code)) return code;
  return code.split('-')[0];
}

function getProgName(code) {
  const b = getBase(code);
  return PROG_NAMES[b] || PROG_NAMES[code] || code;
}

function subjectType(L, T, P, ct) {
  if (PROJECT_TYPES.has(ct) && P >= 4) return 'PROJECT';
  if (P >= 8) return 'PROJECT';
  if (L > 0 && P > 0) return 'THEORY_LAB';
  if (L === 0 && P > 0) return 'LAB';
  return 'THEORY';
}

function cellStr(sheet, r, c) {
  if (c == null) return null;
  const cell = sheet[XLSX.utils.encode_cell({r, c})];
  if (!cell || cell.v == null || cell.v === '') return null;
  return String(cell.v).trim();
}

function cellNum(sheet, r, c) {
  if (c == null) return 0;
  const cell = sheet[XLSX.utils.encode_cell({r, c})];
  if (!cell || cell.v == null) return 0;
  const n = parseFloat(cell.v);
  return isNaN(n) ? 0 : n;
}

function detectColumns(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:J200');
  for (let r = range.s.r; r <= Math.min(range.s.r + 8, range.e.r); r++) {
    const map = {};
    let hits = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({r, c})];
      if (!cell || !cell.v) continue;
      const raw = String(cell.v).trim().toLowerCase().replace(/[^a-z0-9 _]/g, '');
      for (const [field, aliases] of Object.entries(COL_ALIASES)) {
        if (map[field] !== undefined) continue;
        if (aliases.some(a => raw === a || raw.includes(a))) { map[field] = c; hits++; break; }
      }
    }
    if (hits >= 4 && map.OfficialCode != null && map.CourseTitle != null) {
      return { headerRow: r, colMap: map };
    }
  }
  throw new Error('Cannot detect header row. Excel must have: OfficialCode, CourseTitle, L, T, P, CourseType columns.');
}

function makeCourse({ courseCode, courseTitle, year, term, L, T, P, courseType, basketName, baseCode, officialCode }) {
  const st = subjectType(L, T, P, courseType);
  const theorySlotsPerWeek = (st === 'THEORY' || st === 'THEORY_LAB') ? (L + T) : 0;
  const labBlocksPerWeek   = (st === 'LAB'    || st === 'THEORY_LAB') ? Math.max(1, Math.ceil(P / 2)) : 0;
  return {
    courseCode, courseTitle,
    year, term, semester: (year - 1) * 2 + term,
    L, T, P,
    courseType, courseTypeLabel: TYPE_LABELS[courseType] || courseType,
    subjectType: st,
    isElective:  ELECTIVE_TYPES.has(courseType) || !!basketName,
    isLab:       st === 'LAB' || st === 'THEORY_LAB',
    isProject:   st === 'PROJECT',
    basketName:  basketName || null,
    programCode: baseCode, officialCode,
    theorySlotsPerWeek, labBlocksPerWeek,
    labPair: null, theoryPair: null,
  };
}

function detectLabPairs(courses) {
  const labs   = courses.filter(c => c.subjectType === 'LAB');
  const theory = courses.filter(c => c.subjectType === 'THEORY');
  for (const lab of labs) {
    const labBase = lab.courseTitle.replace(/[-–\s]+(LABORATORY|LAB|PRACTICAL|WORKSHOP).*$/i,'').trim().toLowerCase();
    const match = theory.find(t => t.courseTitle.toLowerCase().startsWith(labBase.substring(0, Math.min(labBase.length, 18))));
    if (match) { lab.theoryPair = match.courseCode; match.labPair = lab.courseCode; }
  }
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
function parseCourseMaster(filePathOrBuffer) {
  const wb = typeof filePathOrBuffer === 'string'
    ? XLSX.readFile(filePathOrBuffer)
    : XLSX.read(filePathOrBuffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error('Excel has no sheets.');

  const { headerRow, colMap } = detectColumns(sheet);
  const range = XLSX.utils.decode_range(sheet['!ref']);

  const programs        = {};
  const electiveBaskets = {};   // basketName → full basket object
  const basketSeen      = {};   // basketName → Set<courseCode>  (dedup)

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const officialCode = cellStr(sheet, r, colMap.OfficialCode);
    if (!officialCode) continue;

    const courseCode  = cellStr(sheet, r, colMap.CourseCode);
    const courseTitle = cellStr(sheet, r, colMap.CourseTitle);
    const year        = cellNum(sheet, r, colMap.pYear)  || 1;
    const term        = cellNum(sheet, r, colMap.pTerm)  || 1;
    const L           = cellNum(sheet, r, colMap.L);
    const T           = cellNum(sheet, r, colMap.T);
    const P           = cellNum(sheet, r, colMap.P);
    const courseType  = cellStr(sheet, r, colMap.CourseType) || 'CR';
    const basketName  = cellStr(sheet, r, colMap.BasketName);
    const baseCode    = getBase(officialCode);

    // ── Init program ─────────────────────────────────────────────────────
    if (!programs[baseCode]) {
      programs[baseCode] = {
        baseCode, programName: getProgName(officialCode),
        officialCodes: new Set(), yearData: {},
      };
    }
    const prog = programs[baseCode];
    prog.officialCodes.add(officialCode);

    // ── Init year ────────────────────────────────────────────────────────
    if (!prog.yearData[year]) {
      prog.yearData[year] = {
        year, term, semester: (year - 1) * 2 + term,
        coreCourses: [], electiveGroups: {}, projectCourses: [],
        labCourses: [], theoryCourses: [],
      };
    }
    const yd = prog.yearData[year];

    // ── Helper: ensure basket exists in both stores ───────────────────────
    const ensureBasket = (bn, title, ct) => {
      if (!electiveBaskets[bn]) {
        electiveBaskets[bn] = {
          basketName: bn, label: title || bn, courseType: ct,
          courseTypeLabel: TYPE_LABELS[ct] || ct,
          programs: new Set(), years: new Set(), options: [],
        };
        basketSeen[bn] = new Set();
      }
      electiveBaskets[bn].programs.add(baseCode);
      electiveBaskets[bn].years.add(year);
      if (!yd.electiveGroups[bn]) {
        yd.electiveGroups[bn] = {
          basketName: bn, label: title || bn, courseType: ct,
          courseTypeLabel: TYPE_LABELS[ct] || ct, options: [],
        };
      }
    };

    // ── TYPE A: heading row (no CourseCode, has BasketName) ───────────────
    if (!courseCode && basketName) {
      ensureBasket(basketName, courseTitle, courseType);
      // Update label from heading row (the authoritative title)
      electiveBaskets[basketName].label = courseTitle || basketName;
      yd.electiveGroups[basketName].label = courseTitle || basketName;
      continue;
    }

    // ── TYPE B: option row (has CourseCode + BasketName) ──────────────────
    if (courseCode && basketName) {
      ensureBasket(basketName, null, courseType);
      const course = makeCourse({ courseCode, courseTitle, year, term, L, T, P, courseType, basketName, baseCode, officialCode });

      // Global basket — dedup by courseCode across all OfficialCode variants
      if (!basketSeen[basketName].has(courseCode)) {
        basketSeen[basketName].add(courseCode);
        electiveBaskets[basketName].options.push(course);
      }
      // Per-year group — dedup too
      if (!yd.electiveGroups[basketName].options.find(o => o.courseCode === courseCode)) {
        yd.electiveGroups[basketName].options.push(course);
      }
      continue;
    }

    // ── TYPE C: core row (has CourseCode, no BasketName) ──────────────────
    if (courseCode && !basketName) {
      const course = makeCourse({ courseCode, courseTitle, year, term, L, T, P, courseType, basketName: null, baseCode, officialCode });
      if (course.isProject) {
        if (!yd.projectCourses.find(c => c.courseCode === courseCode)) yd.projectCourses.push(course);
      } else {
        if (!yd.coreCourses.find(c => c.courseCode === courseCode)) yd.coreCourses.push(course);
      }
    }
  }

  // ── Post-process ──────────────────────────────────────────────────────────
  for (const prog of Object.values(programs)) {
    prog.officialCodes = [...prog.officialCodes];
    for (const yd of Object.values(prog.yearData)) {
      detectLabPairs(yd.coreCourses);
      yd.labCourses    = yd.coreCourses.filter(c => c.subjectType === 'LAB' || c.subjectType === 'THEORY_LAB');
      yd.theoryCourses = yd.coreCourses.filter(c => c.subjectType === 'THEORY' || c.subjectType === 'THEORY_LAB');
    }
  }

  // Serialize Sets
  for (const b of Object.values(electiveBaskets)) {
    b.programs = [...b.programs];
    b.years    = [...b.years].sort();
  }

  // ── electiveSummary — grouped by courseType for the Electives page ─────
  const typeGroups = {};
  for (const basket of Object.values(electiveBaskets)) {
    const ct = basket.courseType;
    if (!typeGroups[ct]) typeGroups[ct] = { courseType: ct, courseTypeLabel: TYPE_LABELS[ct] || ct, baskets: [], totalOptions: 0 };
    typeGroups[ct].baskets.push({
      basketName:  basket.basketName,
      label:       basket.label,
      programs:    basket.programs,
      years:       basket.years,
      optionCount: basket.options.length,
      options:     basket.options.map(o => ({
        courseCode: o.courseCode, courseTitle: o.courseTitle,
        L: o.L, T: o.T, P: o.P,
        subjectType: o.subjectType, isLab: o.isLab,
        theorySlotsPerWeek: o.theorySlotsPerWeek,
        labBlocksPerWeek:   o.labBlocksPerWeek,
      })),
    });
    typeGroups[ct].totalOptions += basket.options.length;
  }
  const electiveSummary = Object.values(typeGroups).sort((a,b) => a.courseType.localeCompare(b.courseType));

  const programList = Object.values(programs).map(prog => ({
    baseCode: prog.baseCode, programName: prog.programName,
    officialCodes: prog.officialCodes,
    years: Object.keys(prog.yearData).map(Number).sort(),
    yearSummary: Object.fromEntries(Object.entries(prog.yearData).map(([yr, yd]) => [yr, {
      semester: yd.semester, coreCount: yd.coreCourses.length,
      electiveGroups: Object.keys(yd.electiveGroups).length,
      labCount: yd.labCourses.length, projectCount: yd.projectCourses.length,
    }])),
  }));

  const totalCourses = Object.values(programs)
    .flatMap(p => Object.values(p.yearData)).flatMap(yd => yd.coreCourses).length;

  return {
    programs, programList, electiveBaskets, electiveSummary,
    meta: {
      totalPrograms: Object.keys(programs).length,
      totalCourses,
      totalBaskets:  Object.keys(electiveBaskets).length,
      sheetName, detectedColumns: Object.keys(colMap), headerRow: headerRow + 1,
    },
  };
}

module.exports = { parseCourseMaster, getBase, getProgName, subjectType, TYPE_LABELS, ELECTIVE_TYPES };
