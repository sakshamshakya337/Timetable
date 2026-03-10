import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';

const API = 'http://localhost:5000/timetable';

const Electives = () => {
    const [baskets, setBaskets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        fetch(`${API}/electives`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setBaskets(data.baskets || []);
                } else {
                    setError('Failed to load electives from server.');
                }
            })
            .catch(err => {
                console.error(err);
                setError('Could not connect to the backend server.');
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 dark:text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3">Loading Electives...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl m-6">
                {error}
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 relative min-h-[calc(100vh-100px)]">
            <header className="mb-8">
                <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                    <BookOpen className="text-purple-600" /> Course Master Electives
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                    Showing {baskets.length} elective baskets auto-detected from the Excel Course Master.
                </p>
            </header>

            {baskets.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-gray-500 italic">No electives found in the current Course Master.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {baskets.map((basket, idx) => (
                        <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-purple-700 dark:text-purple-400">{basket.label}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">{basket.basketName}</p>
                                </div>
                                <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-bold rounded-full uppercase tracking-wider border border-purple-200 dark:border-purple-800">
                                    {basket.courseTypeLabel || basket.courseType}
                                </span>
                            </div>

                            <div className="mb-4">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Applicable Programs</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {basket.programs.map(prog => (
                                        <span key={prog} className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] px-2 py-0.5 rounded-md font-medium">
                                            {prog}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex justify-between">
                                    <span>Options ({basket.optionCount})</span>
                                </div>
                                <div className="space-y-2">
                                    {basket.options.map((opt, oIdx) => (
                                        <div key={oIdx} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg p-3 flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{opt.courseCode}</div>
                                                <div className="text-xs text-gray-500 line-clamp-1">{opt.courseTitle}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-400">
                                                    L:{opt.L} T:{opt.T} P:{opt.P}
                                                </div>
                                                <div className="text-[9px] text-gray-400 mt-1 uppercase">
                                                    {opt.isLab ? 'Lab' : 'Theory'} • {opt.subjectType}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Electives;
