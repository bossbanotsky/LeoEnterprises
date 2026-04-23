import React, { useState, useEffect } from 'react';
import { uploadImage, addVideoUrl, uploadVideoFile, CATEGORIES, Category, Album, getAlbums, createAlbum } from '../services/galleryService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2, Upload, X, Image as ImageIcon, Video, Link as LinkIcon, FileVideo, FolderPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import GalleryViewer from './GalleryViewer';
import VideoViewer from './VideoViewer';

export default function GalleryManagement() {
  const [activeTab, setActiveTab] = useState<'images' | 'videos'>('images');
  
  // Image State
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [imgCategory, setImgCategory] = useState<Category | ''>('');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [progress, setProgress] = useState(0);

  // Video State
  const [videoUrl, setVideoUrl] = useState('');
  const [vidFile, setVidFile] = useState<File | null>(null);
  const [vidUploadType, setVidUploadType] = useState<'link' | 'file'>('file');
  const [vidCategory, setVidCategory] = useState<Category | ''>('');
  const [uploadingVid, setUploadingVid] = useState(false);
  const [vidProgress, setVidProgress] = useState(0);

  // Albums specific
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  
  useEffect(() => {
    const fetchAlbums = async () => {
      const targetCategory = activeTab === 'images' ? imgCategory : vidCategory;
      if (!targetCategory) {
        setAlbums([]);
        setSelectedAlbumId('');
        return;
      }
      try {
        const fetched = await getAlbums(targetCategory as Category);
        setAlbums(fetched);
        if (fetched.length > 0 && !fetched.some(a => a.id === selectedAlbumId)) {
           setSelectedAlbumId(''); 
        }
      } catch (err) {
        console.error("Failed to fetch albums: ", err);
      }
    };
    fetchAlbums();
  }, [imgCategory, vidCategory, activeTab]);

  const handleCreateAlbum = async () => {
    const targetCategory = activeTab === 'images' ? imgCategory : vidCategory;
    if (!targetCategory || !newAlbumTitle) return;
    setCreatingAlbum(true);
    try {
      const newId = await createAlbum(targetCategory as Category, newAlbumTitle, newAlbumDesc);
      const fetched = await getAlbums(targetCategory as Category);
      setAlbums(fetched);
      setSelectedAlbumId(newId);
      setShowAlbumModal(false);
      setNewAlbumTitle('');
      setNewAlbumDesc('');
    } catch(err: any) {
      alert(err.message);
    } finally {
      setCreatingAlbum(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const imageFiles = selectedFiles.filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      setFiles(prev => [...prev, ...imageFiles]);
      const newPreviews = imageFiles.map(f => URL.createObjectURL(f));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
    // reset input
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      // revoke URL to avoid memory leaks
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUploadImages = async () => {
    if (files.length === 0 || !imgCategory) return;
    setUploadingImg(true);
    setProgress(0);
    try {
      // Create a copy so we can track overall progress
      let completed = 0;
      await Promise.all(files.map(file => 
        uploadImage(file, imgCategory, (p) => {
          // Approximate progress for multiple files
          // We won't track individual precisely in a single bar easily, but we can fake an aggregate:
        }, selectedAlbumId).then(() => {
          completed++;
          setProgress((completed / files.length) * 100);
        })
      ));
      
      alert(`Successfully uploaded ${files.length} images!`);
      
      // Cleanup previews
      previews.forEach(p => URL.revokeObjectURL(p));
      setFiles([]);
      setPreviews([]);
      setImgCategory('');
      setSelectedAlbumId('');
    } catch (err: any) {
      console.error(err);
      alert('Error uploading some files: ' + err.message);
    } finally {
      setUploadingImg(false);
      setProgress(0);
    }
  };

  const handleAddVideo = async () => {
    if (!vidCategory) return;
    
    if (vidUploadType === 'link' && !videoUrl) return;
    if (vidUploadType === 'file' && !vidFile) return;

    setUploadingVid(true);
    setVidProgress(0);
    try {
      if (vidUploadType === 'link') {
        await addVideoUrl(videoUrl, vidCategory, selectedAlbumId);
        alert('Video embedded successfully!');
        setVideoUrl('');
      } else {
        await uploadVideoFile(vidFile!, vidCategory, (p) => setVidProgress(p), selectedAlbumId);
        alert('Video uploaded to Cloud Storage successfully!');
        setVidFile(null);
      }
      setVidCategory('');
      setSelectedAlbumId('');
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setUploadingVid(false);
      setVidProgress(0);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      <div className="flex gap-2 sm:gap-3 p-1 sm:p-1.5 bg-white/5 rounded-3xl w-fit border border-white/10 backdrop-blur-xl mx-auto sm:ml-0">
        <button 
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-black uppercase tracking-widest text-[9px] sm:text-[10px] transition-all ${activeTab === 'images' ? 'bg-white/10 text-white shadow-xl' : 'text-white/40 hover:text-white'}`}
          onClick={() => setActiveTab('images')}
        >
          <ImageIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> Photos
        </button>
        <button 
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'videos' ? 'bg-white/10 text-white shadow-xl' : 'text-white/40 hover:text-white'}`}
          onClick={() => setActiveTab('videos')}
        >
          <Video className="w-3.5 h-3.5" /> Videos
        </button>
      </div>

      <div key={activeTab} className="p-4 sm:p-8 rounded-3xl bg-transparent border border-white/10 shadow-2xl backdrop-blur-xl bento-card relative overflow-hidden w-full">
        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-6">
          {activeTab === 'images' ? 'Upload Image' : 'Add New Video'}
        </h2>
        
        {activeTab === 'images' ? (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-black uppercase text-white/50 mb-2 tracking-widest">Category</label>
              <select value={imgCategory} onChange={(e) => setImgCategory(e.target.value as Category)} className="w-full h-14 rounded-2xl border border-white/10 bg-white/5 px-4 focus:ring-2 focus:ring-blue-500/20 text-white font-bold">
                <option value="">Select a category</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            {imgCategory && (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-black uppercase text-white/50 mb-2 tracking-widest">Album (Optional)</label>
                  <select value={selectedAlbumId} onChange={(e) => setSelectedAlbumId(e.target.value)} className="w-full h-14 rounded-2xl border border-white/10 bg-white/5 px-4 focus:ring-2 focus:ring-blue-500/20 text-white font-bold">
                    <option value="" className="bg-slate-900">-- No Album (General) --</option>
                    {albums.map(album => <option key={album.id} value={album.id} className="bg-slate-900">{album.title}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={() => setShowAlbumModal(true)} 
                    variant="outline" 
                    className="h-14 px-6 rounded-2xl border-white/10 flex items-center gap-2 hover:bg-white/10 text-white font-black uppercase text-[10px] tracking-widest transition-all"
                  >
                    <FolderPlus className="w-4 h-4" /> New Album
                  </Button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-black uppercase text-white/50 mb-2 tracking-widest">Images (Select Multiple)</label>
              <Input type="file" multiple accept="image/*" onChange={handleFileChange} className="w-full h-14 rounded-2xl pt-3.5 bg-white/5 border-white/10 text-white font-bold cursor-pointer file:bg-blue-600 file:text-white file:border-0 file:rounded-xl file:px-4 file:py-1 file:mr-4 file:font-black file:text-[10px] file:uppercase" />
            </div>

            {uploadingImg && (
              <div className="w-full bg-white/5 rounded-full h-4 overflow-hidden border border-white/10">
                <div className="bg-blue-600 h-full transition-all duration-300 shadow-[0_0_20px_rgba(37,99,235,0.5)]" style={{ width: `${progress}%` }}></div>
              </div>
            )}

            {previews.length > 0 && !uploadingImg && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {previews.map((preview, index) => (
                  <div key={index} className="relative w-full h-32 rounded-2xl overflow-hidden border border-white/20 shadow-xl group">
                    <img src={preview} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                    <button onClick={() => removeFile(index)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={handleUploadImages} disabled={files.length === 0 || !imgCategory || uploadingImg} className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black">
              {uploadingImg ? `Uploading... ${Math.round(progress)}%` : <><Upload className="w-5 h-5 mr-2" /> Upload {files.length > 0 ? files.length : ''} Images</>}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <button 
                onClick={() => setVidUploadType('file')}
                className={`flex-1 py-4 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-all ${vidUploadType === 'file' ? 'border-blue-500 bg-blue-500/20 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'border-white/10 text-white/40 hover:bg-white/5 hover:text-white'}`}
              >
                <FileVideo className="w-4 h-4" /> Upload File
              </button>
              <button 
                onClick={() => setVidUploadType('link')}
                className={`flex-1 py-4 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-all ${vidUploadType === 'link' ? 'border-blue-500 bg-blue-500/20 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'border-white/10 text-white/40 hover:bg-white/5 hover:text-white'}`}
              >
                <LinkIcon className="w-4 h-4" /> Embed Link
              </button>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-white/50 mb-2 tracking-widest">Category</label>
              <select value={vidCategory} onChange={(e) => setVidCategory(e.target.value as Category)} className="w-full h-14 rounded-2xl border border-white/10 bg-white/5 px-4 focus:ring-2 focus:ring-blue-500/20 text-white font-bold">
                <option value="" className="bg-slate-900">Select a category</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-slate-900">{cat}</option>)}
              </select>
            </div>

            {vidCategory && (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-black uppercase text-white/50 mb-2 tracking-widest">Album (Optional)</label>
                  <select value={selectedAlbumId} onChange={(e) => setSelectedAlbumId(e.target.value)} className="w-full h-14 rounded-2xl border border-white/10 bg-white/5 px-4 focus:ring-2 focus:ring-blue-500/20 text-white font-bold">
                    <option value="" className="bg-slate-900">-- No Album (General) --</option>
                    {albums.map(album => <option key={album.id} value={album.id} className="bg-slate-900">{album.title}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={() => setShowAlbumModal(true)} 
                    variant="outline" 
                    className="h-14 px-6 rounded-2xl border-white/10 flex items-center gap-2 hover:bg-white/10 text-white font-black uppercase text-[10px] tracking-widest transition-all"
                  >
                    <FolderPlus className="w-4 h-4" /> New Album
                  </Button>
                </div>
              </div>
            )}

            {vidUploadType === 'link' ? (
              <div key="link-upload">
                <label className="block text-xs font-black uppercase text-white/50 mb-2 tracking-widest">Video Link (YouTube, Facebook, Vimeo, MP4)</label>
                <Input 
                  type="url" 
                  placeholder="https://www.youtube.com/watch?v=..." 
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="h-14 rounded-2xl placeholder:text-white/20 bg-white/5 border-white/10 text-white font-bold" 
                />
              </div>
            ) : (
              <div key="file-upload">
                <label className="block text-xs font-black uppercase text-white/50 mb-2 tracking-widest">Video File</label>
                <Input 
                  type="file" 
                  accept="video/*"
                  onChange={(e) => e.target.files?.[0] && setVidFile(e.target.files[0])}
                  className="h-14 rounded-2xl pt-3.5 bg-white/5 border-white/10 text-white font-bold cursor-pointer file:bg-blue-600 file:text-white file:border-0 file:rounded-xl file:px-4 file:py-1 file:mr-4 file:font-black file:text-[10px] file:uppercase" 
                />
                <p className="text-[10px] text-blue-400 mt-3 font-black uppercase tracking-widest bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 italic">
                  Files are safely compressed into Firebase Cloud Storage to protect your database limits.
                </p>
                {uploadingVid && vidUploadType === 'file' && (
                  <div className="w-full bg-white/5 rounded-full h-4 overflow-hidden mt-6 border border-white/10">
                    <div className="bg-blue-600 h-full transition-all duration-300 shadow-[0_0_20px_rgba(37,99,235,0.5)]" style={{ width: `${vidProgress}%` }}></div>
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleAddVideo} disabled={(vidUploadType === 'link' && !videoUrl) || (vidUploadType === 'file' && !vidFile) || !vidCategory || uploadingVid} className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black">
              {uploadingVid ? `Processing... ${Math.round(vidProgress)}%` : <><Upload className="w-5 h-5 mr-2" /> {vidUploadType === 'file' ? 'Upload Video' : 'Save Link'}</>}
            </Button>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-8 rounded-3xl bg-transparent border border-white/10 shadow-2xl bento-card w-full">
         <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-6 relative z-10">Current {activeTab === 'images' ? 'Gallery' : 'Videos'}</h2>
         <div className="space-y-12">
            {CATEGORIES.map(cat => (
               <div key={cat} className="border-b border-white/5 pb-12 last:border-0 relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-8 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
                    <h3 className="text-xl font-black text-white italic uppercase tracking-widest">{cat}</h3>
                  </div>
                  {activeTab === 'images' ? (
                    <GalleryViewer category={cat} isAdminView={true} />
                  ) : (
                    <VideoViewer category={cat} isAdminView={true} />
                  )}
               </div>
            ))}
         </div>
      </div>

        {/* Create Album Modal */}
        <Dialog open={showAlbumModal} onOpenChange={setShowAlbumModal}>
          <DialogContent className="sm:max-w-md border-white/10 bg-slate-900/95 backdrop-blur-2xl text-white rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-white">Create New Album</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-white/50 mb-3 tracking-widest leading-none">Album Title</label>
                <Input 
                  placeholder="e.g. Door to door for cargo" 
                  value={newAlbumTitle}
                  onChange={e => setNewAlbumTitle(e.target.value)}
                  className="h-14 rounded-2xl bg-white/5 border-white/10 text-white font-bold placeholder:text-white/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-white/50 mb-3 tracking-widest leading-none">Description</label>
                <textarea 
                  placeholder="e.g. We offer simple and efficient door-to-door delivery for all your cargo needs..." 
                  value={newAlbumDesc}
                  onChange={e => setNewAlbumDesc(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 min-h-[120px] text-sm text-white font-medium focus:ring-2 focus:ring-blue-500/20 placeholder:text-white/20"
                />
              </div>
            </div>

            <DialogFooter className="gap-3">
              <Button variant="ghost" onClick={() => setShowAlbumModal(false)} className="text-white/60 hover:text-white hover:bg-white/5 rounded-2xl font-black uppercase tracking-widest text-[10px]">Cancel</Button>
              <Button onClick={handleCreateAlbum} disabled={!newAlbumTitle || creatingAlbum} className="bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl px-8 h-12 uppercase tracking-widest text-[10px] shadow-xl">
                {creatingAlbum ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Album
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

    </div>
  );
}
