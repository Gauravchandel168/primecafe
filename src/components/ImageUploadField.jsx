import { useRef, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import { FiUpload, FiImage } from 'react-icons/fi';
import { storage } from '../firebase';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// A plain <input type="file" accept="image/*"> is enough for the browser
// to offer "Camera" or "Photo Library" on a phone, and a normal file
// browser on desktop — no extra branching needed for that part.
export default function ImageUploadField({ value, onChange, folder, label = 'Image' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be picked again later
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const path = `${folder}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      onChange(url);
      toast.success('Image uploaded');
    } catch (err) {
      console.error('Image upload failed:', err);
      toast.error('Upload failed — try again');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="sm:col-span-2">
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-[#F5EFE6]">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <FiImage className="text-gray-400" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            <FiUpload size={14} />
            {uploading ? 'Uploading...' : value ? 'Change photo' : 'Upload photo'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="or paste an image URL"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
