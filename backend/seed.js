const admin = require("firebase-admin");
const xlsx = require('xlsx');
const path = require('path');
require("dotenv").config();

// ── Initialize Firebase Admin ────────────────────────────────────────────────
if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error("❌ ERROR: Firebase credentials missing in .env");
    process.exit(1);
}

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.database();

const DATA_DIR = path.join(__dirname, 'data');
const FILES = [
    { name: '01_Teachers.xlsx', node: 'teachers', idKey: 'Teacher ID' },
    { name: '02_Rooms.xlsx', node: 'rooms', idKey: 'Room ID' },
    { name: '03_Subjects.xlsx', node: 'subjects', idKey: 'Course Code' },
    { name: '04_Sections.xlsx', node: 'sections', idKey: 'Section ID' },
    { name: '05_Electives.xlsx', node: 'electives', idKey: 'Course Code' }
];

async function seed() {
    console.log("🚀 Starting data seed process with corrected headers...");

    for (const file of FILES) {
        const filePath = path.join(DATA_DIR, file.name);
        try {
            console.log(`\n📄 Processing ${file.name}...`);
            const workbook = xlsx.readFile(filePath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Convert to 2D array first to find the header row
            const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            
            // Find the index of the header row (the one that contains our idKey)
            const headerRowIndex = rows.findIndex(row => row.includes(file.idKey));
            if (headerRowIndex === -1) {
                console.error(`❌ Could not find header row in ${file.name} (searching for "${file.idKey}")`);
                continue;
            }

            const headers = rows[headerRowIndex];
            const dataRows = rows.slice(headerRowIndex + 1);

            const uploadObj = {};
            dataRows.forEach((row, index) => {
                if (!row || row.length === 0) return;
                
                const item = {};
                headers.forEach((h, i) => {
                    if (h) {
                        // Clean header names (remove spaces, parentheses, etc. for Firebase keys)
                        const cleanKey = h.toLowerCase()
                                          .replace(/[^a-z0-9]/g, '_')
                                          .replace(/_+/g, '_')
                                          .replace(/^_|_$/g, '');
                        item[cleanKey] = row[i] || "";
                    }
                });

                // Get ID based on the clean version of the idKey
                const cleanIdKey = file.idKey.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                let id = item[cleanIdKey] || `item_${index}`;
                
                // SANITIZE ID: Firebase keys cannot contain . # $ / [ ]
                if (typeof id === 'string') {
                    id = id.replace(/[\.\#\$\/\\[\]]/g, '_');
                }

                // VALIDATION: Skip summary rows or noise
                const isNoise = !item[cleanIdKey] || 
                                id.toLowerCase().includes('total') || 
                                id.toLowerCase().includes('average') ||
                                (file.node === 'sections' && !item.section_name);
                
                if (isNoise) {
                    console.log(`   ⏭️  Skipping noise row: ${id}`);
                    return;
                }
                
                uploadObj[id] = item;
            });

            if (Object.keys(uploadObj).length === 0) {
                console.log(`⚠️  No data found in ${file.name}, skipping.`);
                continue;
            }

            await db.ref(file.node).set(uploadObj);
            console.log(`✨ Successfully seeded "${file.node}" (${Object.keys(uploadObj).length} items)`);

        } catch (err) {
            console.error(`❌ Error processing ${file.name}:`, err.message);
        }
    }

    console.log("\n🏁 Seed process completed!");
    process.exit(0);
}

seed();
