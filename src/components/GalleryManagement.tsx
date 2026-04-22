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
    <div className="space-y-6">
      <div className="flex gap-4 p-2 bg-slate-100 rounded-3xl w-fit">
        <button 
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${activeTab === 'images' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('images')}
        >
          <ImageIcon className="w-5 h-5" /> Images
        </button>
        <button 
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${activeTab === 'videos' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('videos')}
        >
          <Video className="w-5 h-5" /> Videos
        </button>
      </div>

      <div key={activeTab} className="p-8 rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50">
        <h2 className="text-2xl font-black text-slate-900 mb-6">
          {activeTab === 'images' ? 'Upload Image' : 'Add New Video'}
        </h2>
        
        {activeTab === 'images' ? (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-2">Category</label>
              <select value={imgCategory} onChange={(e) => setImgCategory(e.target.value as Category)} className="w-full h-14 rounded-2xl border border-slate-200 px-4 focus:ring-2 focus:ring-blue-500/20">
                <option value="">Select a category</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            {imgCategory && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-black uppercase text-slate-400 mb-2">Album (Optional)</label>
                  <select value={selectedAlbumId} onChange={(e) => setSelectedAlbumId(e.target.value)} className="w-full h-14 rounded-2xl border border-slate-200 px-4 focus:ring-2 focus:ring-blue-500/20">
                    <option value="">-- No Album (General) --</option>
                    {albums.map(album => <option key={album.id} value={album.id}>{album.title}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={() => setShowAlbumModal(true)} 
                    variant="outline" 
                    className="h-14 px-6 rounded-2xl border-slate-200 flex items-center gap-2 hover:bg-slate-50"
                  >
                    <FolderPlus className="w-4 h-4" /> New Album
                  </Button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-2">Images (Select Multiple)</label>
              <Input type="file" multiple accept="image/*" onChange={handleFileChange} className="h-14 rounded-2xl pt-3.5" />
            </div>

            {uploadingImg && (
              <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            )}

            {previews.length > 0 && !uploadingImg && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {previews.map((preview, index) => (
                  <div key={index} className="relative w-full h-32 rounded-2xl overflow-hidden border border-slate-200">
                    <img src={preview} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                    <button onClick={() => removeFile(index)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"><X size={12}/></button>
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
            <div className="flex gap-4 mb-4">
              <button 
                onClick={() => setVidUploadType('file')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 transition-all ${vidUploadType === 'file' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:bg-slate-50'}`}
              >
                <FileVideo className="w-4 h-4" /> Upload File
              </button>
              <button 
                onClick={() => setVidUploadType('link')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 transition-all ${vidUploadType === 'link' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:bg-slate-50'}`}
              >
                <LinkIcon className="w-4 h-4" /> Embed Link
              </button>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-2">Category</label>
              <select value={vidCategory} onChange={(e) => setVidCategory(e.target.value as Category)} className="w-full h-14 rounded-2xl border border-slate-200 px-4 focus:ring-2 focus:ring-blue-500/20">
                <option value="">Select a category</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            {vidCategory && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-black uppercase text-slate-400 mb-2">Album (Optional)</label>
                  <select value={selectedAlbumId} onChange={(e) => setSelectedAlbumId(e.target.value)} className="w-full h-14 rounded-2xl border border-slate-200 px-4 focus:ring-2 focus:ring-blue-500/20">
                    <option value="">-- No Album (General) --</option>
                    {albums.map(album => <option key={album.id} value={album.id}>{album.title}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={() => setShowAlbumModal(true)} 
                    variant="outline" 
                    className="h-14 px-6 rounded-2xl border-slate-200 flex items-center gap-2 hover:bg-slate-50"
                  >
                    <FolderPlus className="w-4 h-4" /> New Album
                  </Button>
                </div>
              </div>
            )}

            {vidUploadType === 'link' ? (
              <div key="link-upload">
                <label className="block text-xs font-black uppercase text-slate-400 mb-2">Video Link (YouTube, Facebook, Vimeo, MP4)</label>
                <Input 
                  type="url" 
                  placeholder="https://www.youtube.com/watch?v=..." 
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="h-14 rounded-2xl placeholder:text-slate-400" 
                />
              </div>
            ) : (
              <div key="file-upload">
                <label className="block text-xs font-black uppercase text-slate-400 mb-2">Video File</label>
                <Input 
                  type="file" 
                  accept="video/*"
                  onChange={(e) => e.target.files?.[0] && setVidFile(e.target.files[0])}
                  className="h-14 rounded-2xl pt-3.5" 
                />
                <p className="text-xs text-blue-600 mt-2 font-medium bg-blue-50 p-3 rounded-lg border border-blue-100">
                  Files are safely compressed into Firebase Cloud Storage to protect your database limits.
                </p>
                {uploadingVid && vidUploadType === 'file' && (
                  <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden mt-4">
                    <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${vidProgress}%` }}></div>
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

      <div className="p-8 rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50">
         <h2 className="text-2xl font-black text-slate-900 mb-6">Current {activeTab === 'images' ? 'Gallery' : 'Videos'}</h2>
         <div className="space-y-12">
            {CATEGORIES.map(cat => (
               <div key={cat} className="border-b border-slate-100 pb-8 last:border-0">
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
         <DialogContent className="sm:max-w-md border-slate-200">
           <DialogHeader>
             <DialogTitle>Create New Album</DialogTitle>
           </DialogHeader>
           
           <div className="space-y-4 py-4">
             <div>
               <label className="block text-xs font-black uppercase text-slate-400 mb-2">Album Title</label>
               <Input 
                 placeholder="e.g. Door to door for cargo" 
                 value={newAlbumTitle}
                 onChange={e => setNewAlbumTitle(e.target.value)}
                 className="h-12 rounded-xl"
               />
             </div>
             <div>
               <label className="block text-xs font-black uppercase text-slate-400 mb-2">Description</label>
               <textarea 
                 placeholder="e.g. We offer simple and efficient door-to-door delivery for all your cargo needs..." 
                 value={newAlbumDesc}
                 onChange={e => setNewAlbumDesc(e.target.value)}
                 className="w-full rounded-xl border border-slate-200 p-3 min-h-[100px] text-sm focus:ring-2 focus:ring-blue-500/20"
               />
             </div>
           </div>

           <DialogFooter>
             <Button variant="outline" onClick={() => setShowAlbumModal(false)}>Cancel</Button>
             <Button onClick={handleCreateAlbum} disabled={!newAlbumTitle || creatingAlbum} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
               {creatingAlbum ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
               Create Album
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

    </div>
  );
}
