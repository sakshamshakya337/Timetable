import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Teachers from './pages/Teachers';
import Rooms from './pages/Rooms';
import Subjects from './pages/Subjects';
import Electives from './pages/Electives';
import Allocations from './pages/Allocations';
import Sections from './pages/Sections';
import Timetable from './pages/Timetable';
import TeacherWorkload from './pages/TeacherWorkload';
import SavedTimetables from './pages/SavedTimetables';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="teachers" element={<Teachers />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="subjects" element={<Subjects />} />
          <Route path="electives" element={<Electives />} />
          <Route path="allocations" element={<Allocations />} />
          <Route path="sections" element={<Sections />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="teacher-workload" element={<TeacherWorkload />} />
          <Route path="saved-timetables" element={<SavedTimetables />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
