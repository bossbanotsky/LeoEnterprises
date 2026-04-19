import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

async function fix() {
  console.log('Fetching all paid bulk payrolls...');
  const bulkQ = query(collection(db, 'bulkPayrolls'), where('status', '==', 'paid'));
  const bulkSnap = await getDocs(bulkQ);
  
  const paidBulkIds = bulkSnap.docs.map(d => d.id);
  console.log(`Found ${paidBulkIds.length} paid bulk runs.`);

  if (paidBulkIds.length === 0) return;

  const payrollSnap = await getDocs(collection(db, 'payrolls'));
  console.log(`Found ${payrollSnap.size} total individual payrolls.`);

  let fixCount = 0;
  for (const p of payrollSnap.docs) {
    const data = p.data();
    if (data.bulkId && paidBulkIds.includes(data.bulkId) && data.status !== 'paid') {
      console.log(`Fixing payroll ${p.id} (for bulk ${data.bulkId})`);
      await updateDoc(doc(db, 'payrolls', p.id), { status: 'paid' });
      fixCount++;
    }
  }

  console.log(`Fixed ${fixCount} payroll records. Exiting.`);
  process.exit(0);
}

fix().catch(console.error);
