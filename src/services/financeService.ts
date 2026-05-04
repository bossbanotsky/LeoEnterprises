import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';

export async function recordTransaction(
  accountId: string | null | undefined,
  type: 'income' | 'expense' | 'transfer',
  amount: number,
  category: string,
  description: string,
  referenceId?: string,
  uid?: string
) {
  try {
    let finalAccountId = accountId;

    // If no accountId or placeholder, try to find a default one
    if (!finalAccountId || finalAccountId === 'cash-account-id') {
      const q = query(collection(db, 'accounts'), where('isDefault', '==', true), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        finalAccountId = snap.docs[0].id;
      } else {
        // Fallback: search for any cash account
        const qCash = query(collection(db, 'accounts'), where('type', '==', 'cash'), limit(1));
        const snapCash = await getDocs(qCash);
        if (!snapCash.empty) {
          finalAccountId = snapCash.docs[0].id;
        } else {
           // Fallback: search for any account
           const qAny = query(collection(db, 'accounts'), limit(1));
           const snapAny = await getDocs(qAny);
           if (!snapAny.empty) {
             finalAccountId = snapAny.docs[0].id;
           } else {
             console.warn("No financial account found to record transaction. Transaction skipped. Please create an account in Finance module.");
             return null;
           }
        }
      }
    }

    // 1. Record the transaction in the ledger
    const transactionRef = await addDoc(collection(db, 'transactions'), {
      accountId: finalAccountId,
      type,
      amount,
      category,
      description,
      referenceId,
      date: new Date().toISOString(),
      createdAt: serverTimestamp(),
      uid: uid || 'system'
    });

    // 2. Update the account balance
    const accountRef = doc(db, 'accounts', finalAccountId!);
    await updateDoc(accountRef, {
      balance: increment(type === 'income' ? amount : -amount)
    });

    return transactionRef.id;
  } catch (error) {
    console.error('Error recording transaction:', error);
    throw error;
  }
}
