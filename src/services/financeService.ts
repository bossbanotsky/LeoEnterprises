import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDocFromServer, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function recordTransaction(
  accountId: string | null | undefined,
  type: 'income' | 'expense' | 'transfer',
  amount: number,
  category: string,
  description: string,
  referenceId?: string | null,
  uid?: string,
  customDate?: string,
  department?: 'container' | 'junkshop' | 'supplies' | 'other'
) {
  try {
    let finalAccountId = accountId;

    // If no accountId or placeholder, try to find a default one
    if (!finalAccountId || finalAccountId === 'cash-account-id') {
      const { getDocs, query, where, limit } = await import('firebase/firestore');
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
      department: department || 'other',
      description,
      referenceId: referenceId || null,
      date: customDate || new Date().toISOString(),
      createdAt: serverTimestamp(),
      uid: uid || 'system'
    });

    // 2. Update the account balance
    if (finalAccountId) {
      try {
        const accountRef = doc(db, 'accounts', finalAccountId);
        
        let accountSnap;
        try {
          accountSnap = await getDocFromServer(accountRef);
        } catch (serverError: any) {
          console.warn("getDocFromServer failed, falling back to cached getDoc:", serverError);
          accountSnap = await getDoc(accountRef);
        }
        
        if (accountSnap.exists()) {
          await updateDoc(accountRef, {
            balance: increment(type === 'income' ? amount : -amount)
          });
        }
      } catch (accError) {
        console.warn("Failed to update account balance (account likely deleted or network error):", accError);
      }
    }

    return transactionRef.id;
  } catch (error) {
    console.error('Error recording transaction:', error);
    throw error;
  }
}

export async function deleteTransaction(transactionId: string) {
  const txRef = doc(db, 'transactions', transactionId);
  try {
    let txSnap;
    try {
      txSnap = await getDocFromServer(txRef);
    } catch {
      txSnap = await getDoc(txRef);
    }
    
    if (!txSnap.exists()) return;
    const data = txSnap.data();
    
    // Reverse account balance
    if (data.accountId) {
      const accountRef = doc(db, 'accounts', data.accountId);
      let accountSnap;
      try {
        accountSnap = await getDocFromServer(accountRef);
      } catch {
        accountSnap = await getDoc(accountRef);
      }
      
      if (accountSnap.exists()) {
        await updateDoc(accountRef, {
          balance: increment(data.type === 'income' ? -data.amount : data.amount)
        });
      }
    }
    
    await deleteDoc(txRef);
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }
}
