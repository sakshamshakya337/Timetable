const db = require('../config/firebase');
const { generateTimetableLogic } = require('../utils/scheduler');

async function getCollectionData(nodeName) {
    console.log(`Fetching ${nodeName}...`);
    const snapshot = await db.ref(nodeName).once('value');
    const val = snapshot.val() || {};
    console.log(`Fetched ${Object.keys(val).length} items from ${nodeName}`);
    return val;
}

async function generateTimetable(options = {}) {
    const { includeElectives = true } = options;
    try {
        console.log("Fetching data from Realtime Database...");

        const [teachers, rooms, subjects, sections, electives, allocations] = await Promise.all([
            getCollectionData('teachers'),
            getCollectionData('rooms'),
            getCollectionData('subjects'),
            getCollectionData('sections'),
            getCollectionData('electives'),
            getCollectionData('allocations')
        ]);

        console.log(`Fetched ${Object.keys(teachers).length} teachers, ${Object.keys(rooms).length} rooms, ${Object.keys(subjects).length} subjects, ${Object.keys(sections).length} sections.`);

        const result = generateTimetableLogic(
            teachers,
            rooms,
            subjects,
            sections,
            includeElectives ? electives : {},
            allocations
        );

        // Optionally, save the generated timetable back to Realtime Database here
        if (result.timetable && Object.keys(result.timetable).length > 0) {
            console.log("Saving generated timetable to database...");
            await db.ref("timetable").set(result.timetable);
        }

        return result;

    } catch (error) {
        console.error("Error generating timetable:", error);
        throw error;
    }
}

module.exports = {
    generateTimetable
};
