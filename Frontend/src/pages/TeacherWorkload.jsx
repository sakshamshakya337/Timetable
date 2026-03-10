import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { Clock, Users, BookOpen, AlertTriangle } from 'lucide-react';

const SLOT_LABELS = {
  1: '9:00 - 10:00',
  2: '10:00 - 11:00',
  3: '11:00 - 12:00',
  4: '12:00 - 1:00 (Lunch)',
  5: '1:00 - 2:00',
  6: '2:00 - 3:00',
  7: '3:00 - 4:00',
  8: '4:00 - 5:00',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TeacherWorkload = () => {
  const [workloadData, setWorkloadData] = useState({});
  const [teachers, setTeachers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch teachers first
    const teachersRef = ref(db, 'teachers');
    onValue(teachersRef, (snapshot) => {
      if (snapshot.exists()) {
        setTeachers(snapshot.val());
      }
    });

    // Fetch all generated timetables to calculate real-time workload
    const timetablesRef = ref(db, 'generated_timetables');
    onValue(timetablesRef, (snapshot) => {
      if (snapshot.exists()) {
        const timetables = snapshot.val();
        const calculatedWorkload = {};

        // Aggregate data from all sections
        Object.values(timetables).forEach(tt => {
          const processSchedule = (schedule) => {
            if (!schedule) return;
            Object.values(schedule).forEach(daySlots => {
              Object.values(daySlots).forEach(session => {
                if (session && session.teacher && session.teacher !== 'Unassigned' && !session.isGap) {
                  // In our current engine, session.teacher is the Name string
                  // We'll use the name as key for aggregation
                  const teacherName = session.teacher;
                  if (!calculatedWorkload[teacherName]) {
                    calculatedWorkload[teacherName] = {
                      hours: 0,
                      classes: []
                    };
                  }
                  calculatedWorkload[teacherName].hours += 1;
                  calculatedWorkload[teacherName].classes.push({
                    courseCode: session.courseCode,
                    courseTitle: session.courseTitle,
                    section: `${tt.meta.programCode}-${tt.meta.section}`,
                    type: session.type
                  });
                }
              });
            });
          };

          // Since we have G1 and G2, we need to be careful not to double count "Combined" classes
          // Process G1 fully
          processSchedule(tt.scheduleG1);
          
          // Process G2 only for non-combined classes
          if (tt.scheduleG2) {
            Object.keys(tt.scheduleG2).forEach(day => {
              Object.keys(tt.scheduleG2[day]).forEach(slot => {
                const session = tt.scheduleG2[day][slot];
                if (session && session.group !== 'Combined' && !session.isGap) {
                   const teacherName = session.teacher;
                   if (!calculatedWorkload[teacherName]) {
                     calculatedWorkload[teacherName] = { hours: 0, classes: [] };
                   }
                   calculatedWorkload[teacherName].hours += 1;
                }
              });
            });
          }
        });

        setWorkloadData(calculatedWorkload);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Teacher Workload</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Weekly hour distribution and academic load management.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
              <Clock size={24} />
            </div>
            <div>
              <div className="text-sm text-gray-500">Standard Load</div>
              <div className="text-2xl font-bold">21 - 22 Hours</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Users size={24} />
            </div>
            <div>
              <div className="text-sm text-gray-500">Active Faculty</div>
              <div className="text-2xl font-bold">{Object.keys(workloadData).length}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
              <AlertTriangle size={24} />
            </div>
            <div>
              <div className="text-sm text-gray-500">Overload Alerts</div>
              <div className="text-2xl font-bold">{Object.values(workloadData).filter(w => w.hours > 22).length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <th className="p-4 font-bold text-sm">Faculty Name</th>
              <th className="p-4 font-bold text-sm">Weekly Hours</th>
              <th className="p-4 font-bold text-sm w-full">Load Status</th>
              <th className="p-4 font-bold text-sm">Status</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(workloadData)
              .sort((a, b) => b[1].hours - a[1].hours)
              .map(([name, data]) => {
                const percentage = Math.min((data.hours / 22) * 100, 100);
                const isOverloaded = data.hours > 22;
                const isOptimal = data.hours >= 21 && data.hours <= 22;

                return (
                  <tr key={name} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="p-4 font-medium">{name}</td>
                    <td className="p-4 font-bold text-blue-600 dark:text-blue-400">{data.hours} hrs</td>
                    <td className="p-4">
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${isOverloaded ? 'bg-red-500' : isOptimal ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {isOverloaded ? (
                        <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">OVERLOAD</span>
                      ) : isOptimal ? (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">OPTIMAL</span>
                      ) : (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">UNDERLOAD</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {Object.keys(workloadData).length === 0 && (
          <div className="p-12 text-center text-gray-500 italic">
            No workload data available. Generate timetables to see distribution.
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherWorkload;
