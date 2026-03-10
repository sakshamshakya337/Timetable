const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'data', 'book1.xlsx');
const outputPath = path.join(__dirname, 'data', 'book1_formatted.csv');

try {
    const workbook = xlsx.readFile(inputPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Expected columns: 'Course Code', 'Course Title', 'Semester', 'L', 'T', 'P'
    const formattedData = data.map(row => {
        return {
            'Course Code': row['Course Code'] || '',
            'Course Title': row['Course Title'] || '',
            'Semester': '', // Default to empty
            'L': row['L'] !== undefined ? row['L'] : 0,
            'T': row['T'] !== undefined ? row['T'] : 0,
            'P': row['P'] !== undefined ? row['P'] : 0
        };
    });

    const newWorkbook = xlsx.utils.book_new();
    const newSheet = xlsx.utils.json_to_sheet(formattedData);
    xlsx.utils.book_append_sheet(newWorkbook, newSheet, 'Subjects');

    xlsx.writeFile(newWorkbook, outputPath, { bookType: 'csv' });
    console.log(`Successfully created ${outputPath}`);
} catch (err) {
    console.error('Error formatting data:', err);
}
