# Smart Timetable Scheduling System

An advanced, constraint-based timetable scheduling application built with React and Firebase. This system automates the complex process of generating university/college timetables while adhering to strict academic rules, resource availability, and workload distribution.

## 🚀 Features

### Core Scheduling Capabilities
- **Automated Generation**: Heuristic-based backtracking algorithm to generate conflict-free timetables.
- **Constraint Management**:
  - **Hard Constraints**: No double bookings (Teacher/Room), No Section/Group clashes, Lab requirements for practicals.
  - **Soft Constraints**: Teacher workload balancing (21-22 hrs/week), Daily gap rules.
- **Mid-Day Gap Rule**: Enforces a mandatory break for every section between 11:00 AM – 2:00 PM (at least one slot free).
- **Split Sessions**: Handles combined Lectures (All students) and split Practical sessions (G1/G2 groups).

### User Interface & Management
- **Interactive Dashboard**: Manage Teachers, Rooms, Subjects, and Sections.
- **Bulk Data Import**: Support for uploading data via Excel/CSV (using `xlsx` and `papaparse`).
- **Visual Timetable**: Grid-based view of the generated schedule with filtering options.
- **Room & Teacher Views**: Specific views to check room utilization and teacher schedules.

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Routing**: [React Router](https://reactrouter.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management**: React Hooks (useState, useEffect)

### Backend & Database
- **Cloud Functions**: [Firebase Cloud Functions](https://firebase.google.com/docs/functions) (Node.js 18) for server-side scheduling logic.
- **Database**: [Firebase Realtime Database](https://firebase.google.com/docs/database) for storing institution data and generated timetables.

## 📋 System Constraints & Rules

The system is configured to handle the following scale and rules:

### Institution Data
- **Teachers**: ~24
- **Rooms**: ~60 (Classrooms + Labs)
- **Subjects**: ~25 (L-T-P structure)
- **Sections**: ~20 (divided into G1/G2)

### Scheduling Rules
- **Working Days**: 5 (Monday–Friday)
- **Time Slots**: 9:00 AM – 5:00 PM (8 slots/day)
- **Workload**: Teachers must have 21-22 hours/week.
- **Gap Policy**:
  - Max 2 consecutive free slots.
  - Max 5 classes per section/day.
  - Max 3 consecutive classes per teacher.

## 📂 Project Structure

```
TimeTable/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages (Dashboard, Timetable, etc.)
│   │   ├── utils/          # Helper functions including scheduler.js (Client-side logic)
│   │   └── ...
│   ├── public/             # Static assets
│   └── ...
├── functions/              # Firebase Cloud Functions
│   ├── index.js            # Entry point
│   ├── scheduler.js        # Server-side scheduling logic
│   └── ...
├── firebase.json           # Firebase configuration
└── database.rules.json     # Database security rules
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TimeTable
   ```

2. **Setup Frontend**
   ```bash
   cd frontend
   npm install
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

### Backend Setup (Firebase)
To deploy or run the cloud functions:
1. Navigate to `functions/`:
   ```bash
   cd functions
   npm install
   ```
2. Deploy to Firebase (requires Firebase CLI):
   ```bash
   firebase deploy --only functions
   ```

## 🧪 Testing

The project includes test scripts for validating the scheduling algorithms:
- `test_algo.js`: Validates the core scheduling logic.
- `test_check.js`: Checks for basic data integrity.
- `test_clash.js`: Detects conflicts in the generated timetable.

To run tests (from `frontend/` directory):
```bash
node test_algo.js
```
