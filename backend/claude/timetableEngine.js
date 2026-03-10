/**
 * timetableEngine.js
 * Core constraint-satisfaction timetable generator for LPU School of Computer Applications.
 *
 * SCHEDULING RULES:
 * 1. Working days: Mon–Sat (6 days)
 * 2. Time slots per day: 8 slots (8AM–9AM, 9–10, 10–11, 11–12, 12–1, 2–3, 3–4, 4–5)
 *    Slot 5 (1–2 PM) = LUNCH BREAK, never scheduled
 * 3. Theory subjects: 1-hour slots, scheduled L times per week
 * 4. Tutorial: combined with lecture or separate 1-hour slot
 * 5. Lab subjects: 2-CONSECUTIVE-hour block, P/2 times per week
 * 6. THEORY_LAB subjects: separate theory slots (L per week) + lab block (P/2 per week)
 * 7. Same subject NOT on consecutive days for theory (spread across week)
 * 8. No teacher clash: a teacher can't be in 2 rooms at same time
 * 9. No room clash: a room can't have 2 classes at same time
 * 10. No section clash: a section can't have 2 subjects at same time
 * 11. Electives: all options in a basket scheduled at SAME time slot (parallel)
 * 12. Lab rooms: separate from theory rooms, capacity-checked
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_IDX = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5 };

// Slot indices 0–7, slot 4 = lunch (12:00–13:00 = break? Actually LPU lunch is 1-2PM = slot 5)
// Slots: 0=8-9, 1=9-10, 2=10-11, 3=11-12, 4=12-1, 5=LUNCH(1-2), 6=2-3, 7=3-4, 8=4-5
const SLOTS = [
  { index: 0, label: '8:00 - 9:00' },
  { index: 1, label: '9:00 - 10:00' },
  { index: 2, label: '10:00 - 11:00' },
  { index: 3, label: '11:00 - 12:00' },
  { index: 4, label: '12:00 - 1:00' },
  // index 5 = LUNCH BREAK, skipped
  { index: 6, label: '2:00 - 3:00' },
  { index: 7, label: '3:00 - 4:00' },
  { index: 8, label: '4:00 - 5:00' },
];
const LUNCH_SLOT = 5;
const VALID_SLOTS = SLOTS.map((s) => s.index); // [0,1,2,3,4,6,7,8]

/**
 * Generates a weekly timetable for one section.
 *
 * @param {Object} params
 * @param {string} params.programCode   - e.g. 'P123'
 * @param {number} params.year          - academic year (1, 2, 3)
 * @param {string} params.section       - e.g. 'A', 'B'
 * @param {Array}  params.courses       - array of course objects from excelReader
 * @param {Array}  params.teachers      - [{ id, name, courseCode, maxHoursPerWeek }]
 * @param {Array}  params.rooms         - [{ id, name, type: 'THEORY'|'LAB', capacity }]
 * @param {Object} params.electiveChoices - { basketName: courseCode } chosen elective per basket
 * @param {Object} params.globalState   - shared state for teacher/room clash detection across sections
 * @returns {Object} { schedule, unscheduled, warnings }
 */
function generateTimetable({ programCode, year, section, courses, teachers, rooms, electiveChoices, globalState }) {
  // ── State ────────────────────────────────────────────────────────────────
  // schedule[day][slot] = { courseCode, courseTitle, teacher, room, type }
  const schedule = {};
  for (const day of DAYS) {
    schedule[day] = {};
    for (const slot of VALID_SLOTS) {
      schedule[day][slot] = null;
    }
  }

  const unscheduled = [];
  const warnings = [];

  // ── Section key for global clash tracking ────────────────────────────────
  const sectionKey = `${programCode}-Y${year}-${section}`;

  if (!globalState.teacherBusy) globalState.teacherBusy = {};
  if (!globalState.roomBusy) globalState.roomBusy = {};
  if (!globalState.sectionBusy) globalState.sectionBusy = {};

  globalState.sectionBusy[sectionKey] = globalState.sectionBusy[sectionKey] || {};

  // ── Helpers ──────────────────────────────────────────────────────────────
  const isSlotFree = (day, slot) => {
    return (
      !schedule[day][slot] &&
      !globalState.sectionBusy[sectionKey][`${day}-${slot}`]
    );
  };

  const isTeacherFree = (teacherId, day, slot) => {
    if (!teacherId) return true;
    return !globalState.teacherBusy[`${teacherId}-${day}-${slot}`];
  };

  const isRoomFree = (roomId, day, slot) => {
    if (!roomId) return true;
    return !globalState.roomBusy[`${roomId}-${day}-${slot}`];
  };

  const markBusy = (teacherId, roomId, day, slot, entry) => {
    schedule[day][slot] = entry;
    globalState.sectionBusy[sectionKey][`${day}-${slot}`] = true;
    if (teacherId) globalState.teacherBusy[`${teacherId}-${day}-${slot}`] = sectionKey;
    if (roomId) globalState.roomBusy[`${roomId}-${day}-${slot}`] = sectionKey;
  };

  // ── Find best teacher for course ─────────────────────────────────────────
  const getTeacher = (courseCode) => {
    return teachers.find((t) => t.courseCode === courseCode) || null;
  };

  // ── Find best room ───────────────────────────────────────────────────────
  const getRoom = (type, day, slot, slot2 = null) => {
    const candidates = rooms.filter((r) => r.type === type);
    return candidates.find((r) => {
      const free1 = isRoomFree(r.id, day, slot);
      const free2 = slot2 !== null ? isRoomFree(r.id, day, slot2) : true;
      return free1 && free2;
    }) || null;
  };

  // ── Schedule a THEORY subject (L slots across week, spread out) ───────────
  const scheduleTheory = (course, teacher) => {
    const needed = course.lectureSlots || course.L || 0;
    const addTutorial = (course.tutorialSlots || course.T || 0) > 0;
    const totalSlots = needed + (addTutorial ? Math.min(course.T, 1) : 0);

    let scheduled = 0;
    const usedDays = new Set();

    // Spread: prefer non-consecutive days
    const dayOrder = spreadDays(totalSlots);

    for (const day of dayOrder) {
      if (scheduled >= totalSlots) break;
      if (usedDays.has(day) && totalSlots <= DAYS.length) continue; // prefer 1 slot/day/subject

      for (const slot of VALID_SLOTS) {
        if (scheduled >= totalSlots) break;
        if (!isSlotFree(day, slot)) continue;

        const teacherId = teacher ? teacher.id : null;
        if (!isTeacherFree(teacherId, day, slot)) continue;

        const room = getRoom('THEORY', day, slot);
        if (!room) {
          warnings.push(`No theory room for ${course.courseCode} on ${day} slot ${slot}`);
          continue;
        }

        const entry = buildEntry(course, teacher, room, 'THEORY');
        markBusy(teacherId, room.id, day, slot, entry);
        usedDays.add(day);
        scheduled++;
        break;
      }
    }

    if (scheduled < totalSlots) {
      unscheduled.push({ ...course, reason: `Only ${scheduled}/${totalSlots} theory slots placed` });
    }
  };

  // ── Schedule a LAB subject (2-consecutive-hour block) ────────────────────
  const scheduleLab = (course, teacher) => {
    const labBlocks = Math.max(1, Math.floor((course.P || 0) / 2)); // P=2 → 1 block, P=4 → 2 blocks

    let scheduled = 0;
    const usedDays = new Set();

    for (const day of DAYS) {
      if (scheduled >= labBlocks) break;
      if (usedDays.has(day)) continue;

      // Find 2 consecutive free slots
      for (let i = 0; i < VALID_SLOTS.length - 1; i++) {
        const slot1 = VALID_SLOTS[i];
        const slot2 = VALID_SLOTS[i + 1];

        // Must be truly consecutive (no lunch between them)
        if (slot2 - slot1 !== 1) continue;
        if (slot1 === LUNCH_SLOT || slot2 === LUNCH_SLOT) continue;

        if (!isSlotFree(day, slot1) || !isSlotFree(day, slot2)) continue;

        const teacherId = teacher ? teacher.id : null;
        if (!isTeacherFree(teacherId, day, slot1) || !isTeacherFree(teacherId, day, slot2)) continue;

        const room = getRoom('LAB', day, slot1, slot2);
        if (!room) {
          warnings.push(`No lab room for ${course.courseCode} on ${day}`);
          continue;
        }

        const entry1 = buildEntry(course, teacher, room, 'LAB', '(Part 1/2)');
        const entry2 = buildEntry(course, teacher, room, 'LAB', '(Part 2/2)');
        markBusy(teacherId, room.id, day, slot1, entry1);
        markBusy(teacherId, room.id, day, slot2, entry2);
        usedDays.add(day);
        scheduled++;
        break;
      }
    }

    if (scheduled < labBlocks) {
      unscheduled.push({ ...course, reason: `Only ${scheduled}/${labBlocks} lab blocks placed` });
    }
  };

  // ── Process each course ──────────────────────────────────────────────────
  // Build effective course list (apply elective choices)
  const effectiveCourses = buildEffectiveCourses(courses, electiveChoices);

  // Sort: schedule labs first (harder to place, 2-consecutive constraint)
  const labCourses = effectiveCourses.filter((c) => c.subjectType === 'LAB');
  const theoryLabCourses = effectiveCourses.filter((c) => c.subjectType === 'THEORY_LAB');
  const theoryCourses = effectiveCourses.filter(
    (c) => c.subjectType === 'THEORY' || c.subjectType === 'TUTORIAL' || c.subjectType === 'LANGUAGE'
  );
  const projectCourses = effectiveCourses.filter((c) => c.subjectType === 'PROJECT');

  // Schedule in priority order
  for (const course of labCourses) {
    const teacher = getTeacher(course.courseCode);
    scheduleLab(course, teacher);
  }

  for (const course of theoryLabCourses) {
    const teacher = getTeacher(course.courseCode);
    // Theory part
    const theoryCourse = { ...course, subjectType: 'THEORY', L: course.L, P: 0 };
    scheduleTheory(theoryCourse, teacher);
    // Lab part
    scheduleLab(course, teacher);
  }

  for (const course of theoryCourses) {
    const teacher = getTeacher(course.courseCode);
    scheduleTheory(course, teacher);
  }

  for (const course of projectCourses) {
    warnings.push(`${course.courseCode} (${course.courseTitle}) is a project/seminar – needs manual scheduling`);
  }

  return {
    sectionKey,
    schedule,
    unscheduled,
    warnings,
    slotInfo: SLOTS,
    days: DAYS,
  };
}

// ─── Helper: build a schedule entry ──────────────────────────────────────────
function buildEntry(course, teacher, room, type, note = '') {
  return {
    courseCode: course.courseCode,
    courseTitle: course.courseTitle,
    type,                          // 'THEORY' | 'LAB'
    category: course.category,
    courseType: course.courseType,
    isElective: course.isElective || false,
    basketName: course.basketName || null,
    teacher: teacher ? { id: teacher.id, name: teacher.name } : null,
    room: room ? { id: room.id, name: room.name, type: room.type } : null,
    note,
  };
}

// ─── Helper: build effective course list after elective selection ─────────────
function buildEffectiveCourses(courses, electiveChoices) {
  const result = [];
  const seenBaskets = new Set();

  for (const course of courses) {
    if (!course.isElective) {
      result.push(course);
      continue;
    }

    const bn = course.basketName;
    if (seenBaskets.has(bn)) continue;
    seenBaskets.add(bn);

    // Use chosen elective if provided, else first option
    const chosenCode = electiveChoices && electiveChoices[bn];
    if (chosenCode) {
      const chosen = courses.find((c) => c.basketName === bn && c.courseCode === chosenCode);
      if (chosen) result.push(chosen);
    } else {
      // No choice yet – add placeholder
      result.push({ ...course, courseTitle: `[ELECTIVE: ${course.basketName}]` });
    }
  }
  return result;
}

// ─── Helper: spread N slots across 6 days evenly ─────────────────────────────
function spreadDays(n) {
  const spread = [];
  const step = Math.max(1, Math.floor(DAYS.length / n));
  for (let i = 0; i < n; i++) {
    spread.push(DAYS[(i * step) % DAYS.length]);
  }
  // Fill remaining with any days
  const all = [...DAYS, ...DAYS, ...DAYS];
  while (spread.length < n) spread.push(all[spread.length]);
  return spread;
}

/**
 * Validates a complete timetable for clashes and missing subjects.
 * @param {Object} schedule - output from generateTimetable
 * @returns {Object} { valid, clashes, missing }
 */
function validateTimetable(schedule) {
  const clashes = [];
  const missing = [];

  // Check for double-booked slots
  for (const day of DAYS) {
    for (const slot of VALID_SLOTS) {
      const entry = schedule[day] && schedule[day][slot];
      if (entry && Array.isArray(entry)) {
        clashes.push({ day, slot, entries: entry, reason: 'Multiple classes in same slot' });
      }
    }
  }

  return {
    valid: clashes.length === 0 && missing.length === 0,
    clashes,
    missing,
  };
}

/**
 * Formats schedule as a grid (days × slots) for rendering.
 * @param {Object} schedule - raw schedule object
 * @returns {Array} grid rows
 */
function formatScheduleGrid(schedule) {
  return SLOTS.map((slotInfo) => {
    const row = { slot: slotInfo.label, slotIndex: slotInfo.index };
    for (const day of DAYS) {
      row[day] = schedule[day] ? schedule[day][slotInfo.index] : null;
    }
    return row;
  });
}

module.exports = {
  generateTimetable,
  validateTimetable,
  formatScheduleGrid,
  DAYS,
  SLOTS,
  VALID_SLOTS,
};
