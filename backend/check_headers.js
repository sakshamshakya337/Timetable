const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
const files = ['01_Teachers.xlsx', '02_Rooms.xlsx', '03_Subjects.xlsx', '04_Sections.xlsx', '05_Electives.xlsx'];

files.forEach(f => {
    const filePath = path.join(dataDir, f);
    if (fs.existsSync(filePath)) {
        const wb = xlsx.readFile(filePath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);
        console.log(`File: ${f}`);
        console.log(`Headers: ${JSON.stringify(Object.keys(rows[0] || {}))}`);
        console.log(`Sample Row: ${JSON.stringify(rows[0] || {})}`);
        console.log('---');
    } else {
        console.log(`File not found: ${f}`);
    }
});
