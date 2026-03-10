import React, { useState, useEffect } from 'react';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Plus, Trash2, Edit, Upload } from 'lucide-react';
import BulkUploadModal from '../components/BulkUploadModal';

const Teachers = () => {
    const [teachers, setTeachers] = useState({});
    const [formData, setFormData] = useState({ name: '', initial: '', department: '' });
    const [editingId, setEditingId] = useState(null);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    useEffect(() => {
        const teachersRef = ref(db, 'teachers');
        const unsubscribe = onValue(teachersRef, (snapshot) => {
            if (snapshot.exists()) {
                setTeachers(snapshot.val());
            } else {
                setTeachers({});
            }
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingId) {
            update(ref(db, `teachers/${editingId}`), formData);
            setEditingId(null);
        } else {
            push(ref(db, 'teachers'), formData);
        }
        setFormData({ name: '', initial: '', department: '' });
    };

    const handleEdit = (id, teacher) => {
        setFormData(teacher);
        setEditingId(id);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this teacher?')) {
            remove(ref(db, `teachers/${id}`));
        }
    };

    const handleBulkUpload = (data) => {
        // Data is an array of objects
        data.forEach(row => {
            const payload = {
                full_name: row['Full Name'] || row['full_name'] || row['name'] || '',
                designation: row['Designation'] || row['designation'] || '',
                department: row['Department'] || row['department'] || ''
            };
            if (payload.full_name) {
                push(ref(db, 'teachers'), payload);
            }
        });
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 relative">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Manage Teachers</h2>
                <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
                >
                    <Upload size={16} />
                    Import CSV/Excel
                </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <input required name="full_name" placeholder="Teacher Name" value={formData.full_name || ''} onChange={handleChange} className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                <input required name="designation" placeholder="Designation (e.g. Assistant Professor)" value={formData.designation || ''} onChange={handleChange} className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                <input required name="department" placeholder="Department" value={formData.department || ''} onChange={handleChange} className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2">
                    {editingId ? <Edit size={16} /> : <Plus size={16} />}
                    {editingId ? 'Update Teacher' : 'Add Teacher'}
                </button>
            </form>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="border-b dark:border-gray-700">
                        <tr>
                            <th className="p-3 dark:text-gray-300">Name</th>
                            <th className="p-3 dark:text-gray-300">Designation</th>
                            <th className="p-3 dark:text-gray-300">Department</th>
                            <th className="p-3 dark:text-gray-300">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(teachers).map(([id, teacher]) => (
                            <tr key={id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                                <td className="p-3 dark:text-gray-300">{teacher.full_name || teacher.name}</td>
                                <td className="p-3 dark:text-gray-300">{teacher.designation || teacher.initial}</td>
                                <td className="p-3 dark:text-gray-300">{teacher.department}</td>
                                <td className="p-3 flex gap-3">
                                    <button onClick={() => handleEdit(id, teacher)} className="text-blue-500 hover:text-blue-700"><Edit size={18} /></button>
                                    <button onClick={() => handleDelete(id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {Object.keys(teachers).length === 0 && <p className="text-center p-4 text-gray-500">No teachers found.</p>}
            </div>

            <BulkUploadModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                onUpload={handleBulkUpload}
                entityName="Teachers"
                expectedColumns={['Full Name', 'Designation', 'Department']}
            />
        </div>
    );
};

export default Teachers;
