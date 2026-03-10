
import React, { useState, useEffect } from 'react';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Plus, Trash2, Edit, Upload } from 'lucide-react';
import BulkUploadModal from '../components/BulkUploadModal';

const Sections = () => {
    const [sections, setSections] = useState({});
    const [formData, setFormData] = useState({ name: '', studentCount: 70, semester: '' });
    const [editingId, setEditingId] = useState(null);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    useEffect(() => {
        const unsubscribe = onValue(ref(db, 'sections'), (snapshot) => {
            setSections(snapshot.val() || {});
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = { ...formData, studentCount: parseInt(formData.studentCount, 10) || 70 };
        if (editingId) {
            update(ref(db, `sections/${editingId}`), payload);
            setEditingId(null);
        } else {
            push(ref(db, 'sections'), payload);
        }
        setFormData({ name: '', studentCount: 70, semester: '' });
    };

    const handleEdit = (id, section) => {
        setFormData({ 
            section_name: section.section_name || section.name || '', 
            max_strength: section.max_strength || section.studentCount || 70, 
            semester: section.semester || '' 
        });
        setEditingId(id);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this section?')) {
            remove(ref(db, `sections/${id}`));
        }
    };

    const handleBulkUpload = (data) => {
        data.forEach(row => {
            const payload = {
                section_name: row['Section Name'] || row['section_name'] || row['name'] || '',
                max_strength: parseInt(row['Max Strength'] || row['max_strength'] || row['students'] || row['Total Students'] || 70, 10),
                semester: row['Semester'] || row['semester'] || ''
            };
            if (payload.section_name) push(ref(db, 'sections'), payload);
        });
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 relative">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Manage Sections</h2>
                <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
                >
                    <Upload size={16} />
                    Import CSV/Excel
                </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <input
                    required name="section_name"
                    placeholder="Section Name (e.g. CS-A)"
                    value={formData.section_name || ''}
                    onChange={handleChange}
                    className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <input
                    required name="semester"
                    placeholder="Semester (e.g. Sem-3)"
                    value={formData.semester || ''}
                    onChange={handleChange}
                    className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <input
                    required type="number" name="max_strength"
                    placeholder="Student Count"
                    value={formData.max_strength || ''}
                    onChange={handleChange}
                    className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2">
                    {editingId ? <Edit size={16} /> : <Plus size={16} />}
                    {editingId ? 'Update Section' : 'Add Section'}
                </button>
            </form>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="border-b dark:border-gray-700">
                        <tr>
                            <th className="p-3 dark:text-gray-300">Section Name</th>
                            <th className="p-3 dark:text-gray-300">Semester</th>
                            <th className="p-3 dark:text-gray-300">Total Students</th>
                            <th className="p-3 dark:text-gray-300 text-center">Group Split</th>
                            <th className="p-3 dark:text-gray-300">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(sections).map(([id, section]) => {
                            const studentCount = parseInt(section.max_strength || section.studentCount || 70, 10);
                            const half = Math.ceil(studentCount / 2);
                            const remainder = studentCount - half;
                            return (
                                <tr key={id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                                    <td className="p-3 dark:text-gray-300 font-medium">{section.section_name || section.name}</td>
                                    <td className="p-3">
                                        {section.semester
                                            ? <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium px-2 py-1 rounded">{section.semester}</span>
                                            : <span className="text-red-400 text-xs font-semibold">⚠ No semester</span>
                                        }
                                    </td>
                                    <td className="p-3 dark:text-gray-300">{studentCount}</td>
                                    <td className="p-3 dark:text-gray-300 text-center text-sm text-gray-500">G1: {half} / G2: {remainder}</td>
                                    <td className="p-3 flex gap-3">
                                        <button onClick={() => handleEdit(id, section)} className="text-blue-500 hover:text-blue-700"><Edit size={18} /></button>
                                        <button onClick={() => handleDelete(id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {Object.keys(sections).length === 0 && <p className="text-center p-4 text-gray-500">No sections found.</p>}
            </div>

            <BulkUploadModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                onUpload={handleBulkUpload}
                entityName="Sections"
                expectedColumns={['Section Name', 'Semester', 'Max Strength']}
            />
        </div>
    );
};

export default Sections;
