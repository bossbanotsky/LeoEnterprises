import React, { useState } from 'react';
import { uploadImage, addVideoUrl, uploadVideoFile, CATEGORIES, Category } from '../services/galleryService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2, Upload, X, Image as ImageIcon, Video, Link as LinkIcon, FileVideo } from 'lucide-react';
import GalleryViewer from './GalleryViewer';
import VideoViewer from './VideoViewer';

export default function GalleryManagement() {
  const [activeTab, setActiveTab] = useState<'images' | 'videos'>('images');
  
  // Image State
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleUploadImage = async () => {
    if (!file || !imgCategory) return;
    setUploadingImg(true);
    setProgress(0);
    try {
      await uploadImage(file, imgCategory, (p) => setProgress(p));
      alert('Image added to gallery!');
      setFile(null);
      setPreview(null);
      setImgCategory('');
    } catch (err: any) {
      console.error(err);
      alert(err.message);
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
        await addVideoUrl(videoUrl, vidCategory);
        alert('Video embedded successfully!');
        setVideoUrl('');
      } else {
        await uploadVideoFile(vidFile!, vidCategory, (p) => setVidProgress(p));
        alert('Video uploaded to Cloud Storage successfully!');
        setVidFile(null);
      }
      setVidCategory('');
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

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-2">Image</label>
              <Input type="file" accept="image/*" onChange={handleFileChange} className="h-14 rounded-2xl pt-3.5" />
            </div>

            {uploadingImg && (
              <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            )}

            {preview && !uploadingImg && (
              <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-slate-200">
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                <button onClick={() => { setFile(null); setPreview(null); }} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full"><X size={16}/></button>
              </div>
            )}

            <Button onClick={handleUploadImage} disabled={!file || !imgCategory || uploadingImg} className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black">
              {uploadingImg ? `Uploading... ${Math.round(progress)}%` : <><Upload className="w-5 h-5 mr-2" /> Upload Image</>}
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
    </div>
  );
}
