import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Category } from '../services/galleryService';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GalleryViewer({ category }: { category: Category }) {
  const [images, setImages] = useState<{ id: string, imageUrl: string }[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "gallery"), 
      where("category", "==", category),
      orderBy("createdAt", "desc")
    );
    
    return onSnapshot(q, (snapshot) => {
      setImages(snapshot.docs.map(doc => ({ id: doc.id, imageUrl: doc.data().imageUrl })));
    });
  }, [category]);

  if (images.length === 0) return null;

  return (
    <div className="py-12">
      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">{category} Gallery</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map(img => (
          <div key={img.id} onClick={() => setSelectedImage(img.imageUrl)} className="aspect-square rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
            <img src={img.imageUrl} alt={category} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
