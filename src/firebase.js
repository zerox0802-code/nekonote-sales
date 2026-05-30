import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBgBAdLHOEPYSzVL5L6DQuf_JF9bVBIlyE",
  authDomain: "nekonote-sales.firebaseapp.com",
  databaseURL: "https://nekonote-sales-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nekonote-sales",
  storageBucket: "nekonote-sales.firebasestorage.app",
  messagingSenderId: "1096285265185",
  appId: "1:1096285265185:web:2e31be83cc522b763b7260"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const dbGet = async (key) => {
  try {
    const snap = await get(ref(db, key));
    return snap.exists() ? snap.val() : null;
  } catch { return null; }
};

export const dbSet = async (key, value) => {
  try {
    await set(ref(db, key), value);
  } catch (e) { console.error(e); }
};
