const admin = require("firebase-admin");
require("dotenv").config();

let db = null;

try {
    let credential;

    // 1. Try to use service account credentials from .env if they exist
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        console.log("✓ Found Firebase service account credentials in .env");
        credential = admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
    } 
    // 2. Fallback to applicationDefault()
    else {
        console.warn("⚠ WARNING: Firebase credentials (PRIVATE_KEY/CLIENT_EMAIL) not set in .env");
        console.warn("⚠ Falling back to applicationDefault() - this may not work");
        credential = admin.credential.applicationDefault();
    }

    const config = {
        credential,
        databaseURL: process.env.FIREBASE_DATABASE_URL
    };

    if (!process.env.FIREBASE_DATABASE_URL) {
        throw new Error('FIREBASE_DATABASE_URL is not set in .env file');
    }

    if (admin.apps.length === 0) {
        admin.initializeApp(config);
        console.log("✓ Firebase Admin initialized successfully");
        console.log(`✓ Database URL: ${process.env.FIREBASE_DATABASE_URL}`);
    }

    db = admin.database();
    console.log("✓ Firebase Realtime Database connected");
} catch (error) {
    console.error("❌ Firebase Admin initialization error:", error.message);
    console.error("❌ Stack:", error.stack);
    console.warn("⚠ Server will continue but database operations will fail");
    console.warn("⚠ Please check your .env file and Firebase credentials");
    
    // Create a mock db object that throws helpful errors
    db = {
        ref: () => {
            throw new Error('Firebase database not initialized. Check server logs for details.');
        }
    };
}

module.exports = db;
