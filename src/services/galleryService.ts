import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';

export const CATEGORIES = [
  "Civil Works",
  "Repairs & Maintenance",
  "Hauling Services",
  "Fabrication",
  "IT Services",
  "CCTV Installation"
] as const;

export type Category = typeof CATEGORIES[number];

export async function uploadGalleryImage(file: File, category: Category) {
  if (!file) throw new Error("No file selected");
  if (file.size > 5 * 1024 * 1024) throw new Error("File too large (max 5MB)");

  const storageRef = ref(storage, `gallery/${category}/${Date.now()}_${file.name}`);
  
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  await addDoc(collection(db, "gallery"), {
    imageUrl: url,
    category: category,
    createdAt: new Date().toISOString()
  });
  
  return url;
}

export async function getGalleryImages(category: Category) {
  const q = query(
    collection(db, "gallery"), 
    where("category", "==", category),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as { id: string, imageUrl: string, category: string, createdAt: any }));
}
