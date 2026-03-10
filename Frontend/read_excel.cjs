const xlsx = require('xlsx');
const fs = require('fs');

try {
    const workbook = xlsx.readFile('Course Master 25261 updated.xlsx');
    const sheet_name_list = workbook.SheetNames;

    let allData = {};
    sheet_name_list.forEach(sheetName => {
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
        allData[sheetName] = data;
    });

    fs.writeFileSync('excel_data.json', JSON.stringify(allData, null, 2));
    console.log("Saved to excel_data.json");
} catch (e) {
    console.error("Error reading excel:", e.message);
}
