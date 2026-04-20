import React, { useState } from 'react';
import { uploadGalleryImage, CATEGORIES, Category } from '../services/galleryService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';

export default function GalleryManagement() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | ''>('');
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleUpload = async () => {
    if (!file || !category) return;
    setUploading(true);
    try {
      await uploadGalleryImage(file, category);
      alert('Image uploaded successfully!');
      setFile(null);
      setPreview(null);
      setCategory('');
    } catch (err) {
      console.error(err);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50">
      <h2 className="text-2xl font-black text-slate-900 mb-6">Gallery Management</h2>
      
      <div className="space-y-6">

        <div>
          <label className="block text-xs font-black uppercase text-slate-400 mb-2">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="w-full h-14 rounded-2xl border border-slate-200 px-4 focus:ring-2 focus:ring-blue-500/20">
            <option value="">Select a category</option>
            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-black uppercase text-slate-400 mb-2">Image</label>
          <Input type="file" accept="image/*" onChange={handleFileChange} className="h-14 rounded-2xl pt-3.5" />
        </div>

        {preview && (
          <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-slate-200">
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            <button onClick={() => { setFile(null); setPreview(null); }} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full"><X size={16}/></button>
          </div>
        )}

        <Button onClick={handleUpload} disabled={!file || !category || uploading} className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Upload className="w-5 h-5 mr-2" /> Upload Image</>}
        </Button>
      </div>
    </div>
  );
}
