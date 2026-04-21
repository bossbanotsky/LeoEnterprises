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
    if (!file) throw new Error("No file selected");
    if (!category) throw new Error("Please select a category");

    onProgress(10); // Start
    await new Promise(resolve => setTimeout(resolve, 50)); // Yield to paint 10%

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        onProgress(30);

        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = async () => {
          onProgress(50);
          await new Promise(r => setTimeout(r, 50)); // Yield to paint 50%
          
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_SIZE = 1200;
          if (width > height && width > MAX_SIZE) {
             height *= MAX_SIZE / width;
             width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
             width *= MAX_SIZE / height;
             height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const base64Url = canvas.toDataURL('image/jpeg', 0.6); // 60% quality jpeg
          
          onProgress(80);
          await new Promise(r => setTimeout(r, 50)); // Yield to paint 80%

          // Check size (Firestore limit is ~1MB limit per document, keeping it safely below 900KB)
          const sizeInBytes = (base64Url.length * 3) / 4;
          if (sizeInBytes > 900000) {
            reject(new Error("Image is too large even after compression. Please select a smaller or simpler image."));
            return;
          }

          try {
             await addDoc(collection(db, "gallery"), {
               imageUrl: base64Url,
               category: category,
               createdAt: serverTimestamp(),
             });
             onProgress(100);
             resolve("Upload successful!");
          } catch (err: any) {
             reject(new Error("Firestore Error: " + err.message));
          }
        };
        img.onerror = () => reject(new Error("Failed to parse image file"));
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
    });
  } catch (error: any) {
    throw new Error("Error: " + error.message);
  }
}

export async function addVideoUrl(url: string, category: Category) {
  try {
    if (!url) throw new Error("No URL provided");
    if (!category) throw new Error("Please select a category");

    await addDoc(collection(db, "videos"), {
      videoUrl: url,
      category: category,
      createdAt: serverTimestamp(),
    });
    return "Video added successfully!";
  } catch (error: any) {
    throw new Error("Error adding video: " + error.message);
  }
}

export async function uploadVideoFile(file: File, category: Category, onProgress: (progress: number) => void) {
  return new Promise(async (resolve, reject) => {
    if (!file) {
      reject(new Error("No file selected"));
      return;
    }
    if (!category) {
      reject(new Error("Please select a category"));
      return;
    }
    
    // File size limit (e.g., 500MB) to prevent filling storage instantly, but allow large uploads
    const MAX_VIDEO_SIZE = 500 * 1024 * 1024; 
    if (file.size > MAX_VIDEO_SIZE) {
      reject(new Error(`Video is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please upload a file smaller than 500MB, or use the 'Embed Link' option instead.`));
      return;
    }

    try {
      // Basic connectivity test to see if bucket exists. 
      // If the bucket isn't initialized in Firebase Console, this typically fails or returns 404/400.
      const bucketUrl = `https://firebasestorage.googleapis.com/v0/b/${storage.app.options.storageBucket}/o`;
      const res = await fetch(bucketUrl);
      if (res.status === 404) {
        reject(new Error("Cloud Storage is not enabled yet! Please go to your Firebase Console, click 'Storage' on the left menu, and click 'Get Started' to enable it."));
        return;
      }
    } catch (e) {
      // Ignore fetch errors (like CORS if rules block reading the root), 
      // because actual uploadBytesResumable might still work depending on rules.
    }

    // Direct Firebase Storage Upload (Bypasses Firestore 1MB limits to save space)
    const storageRef = ref(storage, `videos/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    let progressStarted = false;
    
    // Timeout to detect if the upload task hangs indefinitely at 0% (common when bucket isn't setup)
    const stallTimeout = setTimeout(() => {
      if (!progressStarted) {
        uploadTask.cancel();
        reject(new Error("Upload stuck at 0%. Your Cloud Storage bucket might not be fully initialized or your storage.rules are blocking uploads. Please visit Firebase Console -> Storage to verify."));
      }
    }, 10000);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.bytesTransferred > 0) {
          progressStarted = true;
          clearTimeout(stallTimeout);
        }
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(progress);
      },
      (error) => {
        clearTimeout(stallTimeout);
        reject(new Error("Storage upload error: " + error.message));
      },
      async () => {
        clearTimeout(stallTimeout);
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "videos"), {
            videoUrl: downloadURL,
            category: category,
            createdAt: serverTimestamp(),
          });
          onProgress(100);
          resolve("Video uploaded and optimized successfully!");
        } catch (dbError: any) {
          reject(new Error("Database error: " + dbError.message));
        }
      }
    );
  });
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
