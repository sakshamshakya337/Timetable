import { initializeApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";

const firebaseConfig = {
    apiKey: "dummy",
    authDomain: "dummy",
    databaseURL: "https://timetable-49d6b-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "timetable-49d6b",
    storageBucket: "timetable-49d6b.appspot.com",
    messagingSenderId: "123",
    appId: "123"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function check() {
  const [tSnap, rSnap, subSnap, secSnap] = await Promise.all([
      get(ref(db, 'teachers')),
      get(ref(db, 'rooms')),
      get(ref(db, 'subjects')),
      get(ref(db, 'sections'))
  ]);
  const teachers = tSnap.val() || {};
  const rooms = rSnap.val() || {};
  const subjects = subSnap.val() || {};
  const sections = secSnap.val() || {};

  console.log(`Teachers: ${Object.keys(teachers).length}`);
  console.log(`Rooms: ${Object.keys(rooms).length}`);
  console.log(`Subjects: ${Object.keys(subjects).length}`);
  console.log(`Sections: ${Object.keys(sections).length}`);

  let reqHours = 0;
  for (let s in subjects) {
      reqHours += (parseInt(subjects[s].lectures||0) + parseInt(subjects[s].tutorials||0) + parseInt(subjects[s].practicals||0)*2);
  }
  const totalReq = reqHours * Object.keys(sections).length;
  console.log(`Total Classes Needed: ${totalReq}`);
  console.log(`Total Room Slots: ${Object.keys(rooms).length * 6 * 8}`);
  process.exit(0);
}
check();
