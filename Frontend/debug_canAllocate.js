const matrices = {
    teacherAvail: { "T1": Array.from({ length: 7 }, () => Array(8).fill(null)) },
    roomAvail: { "R1": Array.from({ length: 7 }, () => Array(8).fill(null)) },
    groupAvail: { "SEC1_G1": Array.from({ length: 7 }, () => Array(8).fill(null)), "SEC1_G2": Array.from({ length: 7 }, () => Array(8).fill(null)) }
};

// Simulate execution of canAllocate
function canAllocate(teacherId, roomId, sectionId, groupId, subjectId, day, slot, matrices) {
    const { teacherAvail, roomAvail, groupAvail } = matrices;

    if (!teacherAvail[teacherId]) return { r: false, rsn: "Missing teacherAvail array" };

    const tAvail = teacherAvail[teacherId]?.[day]?.[slot];
    if (tAvail) {
        if (Array.isArray(tAvail)) return { r: false, rsn: "Teacher already has 2 merged groups" };
        const isSameSubject = tAvail.subjectId === subjectId;
        const isSameRoom = tAvail.roomId === roomId;
        const isDifferentGroup = !(tAvail.sectionId === sectionId && tAvail.groupId === groupId);
        if (!isSameSubject || !isSameRoom || !isDifferentGroup || groupId === 'ALL' || tAvail.groupId === 'ALL') {
            return { r: false, rsn: `Teacher merge failed. isSameSubj:${isSameSubject} isSameRoom:${isSameRoom} isDiffGrp:${isDifferentGroup}` };
        }
    }

    const rAvail = roomAvail[roomId]?.[day]?.[slot];
    if (rAvail) {
        if (Array.isArray(rAvail)) return { r: false, rsn: "Room already has 2 merged groups" };
        const isSameSubject = rAvail.subjectId === subjectId;
        const isSameTeacher = rAvail.teacherId === teacherId;
        const isDifferentGroup = !(rAvail.sectionId === sectionId && rAvail.groupId === groupId);
        if (!isSameSubject || !isSameTeacher || !isDifferentGroup || groupId === 'ALL' || rAvail.groupId === 'ALL') {
            return { r: false, rsn: `Room merge failed. isSameSubj:${isSameSubject} isSameTchr:${isSameTeacher} isDiffGrp:${isDifferentGroup}` };
        }
    }

    if (groupId === 'ALL') {
        if (!groupAvail[`${sectionId}_G1`]) return { r: false, rsn: "Missing groupAvail G1 array" };
        if (groupAvail[`${sectionId}_G1`]?.[day]?.[slot] || groupAvail[`${sectionId}_G2`]?.[day]?.[slot]) return { r: false, rsn: "Group G1 or G2 busy" };
    } else {
        if (!groupAvail[`${sectionId}_${groupId}`]) return { r: false, rsn: "Missing groupAvail specific arr" };
        if (groupAvail[`${sectionId}_${groupId}`]?.[day]?.[slot]) return { r: false, rsn: "Specific group busy" };

        const siblingGroupId = groupId === 'G1' ? 'G2' : 'G1';
        const siblingSlotInfo = groupAvail[`${sectionId}_${siblingGroupId}`]?.[day]?.[slot];
        if (siblingSlotInfo && siblingSlotInfo.subjectId !== subjectId) return { r: false, rsn: "Sibling busy with different subject" };
    }

    let continuousCount = 0;
    for (let s = slot - 1; s >= 0; s--) {
        if (teacherAvail[teacherId]?.[day]?.[s]) continuousCount++; else break;
    }
    for (let s = slot + 1; s < 8; s++) {
        if (teacherAvail[teacherId]?.[day]?.[s]) continuousCount++; else break;
    }
    if (continuousCount >= 4) return { r: false, rsn: "Teacher continuous class limit" };

    if (slot === 3 || slot === 4) {
        const siblingSlot = slot === 3 ? 4 : 3;
        if (groupId === 'ALL') {
            if (groupAvail[`${sectionId}_G1`]?.[day]?.[siblingSlot] || groupAvail[`${sectionId}_G2`]?.[day]?.[siblingSlot]) return { r: false, rsn: "Lunch break collision (ALL)" };
        } else {
            if (groupAvail[`${sectionId}_${groupId}`]?.[day]?.[siblingSlot]) return { r: false, rsn: "Lunch break collision (Specific)" };
        }
    }

    return { r: true, rsn: "Passed" };
}

console.log(canAllocate("T1", "R1", "SEC1", "ALL", "S1", 0, 0, matrices));
