// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Category, Album, createAlbum, updateAlbum, deleteAlbum } from '../services/galleryService';
import { Trash2, Folder as FolderVideo, CheckSquare, Square, FolderInput, Loader2, X, Edit3 } from 'lucide-react';
import ReactPlayer from 'react-player';
import { Skeleton } from './ui/Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { motion, AnimatePresence } from 'motion/react';

export default function VideoViewer({ category, isAdminView = false }: { category: Category, isAdminView?: boolean }) {
  const [videos, setVideos] = useState<{ id: string, videoUrl: string, albumId?: string }[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
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
    const qVideos = query(
      collection(db, "videos"), 
      where("category", "==", category)
    );
    const qAlbums = query(
      collection(db, "albums"),
      where("category", "==", category)
    );

    const fetchData = async () => {
      try {
        if (isAdminView) {
          const unsubVideos = onSnapshot(qVideos, (snapshot) => {
            if (!isMounted) return;
            const data = snapshot.docs.map(doc => ({ 
              id: doc.id, 
              videoUrl: doc.data().videoUrl,
              albumId: doc.data().albumId,
              createdAt: doc.data().createdAt?.toMillis() || 0 
            }));
            setVideos(data.sort((a, b) => b.createdAt - a.createdAt));
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
            unsubVideos();
            unsubAlbums();
          };
        } else {
          const [vidSnap, albSnap] = await Promise.all([
            getDocs(qVideos),
            getDocs(qAlbums)
          ]);
          
          if (!isMounted) return;

          const vidData = vidSnap.docs.map(doc => ({
            id: doc.id,
            videoUrl: doc.data().videoUrl,
            albumId: doc.data().albumId,
            createdAt: doc.data().createdAt?.toMillis() || 0
          }));

          setVideos(vidData.sort((a, b) => b.createdAt - a.createdAt));
          setAlbums(albSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Album)));
          setLoading(false);
        }
      } catch (err: any) {
        if (!isMounted) return;
        // Silent failover
        setVideos([]); 
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

  const handleQuickMove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds([id]);
    setShowMoveModal(true);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} videos?`)) return;
    try {
      await Promise.all(selectedIds.map(id => deleteDoc(doc(db, 'videos', id))));
      setSelectedIds([]);
      setIsSelectionMode(false);
    } catch (err) {
      console.error("Error bulk deleting:", err);
      alert("Failed to delete some videos.");
    }
  };

  const handleMoveVideos = async () => {
    if (selectedIds.length === 0) return;
    setIsMoving(true);
    try {
      let finalAlbumId = targetAlbumId;
      if (targetAlbumId === 'new') {
        if (!newAlbumTitle) throw new Error("Please enter an album title.");
        finalAlbumId = await createAlbum(category, newAlbumTitle, newAlbumDesc);
      }
      
      await Promise.all(selectedIds.map(id => {
        return updateDoc(doc(db, 'videos', id), { albumId: finalAlbumId === 'none' ? null : finalAlbumId });
      }));
      
      setShowMoveModal(false);
      setIsSelectionMode(false);
      setSelectedIds([]);
      setTargetAlbumId('');
      setNewAlbumTitle('');
      setNewAlbumDesc('');
      alert(`Moved ${selectedIds.length} videos successfully!`);
    } catch(err: any) {
      alert(err.message);
    } finally {
      setIsMoving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this video?')) return;
    try {
      await deleteDoc(doc(db, 'videos', id));
    } catch (err) {
      console.error("Error deleting video:", err);
      alert("Failed to delete video.");
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
    if (!confirm('Are you sure you want to delete this album? The videos inside will be moved to the uncategorized section.')) return;
    try {
      await deleteAlbum(id);
    } catch (err: any) {
      alert("Failed to delete album: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className={isAdminView ? "py-4" : "py-12"}>
        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-6">{category} Videos</h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton count={2} className="aspect-video w-full rounded-3xl bg-white/5 border border-white/10" />
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    if (isAdminView) {
      return (
        <div className="py-4">
          <div className="text-white/30 text-[11px] font-bold uppercase tracking-widest italic">No videos currently added.</div>
        </div>
      );
    }
    return null;
  }

  // Group videos
  const groupedVideos: Record<string, typeof videos> = {};
  groupedVideos['uncategorized'] = [];

  albums.forEach(a => {
    groupedVideos[a.id] = [];
  });

  videos.forEach(vid => {
    if (vid.albumId && groupedVideos[vid.albumId]) {
      groupedVideos[vid.albumId].push(vid);
    } else {
      groupedVideos['uncategorized'].push(vid);
    }
  });

  return (
    <div className={isAdminView ? "py-4 relative" : "py-12"}>
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{category} Videos</h4>
        {isAdminView && videos.length > 0 && (
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
          const albumVideos = groupedVideos[album.id] || [];
          if (albumVideos.length === 0 && !isAdminView) return null; // hide empty albums from public
          
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
                      <div className="p-3.5 bg-red-600/20 text-red-400 border border-red-500/30 rounded-2xl">
                        <FolderVideo className="w-6 h-6" />
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

              {albumVideos.length > 0 ? 
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full">
                  {albumVideos.map(vid => (
                    <motion.div 
                      key={vid.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={(e) => isSelectionMode && toggleSelection(vid.id, e)} 
                      className={`relative aspect-video rounded-[24px] sm:rounded-[30px] overflow-hidden bg-slate-950/40 shadow-2xl cursor-pointer hover:scale-[1.02] transition-all duration-500 ease-out group border border-white/10 ${selectedIds.includes(vid.id) ? 'ring-4 ring-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.4)]' : ''}`}
                    >
                      {/* @ts-ignore */}
                      <ReactPlayer 
                        url={vid.videoUrl} 
                        width="100%" 
                        height="100%" 
                        controls={!isSelectionMode} 
                        light={true} // Shows a thumbnail instead of preloading full video, user clicks to play
                        style={{ pointerEvents: isSelectionMode ? 'none' : 'auto' }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      {isAdminView && !isSelectionMode && (
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0 z-10">
                          <button 
                            onClick={(e) => handleQuickMove(vid.id, e)}
                            className="p-3 bg-slate-900/80 hover:bg-blue-600 text-white rounded-xl shadow-2xl backdrop-blur-md transition-all border border-white/10"
                            title="Move to Album"
                          >
                            <FolderInput size={18} />
                          </button>
                          <button 
                            onClick={(e) => handleDelete(vid.id, e)}
                            className="p-3 bg-red-600/80 hover:bg-red-600 text-white rounded-xl shadow-2xl backdrop-blur-md transition-all border border-white/10"
                            title="Delete Video"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                      {isAdminView && isSelectionMode && (
                        <div className="absolute inset-0 bg-black/20 z-10 cursor-pointer" />
                      )}
                      {isAdminView && isSelectionMode && (
                        <div className="absolute top-4 left-4 p-2 bg-white/95 rounded-xl shadow-2xl z-20">
                           {selectedIds.includes(vid.id) ? <CheckSquare className="text-blue-600 w-6 h-6" /> : <Square className="text-slate-400 w-6 h-6" />}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
               : 
                <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-[30px] w-full">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">No videos in this album</p>
                </div>
              }
            </div>
          );
        })}

        {/* Render Uncategorized Videos */}
        {groupedVideos['uncategorized'].length > 0 && (
          <div className="space-y-6">
            {albums.length > 0 && (
              <div className="flex items-center gap-4 mt-16 mb-4">
                <div className="flex-1 h-px bg-white/5" />
                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] italic whitespace-nowrap">Archives & General</h3>
                <div className="flex-1 h-px bg-white/5" />
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full">
              {groupedVideos['uncategorized'].map(vid => (
                <motion.div 
                  key={vid.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={(e) => isSelectionMode && toggleSelection(vid.id, e)} 
                  className={`relative aspect-video rounded-[24px] sm:rounded-[30px] overflow-hidden bg-slate-950/40 shadow-2xl cursor-pointer hover:scale-[1.02] transition-all duration-500 ease-out group border border-white/10 ${selectedIds.includes(vid.id) ? 'ring-4 ring-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.4)]' : ''}`}
                >
                  {/* @ts-ignore */}
                  <ReactPlayer 
                    url={vid.videoUrl} 
                    width="100%" 
                    height="100%" 
                    controls={!isSelectionMode} 
                    light={true} // Shows a thumbnail instead of preloading full video, user clicks to play
                    style={{ pointerEvents: isSelectionMode ? 'none' : 'auto' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  {isAdminView && !isSelectionMode && (
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0 z-10">
                      <button 
                        onClick={(e) => handleQuickMove(vid.id, e)}
                        className="p-3 bg-slate-900/80 hover:bg-blue-600 text-white rounded-xl shadow-2xl backdrop-blur-md transition-all border border-white/10"
                        title="Move to Album"
                      >
                        <FolderInput size={18} />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(vid.id, e)}
                        className="p-3 bg-red-600/80 hover:bg-red-600 text-white rounded-xl shadow-2xl backdrop-blur-md transition-all border border-white/10"
                        title="Delete Video"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                  {isAdminView && isSelectionMode && (
                    <div className="absolute inset-0 bg-black/20 z-10 cursor-pointer" />
                  )}
                  {isAdminView && isSelectionMode && (
                    <div className="absolute top-4 left-4 p-2 bg-white/95 rounded-xl shadow-2xl z-20">
                       {selectedIds.includes(vid.id) ? <CheckSquare className="text-blue-600 w-6 h-6" /> : <Square className="text-slate-400 w-6 h-6" />}
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
            <DialogTitle>Move {selectedIds.length} Videos</DialogTitle>
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
            <Button onClick={handleMoveVideos} disabled={!targetAlbumId || (targetAlbumId === 'new' && !newAlbumTitle) || isMoving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
              {isMoving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Move Videos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
