import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyBryQJc_wD3NIIw-RIqXBW4vjO9vbDkB5E",
    authDomain: "timetable-b93ea.firebaseapp.com",
    databaseURL: "https://timetable-b93ea-default-rtdb.firebaseio.com",
    projectId: "timetable-b93ea",
    storageBucket: "timetable-b93ea.firebasestorage.app",
    messagingSenderId: "731402048182",
    appId: "1:731402048182:web:d87216a1e4b9f487268c17"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const functions = getFunctions(app);
export const auth = getAuth(app);
