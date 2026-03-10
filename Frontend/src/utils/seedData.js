import { ref, set } from 'firebase/database';

export const seedMockMCAData = async (db) => {
    try {
        const payload = {
            teachers: {
                "t1": { name: "Dr. Alok Sharma", code: "T101" },
                "t2": { name: "Prof. Bina Roy", code: "T102" },
                "t3": { name: "Mr. Chandan Singh", code: "T103" },
                "t4": { name: "Dr. Divya Gupta", code: "T104" },
                "t5": { name: "Mrs. Esha Patel", code: "T105" },
                "t6": { name: "Dr. Farooq Ali", code: "T106" },
                "t7": { name: "Ms. Geeta Verma", code: "T107" },
                "t8": { name: "Mr. Hari Kumar", code: "T108" },
                "t9": { name: "Dr. Imran Khan", code: "T109" },
                "t10": { name: "Prof. Jaya Menon", code: "T110" },
                "t11": { name: "Dr. Karan Johar", code: "T111" },
                "t12": { name: "Mr. Lalit Modi", code: "T112" }
            },
            rooms: {
                "r1": { name: "38-601", type: "Classroom", capacity: 70 },
                "r2": { name: "38-602", type: "Classroom", capacity: 70 },
                "r3": { name: "38-603", type: "Classroom", capacity: 70 },
                "r4": { name: "38-604", type: "Classroom", capacity: 70 },
                "r5": { name: "38-Lab1", type: "Lab", capacity: 35 },
                "r6": { name: "38-Lab2", type: "Lab", capacity: 35 },
                "r7": { name: "38-Lab3", type: "Lab", capacity: 35 },
                "r8": { name: "38-Lab4", type: "Lab", capacity: 35 }
            },
            sections: {
                "sec1": { name: "MCA Sem-3 Sec-A", semester: "Sem-3", capacity: 60, type: "class" },
                "sec2": { name: "MCA Sem-3 Sec-B", semester: "Sem-3", capacity: 65, type: "class" },
                "sec3": { name: "MCA Sem-3 Sec-C", semester: "Sem-3", capacity: 60, type: "class" }
            },
            subjects: {
                // Core
                "sub_dbms_th": { code: "CAP301", name: "DBMS Theory", type: "CR", lectures: 3, tutorials: 1, practicals: 0, semester: "Sem-3" },
                "sub_dbms_pr": { code: "CAP302", name: "DBMS Practical", type: "CR", lectures: 0, tutorials: 0, practicals: 2, semester: "Sem-3" },
                "sub_os_th": { code: "CAP303", name: "Operating Systems", type: "CR", lectures: 3, tutorials: 0, practicals: 0, semester: "Sem-3" },
                "sub_se_th": { code: "CAP304", name: "Software Engineering", type: "CR", lectures: 3, tutorials: 1, practicals: 0, semester: "Sem-3" },

                // Department Elective 1 (Prog Lang)
                "el1_java_th": { code: "CAP310", name: "Advanced Java", type: "PE", lectures: 2, tutorials: 0, practicals: 0, semester: "Sem-3" },
                "el1_java_pr": { code: "CAP311", name: "Advanced Java Lab", type: "PE", lectures: 0, tutorials: 0, practicals: 2, semester: "Sem-3" },
                "el1_py_th": { code: "CAP312", name: "Python Prog", type: "PE", lectures: 2, tutorials: 0, practicals: 0, semester: "Sem-3" },
                "el1_py_pr": { code: "CAP313", name: "Python Lab", type: "PE", lectures: 0, tutorials: 0, practicals: 2, semester: "Sem-3" },
                "el1_cs_th": { code: "CAP314", name: "C# .NET", type: "PE", lectures: 2, tutorials: 0, practicals: 0, semester: "Sem-3" },
                "el1_cs_pr": { code: "CAP315", name: "C# .NET Lab", type: "PE", lectures: 0, tutorials: 0, practicals: 2, semester: "Sem-3" },

                // Specialization Elective 1 (Domain)
                "el2_ml_th": { code: "CAP320", name: "Machine Learning", type: "SE", lectures: 3, tutorials: 0, practicals: 0, semester: "Sem-3" },
                "el2_ml_pr": { code: "CAP321", name: "Machine Learning Lab", type: "SE", lectures: 0, tutorials: 0, practicals: 2, semester: "Sem-3" },
                "el2_cc_th": { code: "CAP322", name: "Cloud Computing", type: "SE", lectures: 3, tutorials: 0, practicals: 0, semester: "Sem-3" },
                "el2_cc_pr": { code: "CAP323", name: "Cloud Computing Lab", type: "SE", lectures: 0, tutorials: 0, practicals: 2, semester: "Sem-3" },
                "el2_cs_th": { code: "CAP324", name: "Cyber Security", type: "SE", lectures: 3, tutorials: 0, practicals: 0, semester: "Sem-3" },
                "el2_cs_pr": { code: "CAP325", name: "Cyber Security Lab", type: "SE", lectures: 0, tutorials: 0, practicals: 2, semester: "Sem-3" }
            },
            electives: {
                "el_dept_1": {
                    name: "DEPARTMENT ELECTIVE 1",
                    sectionIds: ["sec1", "sec2", "sec3"],
                    offerings: [
                        { theory: "el1_java_th", practical: "el1_java_pr" },
                        { theory: "el1_py_th", practical: "el1_py_pr" },
                        { theory: "el1_cs_th", practical: "el1_cs_pr" }
                    ]
                },
                "el_spec_1": {
                    name: "SPECIALIZATION ELECTIVE 1",
                    sectionIds: ["sec1", "sec2", "sec3"],
                    offerings: [
                        { theory: "el2_ml_th", practical: "el2_ml_pr" },
                        { theory: "el2_cc_th", practical: "el2_cc_pr" },
                        { theory: "el2_cs_th", practical: "el2_cs_pr" }
                    ]
                }
            }
        };

        const updates = {
            'teachers': payload.teachers,
            'rooms': payload.rooms,
            'sections': payload.sections,
            'subjects': payload.subjects,
            'electives': payload.electives,
            'timetable': null // Clear existing timetable
        };

        await set(ref(db), updates);
        alert("Success! Seeded MCA test data into Firebase.");

    } catch (err) {
        console.error("Error seeding data:", err);
        alert("Error seeding data: " + err.message);
    }
};
