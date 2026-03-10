const xlsx = require('xlsx');
const fs = require('fs');

try {
    const workbook = xlsx.readFile('Course Master 25261 updated.xlsx');
    const sheet_name_list = workbook.SheetNames;
    console.log("Sheets:", sheet_name_list);

    sheet_name_list.forEach(sheetName => {
        console.log(`\n--- Sheet: ${sheetName} ---`);
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
        console.log(`Row count: ${data.length}`);
        if (data.length > 0) {
            console.log("Headers:", Object.keys(data[0]));
            console.log("First 3 rows:", JSON.stringify(data.slice(0, 3), null, 2));
        }
    });
} catch (e) {
    console.error("Error reading excel:", e.message);
}
