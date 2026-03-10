import React, { useState, useEffect } from 'react';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Plus, Trash2, Edit, Upload } from 'lucide-react';
import BulkUploadModal from '../components/BulkUploadModal';

const Rooms = () => {
    const [rooms, setRooms] = useState({});
    const [formData, setFormData] = useState({ room_name: '', room_type: 'Classroom', capacity_students: '' });
    const [editingId, setEditingId] = useState(null);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    useEffect(() => {
        const roomsRef = ref(db, 'rooms');
        const unsubscribe = onValue(roomsRef, (snapshot) => {
            if (snapshot.exists()) {
                setRooms(snapshot.val());
            } else {
                setRooms({});
            }
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingId) {
            update(ref(db, `rooms/${editingId}`), formData);
            setEditingId(null);
        } else {
            push(ref(db, 'rooms'), formData);
        }
        setFormData({ room_name: '', room_type: 'Classroom', capacity_students: '' });
    };

    const handleEdit = (id, room) => {
        setFormData(room);
        setEditingId(id);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this room?')) {
            remove(ref(db, `rooms/${id}`));
        }
    };

    const handleBulkUpload = (data) => {
        data.forEach(row => {
            // Handle multiple possible column name variations (case-insensitive)
            const getRoomName = () => {
                return row['Room Name'] || row['room_name'] || row['name'] || 
                       row['Room'] || row['ROOM NAME'] || row['RoomName'] || '';
            };
            
            const getRoomType = () => {
                return row['Room Type'] || row['room_type'] || row['type'] || 
                       row['Type'] || row['ROOM TYPE'] || row['RoomType'] || 'Classroom';
            };
            
            const getCapacity = () => {
                const capacity = row['Capacity (Students)'] || row['Capacity'] || 
                                row['capacity_students'] || row['capacity'] || 
                                row['CAPACITY'] || row['Capacity Students'] || 
                                row['Student Capacity'] || 0;
                return parseInt(capacity, 10) || 0;
            };

            const payload = {
                room_name: getRoomName(),
                room_type: getRoomType(),
                capacity_students: getCapacity()
            };
            
            if (payload.room_name) {
                push(ref(db, 'rooms'), payload);
            }
        });
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 relative">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Manage Rooms</h2>
                <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
                >
                    <Upload size={16} />
                    Import CSV/Excel
                </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <input required name="room_name" placeholder="Room Name (e.g. 101)" value={formData.room_name || ''} onChange={handleChange} className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                <select required name="room_type" value={formData.room_type || 'Classroom'} onChange={handleChange} className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="Classroom">Classroom</option>
                    <option value="Lab">Lab</option>
                </select>
                <input required type="number" name="capacity_students" placeholder="Capacity" value={formData.capacity_students || ''} onChange={handleChange} className="border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2">
                    {editingId ? <Edit size={16} /> : <Plus size={16} />}
                    {editingId ? 'Update Room' : 'Add Room'}
                </button>
            </form>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="border-b dark:border-gray-700">
                        <tr>
                            <th className="p-3 dark:text-gray-300">Room Name</th>
                            <th className="p-3 dark:text-gray-300">Type</th>
                            <th className="p-3 dark:text-gray-300">Capacity</th>
                            <th className="p-3 dark:text-gray-300">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(rooms).map(([id, room]) => (
                            <tr key={id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                                <td className="p-3 dark:text-gray-300">{room.room_name || room.name}</td>
                                <td className="p-3 dark:text-gray-300">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${room.room_type?.toLowerCase().includes('lab') || room.type?.toLowerCase().includes('lab') ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                        {room.room_type || room.type}
                                    </span>
                                </td>
                                <td className="p-3 dark:text-gray-300">{room.capacity_students || room.capacity}</td>
                                <td className="p-3 flex gap-3">
                                    <button onClick={() => handleEdit(id, room)} className="text-blue-500 hover:text-blue-700"><Edit size={18} /></button>
                                    <button onClick={() => handleDelete(id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {Object.keys(rooms).length === 0 && <p className="text-center p-4 text-gray-500">No rooms found.</p>}
            </div>

            <BulkUploadModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                onUpload={handleBulkUpload}
                entityName="Rooms"
                expectedColumns={['Room Name', 'Room Type', 'Capacity (Students)']}
            />
        </div>
    );
};

export default Rooms;
