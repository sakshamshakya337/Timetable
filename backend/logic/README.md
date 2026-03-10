# LPU Timetable Backend v2
## Auto-parsing, Excel-agnostic Scheduling Engine

---

## Quick Start

```bash
cd Backend
npm install
node server.js
# → http://localhost:3001
```

---

## How It Works — Full Flow

```
1. Frontend uploads Excel  →  POST /upload
2. Backend auto-detects columns, parses all programs/courses
3. Frontend fetches programs  →  GET /programs
4. User picks program → year → section
5. Frontend fetches courses  →  GET /courses?program=P123&year=1
6. User assigns teachers per course, selects rooms, picks electives
7. Frontend sends generate request  →  POST /generate
8. Backend runs constraint scheduler → returns grid timetable
9. Frontend renders the grid (Mon-Sat × 9 time slots)
```

---

## Directory Structure

```
Backend/
├── server.js                  ← Express entry point
├── package.json
├── .env                       ← PORT=3001
├── src/
│   ├── excelParser.js         ← Auto-detecting Excel parser
│   └── scheduler.js           ← Constraint-satisfaction scheduler
└── routes/
    └── timetable.js           ← All REST endpoints
```

---

## API Reference

### 1. Upload Excel

```
POST /api/timetable/upload
Content-Type: multipart/form-data
Field: excel = <.xlsx file>
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully parsed Course Master 25261.xlsx",
  "meta": {
    "totalPrograms": 8,
    "totalCourses": 531,
    "sheetName": "Sheet1",
    "detectedColumns": ["OfficialCode", "pYear", "CourseCode", "L", "T", "P", "CourseType", "BasketName"],
    "headerRow": 1
  },
  "programList": [
    {
      "baseCode": "P123",
      "programName": "BCA",
      "officialCodes": ["P123", "P123-Y", "P123-L"],
      "years": [1, 2, 3],
      "yearSummary": {
        "1": { "semester": 1, "coreCount": 8, "electiveGroups": 1, "labCount": 2 }
      }
    }
  ]
}
```

---

### 2. Load from file path (dev only)

```
POST /api/timetable/upload/path
Content-Type: application/json
{ "filePath": "/absolute/path/to/Course_Master.xlsx" }
```

---

### 3. Get Programs

```
GET /api/timetable/programs
```

Returns all programs from the loaded Excel.

---

### 4. Get Years for a Program

```
GET /api/timetable/programs/P123/years
```

**Response:**
```json
{
  "years": [
    { "year": 1, "semester": 1, "label": "Year 1 (Semester 1)", "coreCount": 8, "labCount": 2 },
    { "year": 2, "semester": 3, "label": "Year 2 (Semester 3)", "coreCount": 7, "labCount": 3 },
    { "year": 3, "semester": 5, "label": "Year 3 (Semester 5)", "coreCount": 1, "labCount": 4 }
  ]
}
```

---

### 5. Get Courses for Program + Year

```
GET /api/timetable/courses?program=P123&year=1
```

**Response:**
```json
{
  "courses": {
    "core": [
      {
        "courseCode": "CAP172",
        "courseTitle": "PROGRAMMING METHODOLOGIES",
        "L": 3, "T": 0, "P": 0,
        "courseType": "CR",
        "subjectType": "THEORY",
        "isLab": false,
        "theorySlotsPerWeek": 3,
        "labBlocksPerWeek": 0,
        "labPair": "CAP173"
      },
      {
        "courseCode": "CAP173",
        "courseTitle": "PROGRAMMING METHODOLOGIES-LABORATORY",
        "L": 0, "T": 0, "P": 2,
        "subjectType": "LAB",
        "isLab": true,
        "theorySlotsPerWeek": 0,
        "labBlocksPerWeek": 1,
        "theoryPair": "CAP172"
      }
    ],
    "electives": [
      {
        "basketName": "P123-5-2023-ME2",
        "courseType": "SP",
        "options": [
          { "courseCode": "CAP473", "courseTitle": "GAME DEVELOPMENT USING UNITY ENGINE", ... },
          { "courseCode": "CAP483", "courseTitle": "DATA VISUALIZATION", ... }
        ]
      }
    ],
    "projects": [...],
    "labs": [...],
    "theory": [...]
  },
  "totalWeeklyHours": { "theory": 18, "lab": 6, "total": 24 }
}
```

---

### 6. Generate Timetable (Single Section)

```
POST /api/timetable/generate
Content-Type: application/json
```

**Request Body:**
```json
{
  "program": "P123",
  "year": 1,
  "section": "BCA-Y1-SECA",
  "teachers": [
    {
      "id": "T001",
      "name": "Dr. Rajesh Kumar Sharma",
      "courseCode": "CAP172,CAP173",
      "maxHrsPerWeek": 20
    },
    {
      "id": "T002",
      "name": "Dr. Priya Singh",
      "courseCode": "CAP170,CAP171",
      "maxHrsPerWeek": 18
    }
  ],
  "rooms": [
    { "id": "38-501", "name": "Room 38-501", "type": "THEORY", "capacity": 60 },
    { "id": "38-502", "name": "Room 38-502", "type": "THEORY", "capacity": 60 },
    { "id": "37-501", "name": "CS Lab 1",    "type": "LAB",    "capacity": 30 },
    { "id": "37-502", "name": "CS Lab 2",    "type": "LAB",    "capacity": 30 }
  ],
  "electiveChoices": {
    "P123-5-2023-ME2":  "CAP473",
    "P123-5-2023-SEC3": "CAP460"
  },
  "sharedState": null
}
```

**Response:**
```json
{
  "success": true,
  "sectionKey": "BCA-Y1-SECA",
  "grid": [
    {
      "slotIndex": 0,
      "slotLabel": "8:00 - 9:00",
      "isLunch": false,
      "Monday":    { "courseCode": "CAP172", "courseTitle": "PROGRAMMING METHODOLOGIES", "sessionType": "THEORY", "teacher": { "name": "Dr. Sharma" }, "room": { "name": "Room 38-501" } },
      "Tuesday":   null,
      "Wednesday": { "courseCode": "CAP171", ... },
      "Thursday":  null,
      "Friday":    { "courseCode": "MTH136", ... },
      "Saturday":  null
    }
  ],
  "unscheduled": [],
  "warnings": [
    { "code": "GEN231", "title": "COMMUNITY DEVELOPMENT PROJECT", "reason": "Project/Seminar — requires manual scheduling", "type": "INFO" }
  ],
  "validation": { "valid": true, "clashes": [] },
  "summary": { "theorySlots": 22, "labSlots": 6, "freeSlots": 20, "dayLoads": { "Monday": 7, "Tuesday": 6, ... } },
  "updatedState": { "teacherBusy": {...}, "roomBusy": {...}, "sectionBusy": {...} },
  "meta": { "program": "P123", "programName": "BCA", "year": 1, "semester": 1, "days": [...], "slots": [...] }
}
```

> **IMPORTANT:** Save `updatedState` from the response and pass it as `sharedState` in the NEXT section's generate call.
> This is how teacher and room clashes are prevented across sections.

---

### 7. Generate Bulk (All Sections at Once)

```
POST /api/timetable/generate/bulk
```

**Request Body:**
```json
{
  "program": "P123",
  "year": 1,
  "sections": ["BCA-Y1-SECA", "BCA-Y1-SECB", "BCA-Y1-SECC", "BCA-Y1-SECD"],
  "teachers": [...],
  "rooms": [...],
  "electiveChoices": {
    "BCA-Y1-SECA": { "P123-5-2023-ME2": "CAP473" },
    "BCA-Y1-SECB": { "P123-5-2023-ME2": "CAP483" },
    "BCA-Y1-SECC": { "P123-5-2023-ME2": "CAP473" },
    "BCA-Y1-SECD": { "P123-5-2023-ME2": "CAP487" }
  }
}
```

The backend shares ONE `ScheduleState` across all sections automatically — teacher/room clashes detected.

---

### 8. Validate Schedule

```
POST /api/timetable/validate
{ "schedule": {...}, "sectionKey": "BCA-Y1-SECA" }
```

---

### 9. Summary

```
GET /api/timetable/summary
```

Returns overview of the loaded Excel — total programs, courses, elective baskets.

---

## Subject Type Logic

| L | T | P | Type | Scheduling |
|---|---|---|------|-----------|
| >0 | any | 0 | THEORY | 1-hr slots × L per week, spread across days |
| 0 | 0 | >0 | LAB | 2-hr consecutive block × P/2 per week |
| >0 | any | >0 | THEORY_LAB | Both: theory slots + lab block |
| any | any | ≥8 | PROJECT | Manual — not auto-scheduled |

---

## Scheduling Priority Order

```
1. LAB subjects      (2-consecutive slots needed → hardest constraint)
2. THEORY_LAB        (both theory + lab)
3. THEORY / TUTORIAL (1-hr slots, spread across days)
4. PROJECT / SEMINAR (flagged for manual scheduling)
```

---

## Multi-Section Clash Prevention

```javascript
// Frontend: sequential section generation with shared state

let sharedState = null;

for (const section of sections) {
  const res = await fetch('/api/timetable/generate', {
    method: 'POST',
    body: JSON.stringify({
      program, year, section,
      teachers, rooms,
      electiveChoices: choices[section],
      sharedState,           // ← pass previous state
    })
  });
  const data = await res.json();
  sharedState = data.updatedState;  // ← save for next section
  timetables[section] = data.grid;
}

// OR use bulk endpoint which handles this automatically:
const res = await fetch('/api/timetable/generate/bulk', {
  method: 'POST',
  body: JSON.stringify({ program, year, sections, teachers, rooms, electiveChoices })
});
```

---

## Excel Column Auto-Detection

The parser automatically detects your column layout. It accepts these column names (case-insensitive):

| Standard Name | Also Accepts |
|---------------|-------------|
| OfficialCode | official_code, program code, progcode |
| pYear | year, academic year, p_year |
| CourseCode | course_code, code, subjectcode |
| CourseTitle | course_title, title, subjectname |
| L | lecture, lectures, lecture hrs |
| T | tutorial, tutorials, t_hrs |
| P | practical, lab, practical hrs |
| CourseType | course_type, type, category |
| BasketName | basket_name, basket, elective basket |

---

## CourseType Reference

| Type | Meaning | Scheduling |
|------|---------|-----------|
| CR | Core Required | All sections, compulsory |
| CR1/CR2 | Core variants | All sections, compulsory |
| CR3A/CR3B | Project/Seminar | Manual scheduling |
| LC | Language/Communication | All sections |
| SEC | Skill Enhancement Elective | Basket-based, student picks one |
| GE | Generic Elective | Basket-based, student picks one |
| SP | Specialization Elective | Basket-based, parallel sections |
| DE | Discipline Elective | Basket-based |
| HC | Honours Core | Honours track only |
| PW | Project Work | Manual scheduling |
