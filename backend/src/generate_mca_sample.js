const path = require('path');
const { parseCourseMaster } = require('./excelParser');
const { TimetableScheduler, ScheduleState } = require('./scheduler');

async function testGeneration() {
  console.log('Loading Course Master Excel...');

  try {
    const excelPath = path.join(__dirname, '..', '..', 'Frontend', 'Course Master 25261 updated.xlsx');
    const parsed = parseCourseMaster(excelPath);

    if (!parsed || !parsed.programs || !parsed.programs['P124']) {
      console.error('MCA Program not found in Excel. Cannot generate.');
      process.exit(1);
    }

    const program = parsed.programs['P124'];
    const year1 = program.yearData && program.yearData[1];
    
    if (!year1) {
      console.error('MCA Year 1 data not found.');
      process.exit(1);
    }

    const allCourses = [
      ...(year1.coreCourses || []),
      ...(Object.values(year1.electiveGroups || {}).flatMap(eg => eg.options))
    ];

    console.log(`Found ${allCourses.length} courses for MCA Year 1.`);

    // Mock teacher map and rooms
    const allTeachers = [{ id: 'mock1', name: 'Dr. John Doe', code: 'JD' }, { id: 'mock2', name: 'Prof. Jane Smith', code: 'JS' }];
    const allRooms = [{ id: 'room1', name: 'Lab 1', type: 'LAB' }, { id: 'room2', name: 'Room 101', type: 'THEORY' }];

    const assignedTeachers = [];
    allCourses.forEach((c, idx) => {
      const code = c.courseCode;
      const hasL = c.L > 0 || c.theoryHours > 0;
      const hasT = c.T > 0;
      const hasP = c.P > 0 || c.labHours > 0;

      // assign random teachers
      const t = allTeachers[idx % allTeachers.length];

      if (hasL) assignedTeachers.push({ id: t.id, name: t.name, courseCode: code, group: 'Combined', componentType: 'L' });
      if (hasT) {
        assignedTeachers.push({ id: t.id, name: t.name, courseCode: code, group: 'G1', componentType: 'T' });
        assignedTeachers.push({ id: t.id, name: t.name, courseCode: code, group: 'G2', componentType: 'T' });
      }
      if (hasP) {
        assignedTeachers.push({ id: t.id, name: t.name, courseCode: code, group: 'G1', componentType: 'P' });
        assignedTeachers.push({ id: t.id, name: t.name, courseCode: code, group: 'G2', componentType: 'P' });
      }
    });

    console.log(`Mocked ${assignedTeachers.length} teacher assignments.`);

    const electiveChoices = {};
    if (year1.electiveGroups) {
      Object.values(year1.electiveGroups).forEach(eg => {
        // Just pick the first option
        if (eg.options && eg.options.length > 0) {
          electiveChoices[eg.basketName] = eg.options[0].courseCode;
        }
      });
    }

    const state = new ScheduleState();
    const scheduler = new TimetableScheduler(
      state, 
      'MCA-Y1-SECA', 
      allCourses, 
      assignedTeachers, 
      allRooms, 
      electiveChoices
    );

    const result = scheduler.generate();

    console.log('\n--- TIMETABLE GENERATION RESULT ---');
    console.log(`Section: ${result.sectionKey}`);
    console.log(`Unscheduled: ${result.unscheduled.length} items`);
    result.unscheduled.forEach(u => console.log(`  - [${u.type}] ${u.courseCode}: ${u.reason}`));
    
    console.log(`\nWarnings: ${result.warnings.length} items`);
    result.warnings.forEach(w => console.log(`  - ${w.code}: ${w.reason}`));

    console.log('\nG1 Schedule preview (Monday):');
    Object.entries(result.scheduleG1['Monday'] || {}).forEach(([slot, session]) => {
      if (session) {
        console.log(`  Slot ${slot}: ${session.courseCode} (${session.sessionType}) - ${session.teacher?.name}`);
      }
    });
    
    console.log('\nG2 Schedule preview (Monday):');
    Object.entries(result.scheduleG2['Monday'] || {}).forEach(([slot, session]) => {
      if (session) {
        console.log(`  Slot ${slot}: ${session.courseCode} (${session.sessionType}) - ${session.teacher?.name}`);
      }
    });

  } catch (err) {
    console.error('Error generating:', err);
  } finally {
    process.exit(0);
  }
}

testGeneration();
