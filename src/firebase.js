import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get } from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

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
const auth = getAuth(app);

// 🔐 匿名認証：アプリを開いた端末で自動的にFirebaseへ匿名サインインする。
// これにより「auth != null」をルールに設定でき、URLを知っているだけの第三者は
// データベースを直接読み書きできなくなる。
const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      resolve(user);
    } else {
      signInAnonymously(auth).catch((e) => console.error("匿名認証エラー:", e));
    }
  });
});

export const dbGet = async (key) => {
  try {
    await authReady;
    const snap = await get(ref(db, key));
    return snap.exists() ? snap.val() : null;
  } catch { return null; }
};

export const dbSet = async (key, value) => {
  try {
    await authReady;
    await set(ref(db, key), value);
  } catch (e) { console.error(e); }
};
