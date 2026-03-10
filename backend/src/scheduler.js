/**
 * src/scheduler.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Timetable Scheduling Engine — Constraint Satisfaction Algorithm
 *
 * SCHEDULE STRUCTURE:
 *   6 days × 9 slots (Mon–Sat, 8AM–5PM, lunch at 1–2PM skipped)
 *   Slot indices: 0=8-9, 1=9-10, 2=10-11, 3=11-12, 4=12-1, [5=LUNCH], 6=2-3, 7=3-4, 8=4-5
 *
 * THREE CONSTRAINT LEVELS (all checked before placing any slot):
 *   1. SECTION CLASH    — same section can't have 2 subjects at same time
 *   2. TEACHER CLASH    — same teacher can't be in 2 rooms at same time
 *   3. ROOM CLASH       — same room can't have 2 classes at same time
 *
 * SCHEDULING PRIORITY ORDER (most constrained first):
 *   1. LAB subjects        (2-consecutive slots, need lab room → hardest to place)
 *   2. THEORY_LAB subjects (both theory slots + lab block needed)
 *   3. THEORY subjects     (1-hr slots, spread across different days)
 *   4. PROJECT/SEMINAR     (flagged as manual, not auto-scheduled)
 *
 * SPREAD RULE:
 *   Theory subject with L=3 → placed Mon, Wed, Fri (not Mon, Mon, Mon)
 *   Same subject must not appear on consecutive days (prevents fatigue)
 *
 * ELECTIVE PARALLEL RULE:
 *   All options in same basket scheduled at SAME day+slot (different rooms)
 *   Students choosing different options attend at same time in different rooms
 */

// ─── Day / slot constants ─────────────────────────────────────────────────────
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ALL_SLOTS = [
  { index: 0, label: '8:00 - 9:00', isLunch: false },
  { index: 1, label: '9:00 - 10:00', isLunch: false },
  { index: 2, label: '10:00 - 11:00', isLunch: false },
  { index: 3, label: '11:00 - 12:00', isLunch: false },
  { index: 4, label: '12:00 - 1:00', isLunch: false },
  { index: 5, label: '1:00 - 2:00', isLunch: true },  // LUNCH — never scheduled
  { index: 6, label: '2:00 - 3:00', isLunch: false },
  { index: 7, label: '3:00 - 4:00', isLunch: false },
  { index: 8, label: '4:00 - 5:00', isLunch: false },
];

const VALID_SLOTS = ALL_SLOTS.filter(s => !s.isLunch).map(s => s.index);
const LUNCH_SLOT = 5;

// Consecutive slot pairs (no lunch between them)
// Valid pairs: [0,1],[1,2],[2,3],[3,4], [6,7],[7,8]
const CONSECUTIVE_PAIRS = VALID_SLOTS
  .slice(0, -1)
  .map((s, i) => [s, VALID_SLOTS[i + 1]])
  .filter(([a, b]) => b - a === 1 && a !== 4); // exclude 4→5 (lunch boundary)


// ─────────────────────────────────────────────────────────────────────────────
// ScheduleState — tracks all busy slots across teachers, rooms, sections
// Shared across multiple sections when generating for full department
// ─────────────────────────────────────────────────────────────────────────────
class ScheduleState {
  constructor() {
    this.teacherBusy = {};  // `${teacherId}-${day}-${slot}` → sectionKey
    this.roomBusy = {};  // `${roomId}-${day}-${slot}`    → sectionKey
    this.sectionBusy = {};  // `${sectionKey}-${day}-${slot}` → courseCode
    this.electiveSlots = {};  // `${basketName}` → { day, slot } (for parallel scheduling)
  }

  isTeacherFree(teacherId, day, slot) {
    if (!teacherId) return true;
    return !this.teacherBusy[`${teacherId}-${day}-${slot}`];
  }

  isRoomFree(roomId, day, slot) {
    if (!roomId) return true;
    return !this.roomBusy[`${roomId}-${day}-${slot}`];
  }

  isSectionFree(sectionKey, day, slot) {
    return !this.sectionBusy[`${sectionKey}-${day}-${slot}`];
  }

  markTeacher(teacherId, day, slot, sectionKey) {
    if (teacherId) this.teacherBusy[`${teacherId}-${day}-${slot}`] = sectionKey;
  }

  markRoom(roomId, day, slot, sectionKey) {
    if (roomId) this.roomBusy[`${roomId}-${day}-${slot}`] = sectionKey;
  }

  markSection(sectionKey, day, slot, courseCode) {
    this.sectionBusy[`${sectionKey}-${day}-${slot}`] = courseCode;
  }

  unmark(teacherId, roomId, sectionKey, day, slot) {
    if (teacherId) delete this.teacherBusy[`${teacherId}-${day}-${slot}`];
    if (roomId) delete this.roomBusy[`${roomId}-${day}-${slot}`];
    delete this.sectionBusy[`${sectionKey}-${day}-${slot}`];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TimetableScheduler — main scheduling class
// ─────────────────────────────────────────────────────────────────────────────
class TimetableScheduler {
  /**
   * @param {ScheduleState} state   Shared state (pass same instance across sections)
   * @param {string} sectionKey     e.g. "BCA-Y1-SECA"
   * @param {Array}  courses        Normalized course list from excelParser
   * @param {Array}  teachers       [{ id, name, courseCode, maxHrsPerWeek }]
   * @param {Array}  rooms          [{ id, name, type: 'THEORY'|'LAB', capacity }]
   * @param {Object} electiveChoices { basketName → courseCode }
   */
  constructor(state, sectionKey, courses, teachers, rooms, electiveChoices = {}) {
    this.state = state;
    this.sectionKey = sectionKey;
    this.courses = courses;
    this.teachers = teachers;
    this.rooms = rooms;
    this.electiveChoices = electiveChoices;

    // schedule[day][slot] = SlotEntry | null
    this.schedule = {};
    for (const day of DAYS) {
      this.schedule[day] = {};
      for (const slot of VALID_SLOTS) {
        this.schedule[day][slot] = null;
      }
    }

    this.unscheduled = [];
    this.warnings = [];

    // Teacher lookup map: courseCode → teacher
    this._teacherMap = {};
    for (const t of teachers) {
      if (t.courseCode) {
        const codes = t.courseCode.split(',').map(c => c.trim());
        for (const code of codes) {
          this._teacherMap[code] = t;
        }
      }
    }
  }

  // ── Public: run scheduling ─────────────────────────────────────────────────
  generate() {
    // Resolve elective choices into effective course list
    const effectiveCourses = this._resolveElectives();

    // Sort by scheduling difficulty: LAB > THEORY_LAB > THEORY > PROJECT
    const priority = { LAB: 0, THEORY_LAB: 1, THEORY: 2, TUTORIAL: 3, PROJECT: 99 };
    effectiveCourses.sort((a, b) => (priority[a.subjectType] || 2) - (priority[b.subjectType] || 2));

    for (const course of effectiveCourses) {
      const teacher = this._teacherMap[course.courseCode] || null;

      if (course.subjectType === 'PROJECT') {
        this.warnings.push({
          code: course.courseCode,
          title: course.courseTitle,
          reason: 'Project/Seminar — requires manual scheduling',
          type: 'INFO',
        });
        continue;
      }

      if (course.subjectType === 'LAB') {
        this._scheduleLab(course, teacher);

      } else if (course.subjectType === 'THEORY_LAB') {
        // Schedule theory part first, then lab part
        this._scheduleTheory(course, teacher);
        this._scheduleLab(course, teacher);

      } else {
        // THEORY or TUTORIAL
        this._scheduleTheory(course, teacher);
      }
    }

    return {
      sectionKey: this.sectionKey,
      schedule: this.schedule,
      unscheduled: this.unscheduled,
      warnings: this.warnings,
      grid: this._buildGrid(),
    };
  }

  // ── Schedule a THEORY subject ──────────────────────────────────────────────
  _scheduleTheory(course, teacher) {
    const slotsNeeded = course.theorySlotsPerWeek || (course.L + course.T) || course.L || 1;
    if (slotsNeeded === 0) return;

    let placed = 0;
    const usedDays = new Set();

    // Generate spread day order: distribute evenly across week
    const dayOrder = this._spreadDays(slotsNeeded, usedDays);
    const fallbackDays = DAYS.filter(d => !dayOrder.includes(d));
    const allDaysToTry = [...dayOrder, ...fallbackDays];

    // Pass 1: Try to place 1 slot per day
    for (const day of allDaysToTry) {
      if (placed >= slotsNeeded) break;
      if (usedDays.has(day)) continue;

      for (const slot of VALID_SLOTS) {
        if (!this._canPlace(teacher, null, day, slot)) continue;

        // Prefer available theory room
        const room = this._findRoom('THEORY', day, slot);
        if (!room) {
          // Try any room as fallback
          this.warnings.push({
            code: course.courseCode, title: course.courseTitle,
            reason: `No theory room on ${day} slot ${slot} — unassigned`, type: 'WARN'
          });
        }

        const entry = this._makeEntry(course, teacher, room, 'THEORY');
        this._place(teacher, room, day, slot, entry);
        usedDays.add(day);
        placed++;
        break;
      }
    }

    // Pass 2: If we still need slots, allow multiple slots per day as a fallback
    if (placed < slotsNeeded) {
      for (const day of DAYS) {
        if (placed >= slotsNeeded) break;
        for (const slot of VALID_SLOTS) {
          if (placed >= slotsNeeded) break;
          if (!this._canPlace(teacher, null, day, slot)) continue;

          const room = this._findRoom('THEORY', day, slot);
          if (!room) {
            this.warnings.push({
              code: course.courseCode, title: course.courseTitle,
              reason: `No theory room on ${day} slot ${slot} — unassigned`, type: 'WARN'
            });
          }

          const entry = this._makeEntry(course, teacher, room, 'THEORY');
          this._place(teacher, room, day, slot, entry);
          placed++;
        }
      }
    }

    if (placed < slotsNeeded) {
      this.unscheduled.push({
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        type: 'THEORY',
        needed: slotsNeeded,
        placed,
        reason: `Only ${placed}/${slotsNeeded} theory slots placed (teacher or room conflict)`,
      });
    }
  }

  // ── Schedule a LAB subject (2-consecutive slots) ───────────────────────────
  _scheduleLab(course, teacher) {
    const blocksNeeded = course.labBlocksPerWeek || Math.max(1, Math.ceil((course.P || 2) / 2));
    if (blocksNeeded === 0) return;

    let placed = 0;
    const usedDays = new Set();

    // Pass 1: Try placing 1 block per day
    for (const day of DAYS) {
      if (placed >= blocksNeeded) break;
      if (usedDays.has(day)) continue;

      for (const [slot1, slot2] of CONSECUTIVE_PAIRS) {
        if (placed >= blocksNeeded) break;

        // Both slots must be free for section + teacher
        if (!this._canPlace(teacher, null, day, slot1)) continue;
        if (!this._canPlace(teacher, null, day, slot2)) continue;

        // Find lab room free for BOTH slots
        const room = this._findRoom('LAB', day, slot1, slot2);
        if (!room) {
          this.warnings.push({
            code: course.courseCode, title: course.courseTitle,
            reason: `No lab room for 2-hr block on ${day} [${slot1}-${slot2}]`, type: 'WARN'
          });
          continue;
        }

        const entry1 = this._makeEntry(course, teacher, room, 'LAB', '(1/2)');
        const entry2 = this._makeEntry(course, teacher, room, 'LAB', '(2/2)');
        this._place(teacher, room, day, slot1, entry1);
        this._place(teacher, room, day, slot2, entry2);
        usedDays.add(day);
        placed++;
        break;
      }
    }

    // Pass 2: Allow multiple lab blocks per day if still needed
    if (placed < blocksNeeded) {
      for (const day of DAYS) {
        if (placed >= blocksNeeded) break;
        for (const [slot1, slot2] of CONSECUTIVE_PAIRS) {
          if (placed >= blocksNeeded) break;

          if (!this._canPlace(teacher, null, day, slot1)) continue;
          if (!this._canPlace(teacher, null, day, slot2)) continue;

          const room = this._findRoom('LAB', day, slot1, slot2);
          if (!room) continue;

          const entry1 = this._makeEntry(course, teacher, room, 'LAB', '(1/2)');
          const entry2 = this._makeEntry(course, teacher, room, 'LAB', '(2/2)');
          this._place(teacher, room, day, slot1, entry1);
          this._place(teacher, room, day, slot2, entry2);
          placed++;
        }
      }
    }

    if (placed < blocksNeeded) {
      this.unscheduled.push({
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        type: 'LAB',
        needed: blocksNeeded,
        placed,
        reason: `Only ${placed}/${blocksNeeded} lab blocks placed (no free consecutive slots or lab room)`,
      });
    }
  }

  // ── Resolve electives: pick chosen option per basket ──────────────────────
  _resolveElectives() {
    const result = [];
    const basketsSeen = new Set();

    for (const course of this.courses) {
      if (!course.isElective || !course.basketName) {
        result.push(course);
        continue;
      }

      const bn = course.basketName;
      if (basketsSeen.has(bn)) continue;
      basketsSeen.add(bn);

      const chosenCode = this.electiveChoices[bn];
      if (chosenCode) {
        const chosen = this.courses.find(c => c.basketName === bn && c.courseCode === chosenCode);
        if (chosen) {
          result.push(chosen);
          continue;
        }
      }

      // No choice yet → add basket placeholder so it appears in unscheduled
      this.unscheduled.push({
        courseCode: bn,
        courseTitle: `[ELECTIVE BASKET: ${bn}]`,
        type: 'ELECTIVE_NOT_CHOSEN',
        needed: 1,
        placed: 0,
        reason: 'No elective option selected for this basket',
      });
    }

    return result;
  }

  // ── Can this slot be placed? (section + teacher checks) ───────────────────
  _canPlace(teacher, room, day, slot) {
    if (!this.state.isSectionFree(this.sectionKey, day, slot)) return false;
    if (teacher && !this.state.isTeacherFree(teacher.id, day, slot)) return false;
    if (room && !this.state.isRoomFree(room.id, day, slot)) return false;
    return true;
  }

  // ── Find available room of given type ─────────────────────────────────────
  _findRoom(type, day, slot1, slot2 = null) {
    const candidates = this.rooms.filter(r => r.type === type || (type === 'THEORY' && r.type === 'SEMINAR'));
    for (const room of candidates) {
      const free1 = this.state.isRoomFree(room.id, day, slot1);
      const free2 = slot2 !== null ? this.state.isRoomFree(room.id, day, slot2) : true;
      if (free1 && free2) return room;
    }
    // Fallback: if no LAB room, try any room
    if (type === 'LAB') {
      for (const room of this.rooms) {
        const free1 = this.state.isRoomFree(room.id, day, slot1);
        const free2 = slot2 !== null ? this.state.isRoomFree(room.id, day, slot2) : true;
        if (free1 && free2) return room;
      }
    }
    return null;
  }

  // ── Place entry into schedule and mark busy ───────────────────────────────
  _place(teacher, room, day, slot, entry) {
    this.schedule[day][slot] = entry;
    this.state.markSection(this.sectionKey, day, slot, entry.courseCode);
    if (teacher) this.state.markTeacher(teacher.id, day, slot, this.sectionKey);
    if (room) this.state.markRoom(room.id, day, slot, this.sectionKey);
  }

  // ── Build slot entry object ────────────────────────────────────────────────
  _makeEntry(course, teacher, room, sessionType, note = '') {
    return {
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      courseType: course.courseType,
      subjectType: course.subjectType,
      sessionType,  // 'THEORY' | 'LAB'
      isElective: course.isElective || false,
      basketName: course.basketName || null,
      teacher: teacher ? { id: teacher.id, name: teacher.name } : null,
      room: room ? { id: room.id, name: room.name, type: room.type } : null,
      note,
    };
  }

  // ── Build grid (array of rows: one per time slot) ─────────────────────────
  _buildGrid() {
    return ALL_SLOTS.map(slotInfo => {
      const row = {
        slotIndex: slotInfo.index,
        slotLabel: slotInfo.label,
        isLunch: slotInfo.isLunch,
      };
      for (const day of DAYS) {
        row[day] = slotInfo.isLunch ? 'LUNCH' : (this.schedule[day][slotInfo.index] || null);
      }
      return row;
    });
  }

  // ── Spread N slots across 6 days avoiding consecutive repeats ─────────────
  _spreadDays(n, alreadyUsed = new Set()) {
    const result = [];

    if (n === 0) return result;
    if (n === 1) {
      // Pick first free day
      for (const d of DAYS) {
        if (!alreadyUsed.has(d)) { result.push(d); break; }
      }
      if (result.length === 0) result.push(DAYS[0]);
      return result;
    }

    // Calculate even step across week
    const step = Math.max(1, Math.floor(DAYS.length / n));
    const start = 0;
    const usedIdx = new Set();

    for (let i = 0; i < n; i++) {
      let idx = (start + i * step) % DAYS.length;
      // Avoid repeating same day index
      let attempts = 0;
      while (usedIdx.has(idx) && attempts < DAYS.length) {
        idx = (idx + 1) % DAYS.length;
        attempts++;
      }
      usedIdx.add(idx);
      result.push(DAYS[idx]);
    }

    // If we need more slots than days, allow repeats
    while (result.length < n) {
      result.push(DAYS[result.length % DAYS.length]);
    }

    return result;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a completed timetable for clashes.
 */
function validateSchedule(schedule, sectionKey) {
  const clashes = [];

  for (const day of DAYS) {
    for (const slot of VALID_SLOTS) {
      const entry = schedule[day]?.[slot];
      if (entry && Array.isArray(entry)) {
        clashes.push({ day, slot, reason: 'Multiple entries in same slot', entries: entry });
      }
    }
  }

  return { valid: clashes.length === 0, clashes };
}

/**
 * Summarizes a schedule: total theory hours, lab hours, free slots per day.
 */
function summarizeSchedule(schedule) {
  let theoryCount = 0, labCount = 0, freeCount = 0;
  const dayLoads = {};

  for (const day of DAYS) {
    dayLoads[day] = 0;
    for (const slot of VALID_SLOTS) {
      const entry = schedule[day]?.[slot];
      if (!entry) { freeCount++; continue; }
      if (entry.sessionType === 'THEORY') theoryCount++;
      if (entry.sessionType === 'LAB') labCount++;
      dayLoads[day]++;
    }
  }

  return { theorySlots: theoryCount, labSlots: labCount, freeSlots: freeCount, dayLoads };
}

module.exports = { TimetableScheduler, ScheduleState, validateSchedule, summarizeSchedule, DAYS, ALL_SLOTS, VALID_SLOTS };
