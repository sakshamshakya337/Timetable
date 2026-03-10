
import React, { useState, useEffect } from 'react';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Plus, Trash2, Edit, Upload } from 'lucide-react';
import BulkUploadModal from '../components/BulkUploadModal';

const Subjects = () => {
    const [subjects, setSubjects] = useState({});
    const [formData, setFormData] = useState({
        name: '', code: '', lectures: 0, tutorials: 0, practicals: 0,
        credits: 0, type: 'CR', faculty: '', semester: ''
    });
    const [editingId, setEditingId] = useState(null);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    useEffect(() => {
        const unsubscribe = onValue(ref(db, 'subjects'), snap => setSubjects(snap.val() || {}));
        return () => unsubscribe();
    }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = { ...formData };
        if (editingId) {
            update(ref(db, `subjects/${editingId}`), payload);
            setEditingId(null);
        } else {
            push(ref(db, 'subjects'), payload);
        }
        setFormData({ name: '', code: '', lectures: 0, tutorials: 0, practicals: 0, credits: 0, type: 'CR', faculty: '', semester: '' });
    };

    const handleEdit = (id, subject) => {
        setFormData({
            course_title: subject.course_title || subject.name || '',
            course_code: subject.course_code || subject.code || '',
            l_lecture: subject.l_lecture || subject.lectures || 0,
            t_tutorial: subject.t_tutorial || subject.tutorials || 0,
            p_practical: subject.p_practical || subject.practicals || 0,
            credits: subject.credits || 0,
            course_type: subject.course_type || subject.type || 'CR',
            faculty: subject.faculty || '',
            semester: subject.semester || ''
        });
        setEditingId(id);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this subject?')) {
            remove(ref(db, `subjects/${id}`));
        }
    };

    const handleBulkUpload = (data) => {
        data.forEach(row => {
            const payload = {
                course_title: row['Course Title'] || row['course_title'] || row['name'] || '',
                course_code: row['Course Code'] || row['course_code'] || row['code'] || '',
                l_lecture: parseInt(row['L (Lecture)'] || row['l_lecture'] || row['lectures'] || row['L'] || 0, 10),
                t_tutorial: parseInt(row['T (Tutorial)'] || row['t_tutorial'] || row['tutorials'] || row['T'] || 0, 10),
                p_practical: parseInt(row['P (Practical)'] || row['p_practical'] || row['practicals'] || row['P'] || 0, 10),
                credits: parseInt(row['Credits'] || row['credits'] || 0, 10),
                course_type: row['Course Type'] || row['course_type'] || row['type'] || 'CR',
                faculty: row['Faculty'] || row['faculty'] || '',
                semester: row['Semester'] || row['semester'] || ''
            };
            if (payload.course_title && payload.course_code) push(ref(db, 'subjects'), payload);
        });
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 relative">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Manage Subjects</h2>
                <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
                >
                    <Upload size={16} />
                    Import CSV/Excel
                </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-9 gap-3 mb-8 items-end">
                <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Course Title</label>
                    <input required name="course_title" placeholder="e.g. PROGRAMMING IN JAVA" value={formData.course_title || ''} onChange={handleChange} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Course Code</label>
                    <input required name="course_code" placeholder="CAP477" value={formData.course_code || ''} onChange={handleChange} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Semester</label>
                    <input required name="semester" placeholder="e.g. Sem-3" value={formData.semester || ''} onChange={handleChange} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Type</label>
                    <input required name="course_type" placeholder="CR" value={formData.course_type || ''} onChange={handleChange} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">L</label>
                    <input required type="number" min="0" name="l_lecture" value={formData.l_lecture || 0} onChange={handleChange} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">T</label>
                    <input required type="number" min="0" name="t_tutorial" value={formData.t_tutorial || 0} onChange={handleChange} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">P</label>
                    <input required type="number" min="0" name="p_practical" value={formData.p_practical || 0} onChange={handleChange} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Credits</label>
                    <input required type="number" min="0" name="credits" value={formData.credits || 0} onChange={handleChange} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div className="md:col-span-3">
                    <label className="text-xs text-gray-500 mb-1 block">Faculty ( Block - Room - Cabin )</label>
                    <input name="faculty" placeholder="Dr. XYZ ( 38-601-CH5 )" value={formData.faculty || ''} onChange={handleChange} className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div className="md:col-span-6 flex justify-end">
                    <button type="submit" className="bg-blue-600 text-white p-2 px-6 rounded hover:bg-blue-700 flex items-center justify-center gap-2 w-full md:w-auto mt-2">
                        {editingId ? <Edit size={16} /> : <Plus size={16} />}
                        {editingId ? 'Update Subject' : 'Add Subject'}
                    </button>
                </div>
            </form>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
                        <tr>
                            <th className="p-3 font-semibold dark:text-gray-200">Code</th>
                            <th className="p-3 font-semibold dark:text-gray-200">Semester</th>
                            <th className="p-3 font-semibold dark:text-gray-200">Type</th>
                            <th className="p-3 font-semibold dark:text-gray-200 min-w-[200px]">Course Title</th>
                            <th className="p-3 font-semibold dark:text-gray-200 text-center">L</th>
                            <th className="p-3 font-semibold dark:text-gray-200 text-center">T</th>
                            <th className="p-3 font-semibold dark:text-gray-200 text-center">P</th>
                            <th className="p-3 font-semibold dark:text-gray-200 text-center">Credits</th>
                            <th className="p-3 font-semibold dark:text-gray-200 min-w-[200px]">Faculty</th>
                            <th className="p-3 font-semibold dark:text-gray-200">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(subjects).map(([id, subject]) => (
                            <tr key={id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                                <td className="p-3 dark:text-gray-300 font-medium">{subject.course_code || subject.code}</td>
                                <td className="p-3">
                                    {subject.semester
                                        ? <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium px-2 py-1 rounded">{subject.semester}</span>
                                        : <span className="text-red-400 text-xs font-semibold">⚠ No semester</span>
                                    }
                                </td>
                                <td className="p-3 dark:text-gray-300">{subject.course_type || subject.type || 'CR'}</td>
                                <td className="p-3 dark:text-gray-300 whitespace-normal">{subject.course_title || subject.name}</td>
                                <td className="p-3 dark:text-gray-300 text-center">{subject.l_lecture || subject.lectures || 0}</td>
                                <td className="p-3 dark:text-gray-300 text-center">{subject.t_tutorial || subject.tutorials || 0}</td>
                                <td className="p-3 dark:text-gray-300 text-center">{subject.p_practical || subject.practicals || 0}</td>
                                <td className="p-3 dark:text-gray-300 text-center">{subject.credits || 0}</td>
                                <td className="p-3 dark:text-gray-400 text-xs whitespace-normal">{subject.faculty || 'Unassigned'}</td>
                                <td className="p-3 flex gap-3">
                                    <button onClick={() => handleEdit(id, subject)} className="text-blue-500 hover:text-blue-700"><Edit size={16} /></button>
                                    <button onClick={() => handleDelete(id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {Object.keys(subjects).length === 0 && <p className="text-center p-4 text-gray-500">No subjects found.</p>}
            </div>

            <BulkUploadModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                onUpload={handleBulkUpload}
                entityName="Subjects"
                expectedColumns={['Course Code', 'Course Title', 'Semester', 'L', 'T', 'P']}
            />
        </div>
    );
};

export default Subjects;
