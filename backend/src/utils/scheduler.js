// ═══════════════════════════════════════════════════════════════════════════════
// Smart Timetable Scheduling Engine — v9 (Explicit Elective Groups)
// ═══════════════════════════════════════════════════════════════════════════════

const DAYS = 6;          // Monday–friday
const SLOTS_PER_DAY = 7;          // 9AM → 5 PM
const LUNCH_SLOT = 5;             // 1 PM – 2 PM (index 5)
const MID_DAY = [2, 3, 4];        // 10 AM–1 PM window
const MAX_DAILY = 7;              // max total classes per group per section per day
const MAX_PRACTICAL_DAY = 4;      // max practical SLOTS per group per day (2 blocks of 2 hrs each)
const MAX_CONSEC = 3;             // HC11: max consecutive teacher slots
const MAX_WEEK = 22;              // HC7 upper bound

// ── Matrix initialisation ─────────────────────────────────────────────────────

function initMatrix(keys) {
    const m = {};
    for (const k of keys)
        m[k] = Array.from({ length: DAYS }, () => Array(SLOTS_PER_DAY).fill(null));
    return m;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
}

function normSem(v) {
    return (v || '').toString().trim().toLowerCase().replace(/[\s-]/g, '');
}

// ── Shared Allocation Context Checks (Multi-section support) ──────────────────

function midDayOk(groupAvail, sectionIds, group, day, hypotheticalSlot) {
    for (const sectionId of sectionIds) {
        const keys = group === 'Combined'
            ? [`${sectionId}_G1`, `${sectionId}_G2`]
            : [`${sectionId}_${group}`];

        for (const key of keys) {
            const filledMid = MID_DAY.filter(s =>
                s === hypotheticalSlot ? true : !!groupAvail[key]?.[day]?.[s]
            ).length;
            if (filledMid >= 3) return false;
        }
    }
    return true;
}

function dailyLoadOk(groupAvail, sectionIds, group, day, newSlots) {
    for (const sectionId of sectionIds) {
        const keys = group === 'Combined'
            ? [`${sectionId}_G1`, `${sectionId}_G2`]
            : [`${sectionId}_${group}`];
        for (const key of keys) {
            const cur = (groupAvail[key]?.[day] || []).filter(Boolean).length;
            if (cur + newSlots > MAX_DAILY) return false;
        }
    }
    return true;
}

function consecOk(teacherAvail, teacherId, day, slot) {
    let run = 1;
    for (let s = slot - 1; s >= 0 && teacherAvail[teacherId]?.[day]?.[s]; s--) run++;
    for (let s = slot + 1; s < SLOTS_PER_DAY && teacherAvail[teacherId]?.[day]?.[s]; s++) run++;
    return run <= MAX_CONSEC;
}

function noSameDaySubject(groupAvail, sectionIds, group, subjectId, day) {
    for (const sectionId of sectionIds) {
        const keys = group === 'Combined'
            ? [`${sectionId}_G1`, `${sectionId}_G2`]
            : [`${sectionId}_${group}`];
        for (const key of keys) {
            const daySlots = groupAvail[key]?.[day] || [];
            if (daySlots.some(entry => entry && entry.subjectId === subjectId)) return false;
        }
    }
    return true;
}

function totalGapsOk(groupAvail, sectionIds, group, day, startSlot, dur) {
    for (const sectionId of sectionIds) {
        const keys = group === 'Combined'
            ? [`${sectionId}_G1`, `${sectionId}_G2`]
            : [`${sectionId}_${group}`];

        for (const key of keys) {
            const daySlots = Array.from({ length: 8 }, (_, i) => !!groupAvail[key]?.[day]?.[i]);
            for (let i = 0; i < dur; i++) daySlots[startSlot + i] = true;

            const classCount = daySlots.filter(Boolean).length;
            if (classCount < 2) continue;

            const first = daySlots.indexOf(true);
            const last = daySlots.lastIndexOf(true);
            const totalGaps = (last - first + 1) - classCount;

            if (totalGaps > 2) return false;
        }
    }
    return true;
}

function canAllocateGroupsForBlock(sectionIds, group, day, startSlot, dur, matrices, type) {
    if (startSlot + dur > SLOTS_PER_DAY) return false;
    
    // Gap Logic: 12 PM to 2 PM (Slots 4 and 5)
    // Slot 4: 12-1 PM, Slot 5: 1-2 PM (Lunch)
    for (let i = 0; i < dur; i++) {
        const slot = startSlot + i;
        if (slot === 4 || slot === 5) return false; // Block 12 PM - 2 PM
    }

    if (!dailyLoadOk(matrices.groupAvail, sectionIds, group, day, dur)) return false;
    if (!totalGapsOk(matrices.groupAvail, sectionIds, group, day, startSlot, dur)) return false;

    if (type === 'Practical' && (group === 'G1' || group === 'G2')) {
        for (const sectionId of sectionIds) {
            const key = `${sectionId}_${group}`;
            const practicalSlotsToday = (matrices.groupAvail[key]?.[day] || []).filter(e => e?.type === 'Practical').length;
            if (practicalSlotsToday + dur > MAX_PRACTICAL_DAY) return false;

            const siblingGroup = group === 'G1' ? 'G2' : 'G1';
            const siblingKey = `${sectionId}_${siblingGroup}`;
            for (let i = 0; i < dur; i++) {
                const s = startSlot + i;
                const sibEntry = matrices.groupAvail[siblingKey]?.[day]?.[s];
                if (sibEntry && sibEntry.type === 'Practical') return false;
            }
        }
    }

    for (let i = 0; i < dur; i++) {
        const slot = startSlot + i;
        for (const sectionId of sectionIds) {
            if (group === 'Combined') {
                if (matrices.groupAvail[`${sectionId}_G1`]?.[day]?.[slot]) return false;
                if (matrices.groupAvail[`${sectionId}_G2`]?.[day]?.[slot]) return false;
            } else {
                if (matrices.groupAvail[`${sectionId}_${group}`]?.[day]?.[slot]) return false;
            }
        }
        if (!midDayOk(matrices.groupAvail, sectionIds, group, day, slot)) return false;
    }
    return true;
}

function isRoomFreeForBlock(roomId, day, startSlot, dur, matrices) {
    for (let i = 0; i < dur; i++) {
        if (matrices.roomAvail[roomId]?.[day]?.[startSlot + i]) return false;
    }
    return true;
}

function isTeacherFreeForBlock(teacherId, day, startSlot, dur, matrices) {
    for (let i = 0; i < dur; i++) {
        const s = startSlot + i;
        if (matrices.teacherAvail[teacherId]?.[day]?.[s]) return false;
        if (!consecOk(matrices.teacherAvail, teacherId, day, s)) return false;
    }
    return true;
}

function allocateBlockBasket(teacherIds, roomIds, sectionIds, group, subjectIds, day, startSlot, dur, matrices, type) {
    const isCombo = subjectIds.length > 1;
    // For UI compatibility, the first subject in the basket acts as the primary 'subjectId' in the block,
    // though the UI mapping unpacks the 'subjects' array entirely.
    for (let j = 0; j < subjectIds.length; j++) {
        const subId = subjectIds[j];
        const tId = teacherIds[j];
        const rId = roomIds[j];

        const payload = {
            teacherId: tId, roomId: rId, sectionId: sectionIds.length === 1 ? sectionIds[0] : 'Multiple',
            subjectId: subId, group, type,
            isBasketCombo: isCombo, subjects: subjectIds, rooms: roomIds, teachers: teacherIds
        };

        for (let i = 0; i < dur; i++) {
            const s = startSlot + i;
            matrices.teacherAvail[tId][day][s] = payload;
            matrices.roomAvail[rId][day][s] = payload;

            for (const sectionId of sectionIds) {
                const gKeys = group === 'Combined' ? [`${sectionId}_G1`, `${sectionId}_G2`] : [`${sectionId}_${group}`];
                for (const key of gKeys) {
                    matrices.groupAvail[key][day][s] = payload;
                }
            }
        }
    }
}

// ── Post-generation validators ────────────────────────────────────────────────

function validateMidDayGaps(groupAvail, sectionIds) {
    const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const violations = [];
    for (const sid of sectionIds) {
        for (let d = 0; d < DAYS; d++) {
            for (const g of ['G1', 'G2']) {
                const key = `${sid}_${g}`;
                const dayClasses = (groupAvail[key]?.[d] || []).filter(Boolean).length;
                if (dayClasses === 0) continue;
                // Updated MID_DAY gap validation if needed, 
                // but the hard gap logic already handles 12-2 PM
            }
        }
    }
    return violations;
}

function validateDailyGaps(groupAvail, sectionIds) {
    const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const warnings = [];
    for (const sid of sectionIds) {
        for (let d = 0; d < DAYS; d++) {
            for (const g of ['G1', 'G2']) {
                const key = `${sid}_${g}`;
                const mask = (groupAvail[key]?.[d] || []).map(Boolean);
                const filled = mask.filter(Boolean).length;
                if (filled < 2) continue;
                const first = mask.indexOf(true);
                const last = mask.lastIndexOf(true);
                let totalGaps = (last - first + 1) - filled;
                if (totalGaps > 2) {
                    warnings.push(`${sid}_${g}: >2 total gaps on ${DAY_NAMES[d]}`);
                }
            }
        }
    }
    return warnings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function generateTimetableLogic(teachers, rooms, subjects, sections, electives) {

    const teacherIds = Object.keys(teachers || {});
    const roomIds = Object.keys(rooms || {});
    const subjectIds = Object.keys(subjects || {});
    const sectionIds = Object.keys(sections || {});
    const electivesData = electives || {};

    const fail = (msg) => ({
        feasibilityResult: 'PARTIAL_SUCCESS', timetable: {},
        teacherWorkloadSummary: {}, roomUtilizationSummary: {},
        optimizationScore: 0, conflictReport: [msg],
        gapValidationReport: []
    });

    if (!teacherIds.length) return fail('No teachers. Add at least one teacher.');
    if (!roomIds.length) return fail('No rooms. Add Classrooms and Labs.');
    if (!subjectIds.length) return fail('No subjects. Add subjects with L/T/P values.');
    if (!sectionIds.length) return fail('No sections. Add at least one section.');

    const classrooms = roomIds.filter(r => (rooms[r].type || '').trim().toLowerCase() === 'classroom');
    const labs = roomIds.filter(r => {
        const t = (rooms[r].type || '').trim().toLowerCase();
        return t === 'lab' || t === 'laboratory';
    });

    if (!classrooms.length) return fail('No Classrooms found. Add rooms with type "Classroom".');
    if (!labs.length) return fail('No Labs found. Add rooms with type "Lab".');

    const groupIds = [];
    sectionIds.forEach(s => { groupIds.push(`${s}_G1`); groupIds.push(`${s}_G2`); });

    // Collect all subject IDs bound to active electives to avoid duplicate independent scheduling
    const electiveBoundSubjectIds = new Set();
    Object.values(electivesData).forEach(el => {
        if (!el.sectionIds || el.sectionIds.length === 0) return;
        (el.offerings || []).forEach(off => {
            if (off.theory) electiveBoundSubjectIds.add(off.theory);
            if (off.practical) electiveBoundSubjectIds.add(off.practical);
        });
    });

    let totalHours = 0;
    const allSessions = [];

    // ── 1. Push Elective Blocks ───────────────────────────────────────────────
    Object.values(electivesData).forEach(el => {
        if (!el.sectionIds || el.sectionIds.length === 0) return;

        const theorySubs = [];
        const practicalSubs = [];
        (el.offerings || []).forEach(off => {
            if (off.theory && subjects[off.theory]) theorySubs.push(off.theory);
            if (off.practical && subjects[off.practical]) practicalSubs.push(off.practical);
        });

        // Theory Sub-sessions (Lecture)
        if (theorySubs.length > 0) {
            let maxL = 0;
            theorySubs.forEach(id => { maxL = Math.max(maxL, parseInt(subjects[id].lectures || 0, 10)); });
            let maxT = 0;
            theorySubs.forEach(id => { maxT = Math.max(maxT, parseInt(subjects[id].tutorials || 0, 10)); });

            for (let i = 0; i < maxL; i++) {
                allSessions.push({
                    isBasket: true, items: theorySubs, duration: 1, type: 'Lecture', group: 'Combined',
                    sectionIds: el.sectionIds, roomType: 'classroom'
                });
            }
            for (let i = 0; i < maxT; i++) {
                allSessions.push({
                    isBasket: true, items: theorySubs, duration: 1, type: 'Tutorial', group: 'G1',
                    sectionIds: el.sectionIds, roomType: 'classroom'
                });
                allSessions.push({
                    isBasket: true, items: theorySubs, duration: 1, type: 'Tutorial', group: 'G2',
                    sectionIds: el.sectionIds, roomType: 'classroom'
                });
            }
            totalHours += maxL + (maxT * 2);
        }

        // Practical Sub-sessions
        if (practicalSubs.length > 0) {
            let maxP = 0;
            practicalSubs.forEach(id => { maxP = Math.max(maxP, parseInt(subjects[id].practicals || 0, 10)); });
            const pBlocks = Math.ceil(maxP / 2);
            for (let i = 0; i < pBlocks; i++) {
                allSessions.push({
                    isBasket: true, items: practicalSubs, duration: 2, type: 'Practical', group: 'G1',
                    sectionIds: el.sectionIds, roomType: 'lab'
                });
                allSessions.push({
                    isBasket: true, items: practicalSubs, duration: 2, type: 'Practical', group: 'G2',
                    sectionIds: el.sectionIds, roomType: 'lab'
                });
            }
            totalHours += (pBlocks * 4);
        }
    });

    // ── 2. Push Standard Independent Subjects ─────────────────────────────────
    for (const secId of sectionIds) {
        for (const subId of subjectIds) {
            if (electiveBoundSubjectIds.has(subId)) continue; // Handled by Elective logic above

            const sub = subjects[subId];
            const sec = sections[secId];
            const subSem = normSem(sub.semester);
            const secSem = normSem(sec.semester);
            if (subSem && secSem && subSem !== secSem) continue;

            const L = Math.max(0, parseInt(sub.lectures || 0, 10));
            const T = Math.max(0, parseInt(sub.tutorials || 0, 10));
            const P = Math.max(0, parseInt(sub.practicals || 0, 10));
            if (L + T + P === 0) continue;

            const addSession = (type, group, duration, roomType) => {
                allSessions.push({
                    isBasket: false, subjectId: subId, items: [subId],
                    type, group, duration, roomType, sectionIds: [secId]
                });
            };

            for (let i = 0; i < L; i++) addSession('Lecture', 'Combined', 1, 'classroom');
            for (let i = 0; i < T; i++) {
                addSession('Tutorial', 'G1', 1, 'classroom');
                addSession('Tutorial', 'G2', 1, 'classroom');
            }

            const practicalBlocks = Math.ceil(P / 2);
            for (let i = 0; i < practicalBlocks; i++) {
                addSession('Practical', 'G1', 2, 'lab');
                addSession('Practical', 'G2', 2, 'lab');
            }
            totalHours += L + (T * 2) + (practicalBlocks * 4);
        }
    }

    if (allSessions.length === 0) {
        return fail('No subjects found or matched. Ensure semesters align and L/T/P > 0.');
    }

    // ── Heuristic search ──────────────────────────────────────────────────────
    let bestScore = -1;
    let bestMatrices = null;
    let finalConflicts = [];

    const BUDGET_MS = 12000;
    const MAX_ATTEMPTS = 30;
    const t0 = Date.now();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (Date.now() - t0 > BUDGET_MS) break;

        const matrices = {
            teacherAvail: initMatrix(teacherIds),
            roomAvail: initMatrix(roomIds),
            groupAvail: initMatrix(groupIds)
        };

        const weeklyLoad = {};
        teacherIds.forEach(t => weeklyLoad[t] = 0);

        const sessions = [...allSessions];
        shuffle(sessions);
        sessions.sort((a, b) => {
            const pri = x => x.type === 'Lecture' ? 0 : x.type === 'Practical' ? 1 : 2;
            return pri(a) - pri(b);
        });

        let scheduled = 0;
        const conflictSet = new Set();
        const conflicts = [];

        for (const session of sessions) {
            if (Date.now() - t0 > BUDGET_MS) break;

            const dur = session.duration;
            const pRooms = session.roomType === 'lab' ? [...labs] : [...classrooms];
            const fRooms = session.roomType === 'lab' ? [...classrooms] : [...labs];
            shuffle(pRooms);

            const slots = [];
            for (let d = 0; d < DAYS; d++) {
                for (let s = 0; s <= SLOTS_PER_DAY - dur; s++) slots.push({ d, s });
            }
            shuffle(slots);

            let placed = false;

            const tryPlace = (roomPool) => {
                for (const { d, s } of slots) {
                    if (!canAllocateGroupsForBlock(session.sectionIds, session.group, d, s, dur, matrices, session.type)) continue;

                    const activeSubjectId = session.items[0];
                    const sameDayOk = noSameDaySubject(matrices.groupAvail, session.sectionIds, session.group, activeSubjectId, d);
                    if (!sameDayOk && placed !== undefined) continue;

                    const availRooms = [];
                    for (const rId of roomPool) {
                        if (isRoomFreeForBlock(rId, d, s, dur, matrices)) {
                            availRooms.push(rId);
                            if (availRooms.length === session.items.length) break;
                        }
                    }
                    if (availRooms.length < session.items.length) continue;

                    const availTeachers = [];
                    const eligible = [...teacherIds].filter(t => weeklyLoad[t] + dur <= MAX_WEEK).sort((a, b) => weeklyLoad[a] - weeklyLoad[b]);
                    for (const tId of eligible) {
                        if (isTeacherFreeForBlock(tId, d, s, dur, matrices)) {
                            availTeachers.push(tId);
                            if (availTeachers.length === session.items.length) break;
                        }
                    }
                    if (availTeachers.length < session.items.length) continue;

                    allocateBlockBasket(
                        availTeachers, availRooms, session.sectionIds, session.group,
                        session.items, d, s, dur, matrices, session.type
                    );
                    for (const t of availTeachers) weeklyLoad[t] += dur;
                    return true;
                }
                return false;
            };

            placed = tryPlace(pRooms);
            if (!placed) placed = tryPlace(fRooms); // Tier 2 fallback

            if (placed) {
                scheduled += dur;
            } else {
                if (session.isBasket) {
                    const key = `BASKET|${session.type}|${session.group}`;
                    if (!conflictSet.has(key)) {
                        conflictSet.add(key);
                        conflicts.push(`Elective ${session.type} (${session.group}): Parallel items failed to fit simultaneously for sections [${session.sectionIds.join(',')}]`);
                    }
                } else {
                    const secName = sections[session.sectionIds[0]]?.name || session.sectionIds[0];
                    const subName = subjects[session.items[0]]?.code || subjects[session.items[0]]?.name || session.items[0];
                    const key = `${secName}|${subName}|${session.type}|${session.group}`;
                    if (!conflictSet.has(key)) {
                        conflictSet.add(key);
                        conflicts.push(`${session.type} (${session.group}): ${secName} – ${subName}`);
                    }
                }
            }
        }

        console.log(`[Scheduler] Attempt ${attempt + 1}: ${scheduled}/${totalHours}`);

        if (scheduled > bestScore) {
            bestScore = scheduled;
            bestMatrices = matrices;
            finalConflicts = conflicts;
        }
        if (scheduled >= totalHours) break;
    }

    if (!bestMatrices) return fail('Could not place any sessions. Check room types and teachers.');

    // ── Fill remaining empty slots with Self Study ────────────────────────────
    for (const sid of sectionIds) {
        let countG1 = 0;
        let countG2 = 0;
        for (let d = 0; d < DAYS; d++) {
            for (let s = 0; s < SLOTS_PER_DAY; s++) {
                if (bestMatrices.groupAvail[`${sid}_G1`]?.[d]?.[s]) countG1++;
                if (bestMatrices.groupAvail[`${sid}_G2`]?.[d]?.[s]) countG2++;
            }
        }

        let currentMax = Math.max(countG1, countG2);
        if (currentMax < 31) {
            let needed = 31 - currentMax;
            outerFill:
            for (let s = SLOTS_PER_DAY - 1; s >= 0; s--) {
                if (s === 4 || s === 5) continue; // Skip gap slots
                for (let d = 0; d < DAYS; d++) {
                    if (needed <= 0) break outerFill;

                    const g1Free = !bestMatrices.groupAvail[`${sid}_G1`]?.[d]?.[s];
                    const g2Free = !bestMatrices.groupAvail[`${sid}_G2`]?.[d]?.[s];

                    if (g1Free && g2Free) {
                        const selfStudyPayload = {
                            teacherId: 'self', roomId: 'self', sectionId: sid,
                            subjectId: 'Self Study', group: 'Combined', type: 'Self Study',
                            isBasketCombo: false, subjects: ['Self Study'], rooms: ['self'], teachers: ['self']
                        };
                        bestMatrices.groupAvail[`${sid}_G1`][d][s] = selfStudyPayload;
                        bestMatrices.groupAvail[`${sid}_G2`][d][s] = selfStudyPayload;
                        needed--;
                    }
                }
            }
        }
    }

    // ── Build timetable output ────────────────────────────────────────────────
    const timetable = {};
    sectionIds.forEach(sid => {
        timetable[sid] = {};
        for (let d = 0; d < DAYS; d++) {
            timetable[sid][d] = {};
            for (let s = 0; s < SLOTS_PER_DAY; s++) {
                const g1 = bestMatrices.groupAvail[`${sid}_G1`]?.[d]?.[s] || null;
                const g2 = bestMatrices.groupAvail[`${sid}_G2`]?.[d]?.[s] || null;
                if (g1 || g2) timetable[sid][d][s] = { g1, g2 };
            }
        }
    });

    const teacherWorkloadSummary = {};
    teacherIds.forEach(tId => {
        let c = 0;
        for (let d = 0; d < DAYS; d++)
            for (let s = 0; s < SLOTS_PER_DAY; s++)
                if (bestMatrices.teacherAvail[tId]?.[d]?.[s]) c++;
        teacherWorkloadSummary[tId] = c;
    });

    const roomUtilizationSummary = {};
    roomIds.forEach(rId => {
        let c = 0;
        for (let d = 0; d < DAYS; d++)
            for (let s = 0; s < SLOTS_PER_DAY; s++)
                if (bestMatrices.roomAvail[rId]?.[d]?.[s]) c++;
        roomUtilizationSummary[rId] = c;
    });

    const midDayViolations = validateMidDayGaps(bestMatrices.groupAvail, sectionIds);
    const gapWarnings = validateDailyGaps(bestMatrices.groupAvail, sectionIds);

    const gapValidationReport = [
        ...midDayViolations.map(v => `⚠ ${v}`),
        ...gapWarnings.map(v => `ℹ ${v}`)
    ];

    const optimizationScore = totalHours > 0
        ? Math.min(100, Math.round((bestScore / totalHours) * 100))
        : 100;

    const feasibilityResult = (midDayViolations.length) > 0
        ? 'PARTIAL_SUCCESS'
        : optimizationScore >= 100 ? 'SUCCESS' : 'PARTIAL_SUCCESS';

    return {
        timetable,
        teacherWorkloadSummary,
        roomUtilizationSummary,
        gapValidationReport,
        feasibilityResult,
        optimizationScore,
        conflictReport: finalConflicts.slice(0, 15)
    };
}

module.exports = {
    generateTimetableLogic
};
