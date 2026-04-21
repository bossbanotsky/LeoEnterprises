import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Category } from '../services/galleryService';
import { X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GalleryViewer({ category, isAdminView = false }: { category: Category, isAdminView?: boolean }) {
  const [images, setImages] = useState<{ id: string, imageUrl: string }[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "gallery"), 
      where("category", "==", category)
    );
    
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        imageUrl: doc.data().imageUrl,
        createdAt: doc.data().createdAt?.toMillis() || 0 
      }));
      // Sort locally by createdAt desc
      setImages(data.sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => {
      console.error(`Error fetching gallery images for ${category}:`, error);
    });
  }, [category]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this image?')) return;
    try {
      await deleteDoc(doc(db, 'gallery', id));
    } catch (err) {
      console.error("Error deleting image:", err);
      alert("Failed to delete image.");
    }
  };

  if (images.length === 0) {
    if (isAdminView) {
      return (
        <div className="py-4">
          <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">{category}</h4>
          <div className="text-slate-500 text-sm">No images uploaded yet.</div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={isAdminView ? "py-4" : "py-12"}>
      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">{category} Gallery</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map(img => (
          <div key={img.id} onClick={() => setSelectedImage(img.imageUrl)} className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group">
            <img src={img.imageUrl} alt={category} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            {isAdminView && (
              <button 
                onClick={(e) => handleDelete(img.id, e)}
                className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <button className="absolute top-8 right-8 text-white"><X size={32} /></button>
            <img src={selectedImage} alt="Large View" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" referrerPolicy="no-referrer" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
