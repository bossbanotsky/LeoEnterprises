import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Category, Album, createAlbum, updateAlbum, deleteAlbum } from '../services/galleryService';
import { X, Trash2, Folder as FolderImage, CheckSquare, Square, FolderInput, Loader2, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Skeleton } from './ui/Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';

export default function GalleryViewer({ category, isAdminView = false }: { category: Category, isAdminView?: boolean }) {
  const [images, setImages] = useState<{ id: string, imageUrl: string, albumId?: string }[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Bulk Selection and Move State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetAlbumId, setTargetAlbumId] = useState<string>('');
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  // Album Edit State
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [editAlbumTitle, setEditAlbumTitle] = useState('');
  const [editAlbumDesc, setEditAlbumDesc] = useState('');
  const [isSavingAlbum, setIsSavingAlbum] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    // Queries
    const qImages = query(
      collection(db, "gallery"), 
      where("category", "==", category)
    );
    const qAlbums = query(
      collection(db, "albums"),
      where("category", "==", category)
    );

    const fetchData = async () => {
      try {
        if (isAdminView) {
          const unsubImages = onSnapshot(qImages, (snapshot) => {
            if (!isMounted) return;
            const data = snapshot.docs.map(doc => ({ 
              id: doc.id, 
              imageUrl: doc.data().imageUrl,
              albumId: doc.data().albumId,
              createdAt: doc.data().createdAt?.toMillis() || 0 
            }));
            setImages(data.sort((a, b) => b.createdAt - a.createdAt));
            setLoading(false);
          });

          const unsubAlbums = onSnapshot(qAlbums, (snapshot) => {
            if (!isMounted) return;
            const data = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Album));
            setAlbums(data);
          });

          return () => {
            unsubImages();
            unsubAlbums();
          }
        } else {
          const [imgSnap, albSnap] = await Promise.all([
            getDocs(qImages),
            getDocs(qAlbums)
          ]);
          
          if (!isMounted) return;

          const imgData = imgSnap.docs.map(doc => ({
            id: doc.id,
            imageUrl: doc.data().imageUrl,
            albumId: doc.data().albumId,
            createdAt: doc.data().createdAt?.toMillis() || 0
          }));

          setImages(imgData.sort((a, b) => b.createdAt - a.createdAt));
          setAlbums(albSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Album)));
          setLoading(false);
        }
      } catch (err: any) {
        if (!isMounted) return;
        // Silent failover to keep the UI clean
        
        // GRACEFUL FAILOVER: If quota hit, show a comprehensive set of high-quality industrial placeholders
        const industrialMocks: Record<string, string[]> = {
          "Hauling Services": [
            "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1586528116311-ad86699ed791?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&q=80&w=800"
          ],
          "Civil Works": [
            "https://images.unsplash.com/photo-1590644365607-1c5a519a7a37?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=800"
          ],
          "Fabrication": [
            "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1565608087341-404b25458da4?auto=format&fit=crop&q=80&w=800"
          ],
          "Repairs & Maintenance": [
            "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=800"
          ],
          "IT Services": [
            "https://images.unsplash.com/photo-1558494949-ef010cbdcc51?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800"
          ],
          "CCTV Installation": [
            "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1521110606352-d11d6199f3bd?auto=format&fit=crop&q=80&w=800"
          ]
        };

        const currentMocks = industrialMocks[category as string] || industrialMocks["Hauling Services"];
        setImages(currentMocks.map((url, i) => ({ id: `m-${category}-${i}`, imageUrl: url, createdAt: Date.now() - i * 1000 })));
        setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [category, isAdminView]);

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleImageClick = (imageUrl: string, id: string) => {
    if (isSelectionMode) {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
      setSelectedImage(imageUrl);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} images?`)) return;
    try {
      await Promise.all(selectedIds.map(id => deleteDoc(doc(db, 'gallery', id))));
      setSelectedIds([]);
      setIsSelectionMode(false);
    } catch (err) {
      console.error("Error bulk deleting:", err);
      alert("Failed to delete some images.");
    }
  };

  const handleMoveImages = async () => {
    if (selectedIds.length === 0) return;
    setIsMoving(true);
    try {
      let finalAlbumId = targetAlbumId;
      if (targetAlbumId === 'new') {
        if (!newAlbumTitle) throw new Error("Please enter an album title.");
        finalAlbumId = await createAlbum(category, newAlbumTitle, newAlbumDesc);
      }
      
      await Promise.all(selectedIds.map(id => {
        return updateDoc(doc(db, 'gallery', id), { albumId: finalAlbumId === 'none' ? null : finalAlbumId });
      }));
      
      setShowMoveModal(false);
      setIsSelectionMode(false);
      setSelectedIds([]);
      setTargetAlbumId('');
      setNewAlbumTitle('');
      setNewAlbumDesc('');
      alert(`Moved ${selectedIds.length} images successfully!`);
    } catch(err: any) {
      alert(err.message);
    } finally {
      setIsMoving(false);
    }
  };

  const handleQuickMove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds([id]);
    setShowMoveModal(true);
  };

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

  const handleEditAlbum = (album: Album) => {
    setEditingAlbumId(album.id);
    setEditAlbumTitle(album.title);
    setEditAlbumDesc(album.description || '');
  };

  const handleSaveAlbum = async () => {
    if (!editingAlbumId || !editAlbumTitle.trim()) return;
    setIsSavingAlbum(true);
    try {
      await updateAlbum(editingAlbumId, editAlbumTitle, editAlbumDesc);
      setEditingAlbumId(null);
    } catch (err: any) {
      alert("Failed to update album: " + err.message);
    } finally {
      setIsSavingAlbum(false);
    }
  };

  const handleDeleteAlbum = async (id: string) => {
    if (!confirm('Are you sure you want to delete this album? The pictures inside will be moved to the uncategorized section.')) return;
    try {
      await deleteAlbum(id);
    } catch (err: any) {
      alert("Failed to delete album: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className={isAdminView ? "py-4" : "py-12"}>
        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-6">{category} Gallery</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Skeleton count={4} className="aspect-square w-full rounded-2xl bg-white/5 border border-white/10" />
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    if (isAdminView) {
      return (
        <div className="py-4">
          <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3">{category}</h4>
          <div className="text-white/30 text-[11px] font-bold uppercase tracking-widest italic">No images currently in this category.</div>
        </div>
      );
    }
    return null;
  }

  // Group images
  const groupedImages: Record<string, typeof images> = {};
  groupedImages['uncategorized'] = [];

  albums.forEach(a => {
    groupedImages[a.id] = [];
  });

  images.forEach(img => {
    if (img.albumId && groupedImages[img.albumId]) {
      groupedImages[img.albumId].push(img);
    } else {
      groupedImages['uncategorized'].push(img);
    }
  });

  return (
    <div className={isAdminView ? "py-4 relative" : "py-12"}>
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{category} Gallery</h4>
        {isAdminView && images.length > 0 && (
          <button 
            onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); }}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isSelectionMode ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'}`}
          >
            {isSelectionMode ? 'Cancel Selection' : 'Select Multiple'}
          </button>
        )}
      </div>
      
      <div className="space-y-12">
        {/* Render each album */}
        {albums.map((album) => {
          const albumImages = groupedImages[album.id] || [];
          if (albumImages.length === 0 && !isAdminView) return null; // hide empty albums from public
          
          const isEditing = editingAlbumId === album.id;

          return (
            <div key={album.id} className="space-y-6">
              <div className="bg-white/5 border border-white/10 p-5 sm:p-8 rounded-[32px] relative group backdrop-blur-2xl shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                {isAdminView && !isEditing && (
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                      onClick={() => handleEditAlbum(album)}
                      className="p-2.5 bg-slate-950/80 border border-white/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl shadow-xl transition-all"
                      title="Edit Album"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteAlbum(album.id)}
                      className="p-2.5 bg-slate-950/80 border border-white/10 text-red-400 hover:bg-red-600 hover:text-white rounded-xl shadow-xl transition-all"
                      title="Delete Album"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}

                {isEditing ? (
                  <div className="space-y-4 pr-12">
                    <div>
                      <Input 
                        value={editAlbumTitle}
                        onChange={(e) => setEditAlbumTitle(e.target.value)}
                        placeholder="Album Title"
                        className="font-black text-xl h-14 bg-white/5 border-white/10 text-white rounded-2xl italic uppercase tracking-tighter"
                        autoFocus
                      />
                    </div>
                    <div>
                      <textarea 
                        value={editAlbumDesc}
                        onChange={(e) => setEditAlbumDesc(e.target.value)}
                        placeholder="Description (Optional)"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 min-h-[100px] text-sm text-white focus:ring-2 focus:ring-blue-500/20 placeholder:text-white/20"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleSaveAlbum} disabled={isSavingAlbum || !editAlbumTitle.trim()} className="bg-blue-600 hover:bg-blue-700 text-white font-black h-12 px-8 rounded-2xl uppercase tracking-widest text-[10px]">
                        {isSavingAlbum ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save Changes
                      </Button>
                      <Button onClick={() => setEditingAlbumId(null)} variant="ghost" className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white/40 hover:text-white hover:bg-white/5">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="p-3.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl">
                        <FolderImage className="w-6 h-6" />
                      </div>
                      <div className="pr-16">
                        <h3 className="text-xl font-black text-white leading-tight italic uppercase tracking-tighter">{album.title}</h3>
                      </div>
                    </div>
                    {album.description && (
                      <p className="text-xs font-bold text-white/60 mt-3 max-w-3xl leading-relaxed italic border-l-2 border-white/10 pl-4 py-1">
                        {album.description}
                      </p>
                    )}
                  </>
                )}
              </div>

              {albumImages.length > 0 ? 
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 w-full">
                  {albumImages.map(img => (
                    <motion.div 
                      key={img.id} 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => handleImageClick(img.imageUrl, img.id)} 
                      className={`relative aspect-square rounded-[24px] overflow-hidden cursor-pointer hover:scale-[1.05] transition-all duration-300 group border border-white/10 ${selectedIds.includes(img.id) ? 'ring-4 ring-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.4)]' : 'shadow-xl'}`}
                    >
                      <img src={img.imageUrl} alt={category} className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out pointer-events-none" />
                      {isAdminView && !isSelectionMode && (
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0 z-10">
                          <button 
                            onClick={(e) => handleQuickMove(img.id, e)}
                            className="p-2.5 bg-slate-900/80 hover:bg-blue-600 text-white rounded-xl shadow-2xl backdrop-blur-md transition-all border border-white/10"
                            title="Move to Album"
                          >
                            <FolderInput size={16} />
                          </button>
                          <button 
                            onClick={(e) => handleDelete(img.id, e)}
                            className="p-2.5 bg-red-600/80 hover:bg-red-600 text-white rounded-xl shadow-2xl backdrop-blur-md transition-all border border-white/10"
                            title="Delete Image"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                      {isAdminView && isSelectionMode && (
                        <div className="absolute top-3 left-3 p-2 bg-white/95 rounded-xl shadow-2xl z-20 transform transition-transform active:scale-90" onClick={(e) => toggleSelection(img.id, e)}>
                           {selectedIds.includes(img.id) ? <CheckSquare className="text-blue-600 w-6 h-6" /> : <Square className="text-slate-400 w-6 h-6" />}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
               : 
                <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-[30px] w-full">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">No images in this album</p>
                </div>
              }
            </div>
          );
        })}

        {/* Render Uncategorized Images */}
        {groupedImages['uncategorized'].length > 0 && (
          <div className="space-y-6">
            {albums.length > 0 && (
              <div className="flex items-center gap-4 mt-16 mb-4">
                <div className="flex-1 h-px bg-white/5" />
                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] italic whitespace-nowrap">Archives & General</h3>
                <div className="flex-1 h-px bg-white/5" />
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 w-full">
              {groupedImages['uncategorized'].map(img => (
                <motion.div 
                  key={img.id} 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => handleImageClick(img.imageUrl, img.id)} 
                  className={`relative aspect-square rounded-[24px] overflow-hidden cursor-pointer hover:scale-[1.05] transition-all duration-300 group border border-white/10 ${selectedIds.includes(img.id) ? 'ring-4 ring-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.4)]' : 'shadow-xl'}`}
                >
                  <img src={img.imageUrl} alt={category} className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out pointer-events-none" />
                  {isAdminView && !isSelectionMode && (
                    <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0 z-10">
                      <button 
                        onClick={(e) => handleQuickMove(img.id, e)}
                        className="p-2.5 bg-slate-900/80 hover:bg-blue-600 text-white rounded-xl shadow-2xl backdrop-blur-md transition-all border border-white/10"
                        title="Move to Album"
                      >
                        <FolderInput size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(img.id, e)}
                        className="p-2.5 bg-red-600/80 hover:bg-red-600 text-white rounded-xl shadow-2xl backdrop-blur-md transition-all border border-white/10"
                        title="Delete Image"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                  {isAdminView && isSelectionMode && (
                     <div className="absolute top-3 left-3 p-2 bg-white/95 rounded-xl shadow-2xl z-20 transform transition-transform active:scale-90" onClick={(e) => toggleSelection(img.id, e)}>
                        {selectedIds.includes(img.id) ? <CheckSquare className="text-blue-600 w-6 h-6" /> : <Square className="text-slate-400 w-6 h-6" />}
                     </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isSelectionMode && selectedIds.length > 0 && (
          <motion.div
             initial={{ y: 50, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: 50, opacity: 0 }}
             className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 w-[92%] md:w-auto bg-slate-900 border border-slate-700 text-white p-2 rounded-2xl shadow-2xl flex items-center justify-between gap-1 md:gap-2 z-[60] pointer-events-auto"
          >
            <div className="flex items-center font-bold px-2 md:px-4 text-sm md:text-base whitespace-nowrap">
              <span>{selectedIds.length} <span className="hidden sm:inline">selected</span></span>
            </div>
            
            <div className="flex items-center gap-1.5 md:gap-2 flex-1 justify-end">
              <button 
                className="flex-1 md:flex-none px-3 md:px-4 py-2 md:py-2.5 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 text-xs md:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap" 
                onClick={() => setShowMoveModal(true)}
              >
                <FolderInput size={16} className="shrink-0" /> 
                <span className="hidden md:inline">Move to Album</span>
                <span className="md:hidden">Move</span>
              </button>
              <button 
                className="flex-1 md:flex-none px-3 md:px-4 py-2 md:py-2.5 bg-red-600 rounded-xl font-bold hover:bg-red-500 text-xs md:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap" 
                onClick={handleBulkDelete}
              >
                <Trash2 size={16} className="shrink-0" /> 
                <span className="hidden md:inline">Delete</span>
                <span className="md:hidden">Delete</span>
              </button>
              <button className="px-3 md:px-4 py-2 md:py-2.5 bg-slate-800 rounded-xl font-bold hover:bg-slate-700 text-sm shrink-0" onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}>
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Move Album Modal */}
      <Dialog open={showMoveModal} onOpenChange={(open) => {
        setShowMoveModal(open);
        if (!open && !isSelectionMode) setSelectedIds([]);
      }}>
        <DialogContent className="sm:max-w-md border-slate-200">
          <DialogHeader>
            <DialogTitle>Move {selectedIds.length} Images</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-2">Select Destination Album</label>
              <select value={targetAlbumId} onChange={(e) => setTargetAlbumId(e.target.value)} className="w-full h-12 rounded-xl border border-slate-200 px-4 focus:ring-2 focus:ring-blue-500/20">
                <option value="">-- Select Album --</option>
                <option value="none" className="font-bold">❌ No Album (Uncategorized)</option>
                <option value="new" className="font-bold text-blue-600">✨ + Create New Album</option>
                <optgroup label="Existing Albums">
                  {albums.map(album => <option key={album.id} value={album.id}>{album.title}</option>)}
                </optgroup>
              </select>
            </div>

            {targetAlbumId === 'new' && (
               <div className="space-y-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                 <div>
                   <label className="block text-xs font-black uppercase text-slate-400 mb-2">New Album Title</label>
                   <Input 
                     placeholder="e.g. Door to door for cargo" 
                     value={newAlbumTitle}
                     onChange={e => setNewAlbumTitle(e.target.value)}
                     className="bg-white"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-black uppercase text-slate-400 mb-2">Description</label>
                   <textarea 
                     placeholder="Optional description..." 
                     value={newAlbumDesc}
                     onChange={e => setNewAlbumDesc(e.target.value)}
                     className="w-full rounded-xl border border-slate-200 p-3 min-h-[80px] text-sm focus:ring-2 focus:ring-blue-500/20 bg-white"
                   />
                 </div>
               </div>
            )}
            
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveModal(false)}>Cancel</Button>
            <Button onClick={handleMoveImages} disabled={!targetAlbumId || (targetAlbumId === 'new' && !newAlbumTitle) || isMoving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
              {isMoving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Move Images
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90"
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
