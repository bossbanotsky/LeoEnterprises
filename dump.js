import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function dump() {
  const snap = await getDocs(collection(db, 'payrolls'));
  const payrolls = [];
  snap.forEach(doc => payrolls.push({ id: doc.id, ...doc.data() }));
  console.log(JSON.stringify(payrolls, null, 2));
  process.exit(0);
}
dump();
