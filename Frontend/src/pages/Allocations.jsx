import React, { useState, useEffect } from 'react';
import { ref, onValue, set, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { Save, AlertCircle, PlusCircle, Trash2, CheckCircle2 } from 'lucide-react';

const Allocations = () => {
    const [allocations, setAllocations] = useState({});
    const [teachers, setTeachers] = useState({});
    const [subjects, setSubjects] = useState({});
    const [sections, setSections] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);

    // Filter dropdown states
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');

    useEffect(() => {
        const refs = [
            { path: 'allocations', setter: setAllocations },
            { path: 'teachers', setter: setTeachers },
            { path: 'subjects', setter: setSubjects },
            { path: 'sections', setter: setSections }
        ];

        const unsubscribes = refs.map(({ path, setter }) =>
            onValue(ref(db, path), snap => setter(snap.val() || {}))
        );

        return () => unsubscribes.forEach(unsub => unsub());
    }, []);

    const addAllocation = (sectionId, subjectId, group = 'Combined') => {
        if (!sectionId || !subjectId) {
            alert("Please select a valid Section and Subject first.");
            return;
        }

        const newId = `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const payload = { sectionId, subjectId, group, teacherId: '' };

        set(ref(db, `allocations/${newId}`), payload)
            .catch(err => alert("Failed to add block: " + err.message));
    };

    const updateAllocation = (id, field, value) => {
        update(ref(db, `allocations/${id}`), { [field]: value })
            .catch(err => alert("Failed to update: " + err.message));
    };

    const deleteAllocation = (id) => {
        if (window.confirm("Remove this exact mapping?")) {
            remove(ref(db, `allocations/${id}`));
        }
    };

    // Client-side Validation: One teacher can teach max 2 sections for the SAME subject theory
    const validateAllocations = () => {
        const warnings = [];
        const teacherSubjectMap = {}; // { teacherId_subjectId: Set(sectionIds) }

        Object.values(allocations).forEach(alloc => {
            if (!alloc.teacherId || !alloc.subjectId || !alloc.sectionId) return;
            // E.g. Dr. Alok teaching OS Theory (Combined)
            if (alloc.group === 'Combined' || alloc.group === 'G:All') {
                const key = `${alloc.teacherId}_${alloc.subjectId}`;
                if (!teacherSubjectMap[key]) teacherSubjectMap[key] = new Set();
                teacherSubjectMap[key].add(alloc.sectionId);
            }
        });

        Object.entries(teacherSubjectMap).forEach(([key, sectionSet]) => {
            if (sectionSet.size > 2) {
                const [tId, sId] = key.split('_');
                const tName = teachers[tId]?.name || tId;
                const sName = subjects[sId]?.code || sId;
                warnings.push(`Warning: ${tName} is mapped to >2 sections (${sectionSet.size}) for ${sName}. They may hit their workload limit.`);
            }
        });
        return warnings;
    };

    const warnings = validateAllocations();

    // Organize current view
    const filteredAllocations = Object.entries(allocations).filter(([id, alloc]) => {
        if (selectedSection && alloc.sectionId !== selectedSection) return false;
        if (selectedSubject && alloc.subjectId !== selectedSubject) return false;
        return true;
    });

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold dark:text-white">Strict Mappings</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Bind specific teachers explicitly to Sub-Sections (G1/G2/Combined).</p>
                </div>
            </div>

            {warnings.length > 0 && (
                <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-400 font-bold mb-2">
                        <AlertCircle size={18} /> Review Mapping Loads
                    </div>
                    <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-500 space-y-1">
                        {warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                </div>
            )}

            {/* Top Toolbar */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-700 mb-6 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Filter / Target Section</label>
                    <select
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        className="w-full border rounded p-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">-- All Sections --</option>
                        {Object.entries(sections).map(([id, sec]) => (
                            <option key={id} value={id}>{sec.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Filter / Target Subject</label>
                    <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="w-full border rounded p-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">-- All Subjects --</option>
                        {Object.entries(subjects).map(([id, sub]) => (
                            <option key={id} value={id}>[{sub.code}] {sub.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={() => addAllocation(selectedSection, selectedSubject, 'Combined')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium whitespace-nowrap"
                >
                    <PlusCircle size={16} /> Assign Slot Block
                </button>
            </div>

            {/* Grid */}
            <div className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-900 border-b dark:border-gray-700">
                        <tr>
                            <th className="p-3 font-semibold dark:text-gray-200">Section Target</th>
                            <th className="p-3 font-semibold dark:text-gray-200">Subject Bound</th>
                            <th className="p-3 font-semibold dark:text-gray-200">Group Scope</th>
                            <th className="p-3 font-semibold dark:text-gray-200">Appointed Teacher</th>
                            <th className="p-3 font-semibold dark:text-gray-200 w-16 text-center">Unbind</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAllocations.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No explicit associations built yet. Select filters and click "Assign Slot Block".<br />
                                    <span className="text-xs">(Any unassigned slot will be auto-calculated)</span>
                                </td>
                            </tr>
                        ) : (
                            filteredAllocations.map(([id, alloc]) => (
                                <tr key={id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750/50">
                                    <td className="p-2">
                                        <select
                                            value={alloc.sectionId}
                                            onChange={(e) => updateAllocation(id, 'sectionId', e.target.value)}
                                            className="w-full border rounded p-1.5 text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        >
                                            <option value="">- Select Section -</option>
                                            {Object.entries(sections).map(([sId, sec]) => (
                                                <option key={sId} value={sId}>{sec.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select
                                            value={alloc.subjectId}
                                            onChange={(e) => updateAllocation(id, 'subjectId', e.target.value)}
                                            className="w-full border rounded p-1.5 text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        >
                                            <option value="">- Select Subject -</option>
                                            {Object.entries(subjects).map(([subId, sub]) => (
                                                <option key={subId} value={subId}>[{sub.code}] {sub.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select
                                            value={alloc.group}
                                            onChange={(e) => updateAllocation(id, 'group', e.target.value)}
                                            className="w-full border rounded p-1.5 text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        >
                                            <option value="Combined">Combined (Theory)</option>
                                            <option value="G1">Group 1 Only (Prac/Tut)</option>
                                            <option value="G2">Group 2 Only (Prac/Tut)</option>
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select
                                            value={alloc.teacherId}
                                            onChange={(e) => updateAllocation(id, 'teacherId', e.target.value)}
                                            className={`w-full border rounded p-1.5 text-xs font-semibold ${alloc.teacherId ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 dark:text-white'}`}
                                        >
                                            <option value="">- MUST SELECT TEACHER -</option>
                                            {Object.entries(teachers).map(([tId, t]) => (
                                                <option key={tId} value={tId}>{t.name} (Max 22h)</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => deleteAllocation(id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <p>Changes construct live onto Firebase. Scheduler will consume them instantly upon run.</p>
                <div className="flex gap-2 items-center text-green-600">
                    <CheckCircle2 size={16} /> Saved
                </div>
            </div>
        </div>
    );
};

export default Allocations;
