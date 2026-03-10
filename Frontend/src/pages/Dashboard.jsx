import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { DatabaseZap, Upload, Loader2, CheckCircle } from 'lucide-react';

const API = 'http://localhost:5000/timetable';

const Dashboard = () => {
    const [counts, setCounts] = useState({
        teachers: 0,
        rooms: 0,
        subjects: 0,
        sections: 0
    });

    const [uploading, setUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const refs = ['teachers', 'rooms', 'subjects', 'sections'];
        const unsubscribes = refs.map(path => {
            const dbRef = ref(db, path);
            return onValue(dbRef, (snapshot) => {
                const data = snapshot.val() || {};
                setCounts(prev => ({ ...prev, [path]: Object.keys(data).length }));
            });
        });

        return () => unsubscribes.forEach(unsub => unsub());
    }, []);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setUploadSuccess(null);

        const formData = new FormData();
        formData.append('excel', file);

        try {
            const res = await fetch(`${API}/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to upload');
            }

            setUploadSuccess(`Successfully loaded ${data.meta.totalPrograms} programs and ${data.meta.totalCourses} courses!`);

            // clear success msg after 5s
            setTimeout(() => setUploadSuccess(null), 5000);
        } catch (error) {
            alert(`Error uploading file: ${error.message}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = ''; // reset file input
            }
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold dark:text-white">Dashboard Overview</h2>

                <div className="flex items-center gap-4">
                    {uploadSuccess && (
                        <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
                            <CheckCircle size={16} /> {uploadSuccess}
                        </span>
                    )}

                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded shadow transition-colors font-semibold"
                    >
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        {uploading ? 'Uploading...' : 'Upload Master Excel'}
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Teachers', value: counts.teachers },
                    { label: 'Total Rooms', value: counts.rooms },
                    { label: 'Total Subjects', value: counts.subjects },
                    { label: 'Total Sections', value: counts.sections }
                ].map(stat => (
                    <div key={stat.label} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{stat.label}</p>
                        <p className="text-3xl font-semibold dark:text-white">{stat.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
