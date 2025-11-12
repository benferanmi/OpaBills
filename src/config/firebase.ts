import admin from "firebase-admin";

export const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    try {
      // Option 1: Using service account file (Development)
      const serviceAccount = require("../../firebase-service-account.json");
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log("Firebase Admin initialized successfully");
    } catch (error) {
      console.error("Error initializing Firebase Admin:", error);
      
      // Option 2: Using environment variables (Production)
      // Uncomment and use this in production
      /*
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
      */
    }
  }
};

export default admin;