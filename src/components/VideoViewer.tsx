// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Category } from '../services/galleryService';
import { Trash2 } from 'lucide-react';
import ReactPlayer from 'react-player';
import { Skeleton } from './ui/Skeleton';

export default function VideoViewer({ category, isAdminView = false }: { category: Category, isAdminView?: boolean }) {
  const [videos, setVideos] = useState<{ id: string, videoUrl: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "videos"), 
      where("category", "==", category)
    );
    
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        videoUrl: doc.data().videoUrl,
        createdAt: doc.data().createdAt?.toMillis() || 0 
      }));
      // Sort locally by createdAt desc
      setVideos(data.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    }, (error) => {
      console.error(`Error fetching videos for ${category}:`, error);
      setLoading(false);
    });
  }, [category]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;
    try {
      await deleteDoc(doc(db, 'videos', id));
    } catch (err) {
      console.error("Error deleting video:", err);
      alert("Failed to delete video.");
    }
  };

  if (loading) {
    return (
      <div className={isAdminView ? "py-4" : "py-12"}>
        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">{category} Videos</h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton count={2} className="aspect-video w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    if (isAdminView) {
      return (
        <div className="py-4">
          <div className="text-slate-500 text-sm">No videos added yet.</div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={isAdminView ? "py-4" : "py-12"}>
      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">{category} Videos</h4>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {videos.map(vid => (
          <div key={vid.id} className="relative aspect-video rounded-3xl overflow-hidden bg-slate-100 shadow-lg group">
            {/* @ts-ignore */}
            <ReactPlayer 
              url={vid.videoUrl} 
              width="100%" 
              height="100%" 
              controls 
              light // Shows a thumbnail instead of preloading full video, user clicks to play
            />
            {isAdminView && (
              <button 
                onClick={() => handleDelete(vid.id)}
                className="absolute top-4 right-4 p-3 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
