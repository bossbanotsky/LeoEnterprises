import { storage, db, auth } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot } from 'firebase/storage';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';

export const CATEGORIES = [
  "Civil Works",
  "Repairs & Maintenance",
  "Hauling Services",
  "Fabrication",
  "IT Services",
  "CCTV Installation"
] as const;

export type Category = typeof CATEGORIES[number];

export async function uploadImage(file: File, category: Category, onProgress: (progress: number) => void) {
  try {
    if (!file) {
      throw new Error("No file selected");
    }

    if (!category) {
      throw new Error("Please select a category");
    }

    console.log("Starting upload...");
    console.log("File:", file.name);
    console.log("Category:", category);

    // ✅ Convert category to safe format
    const safeCategory = category
      .toLowerCase()
      .replace(/ & /g, "-")
      .replace(/ /g, "-");

    const storageRef = ref(storage, `gallery/${safeCategory}/${Date.now()}-${file.name}`);

    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log("Upload progress:", progress + "%");
          onProgress(progress);
        },
        (error) => {
          console.error("Upload failed:", error);
          reject(new Error("Upload failed: " + error.message));
        },
        async () => {
          console.log("Upload completed");

          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          await addDoc(collection(db, "gallery"), {
            imageUrl: downloadURL,
            category: category, // keep original for UI
            createdAt: serverTimestamp(),
          });

          console.log("Saved to Firestore");
          resolve("Upload successful!");
        }
      );
    });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    throw new Error("Error: " + error.message);
  }
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
