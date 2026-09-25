import { useRef, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import { FiUpload, FiImage } from 'react-icons/fi';
import { storage } from '../firebase';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB (checked before compression)
const MAX_DIMENSION = 1200; // menu/hero photos never need to be wider than this

// A phone photo is often 3000-4000px wide and several MB, but a menu card
// only ever shows it at ~150px. Shrinking it in the browser before upload
// means a much smaller file goes over the network now, and a much
// smaller file loads for every customer who ever opens this menu.
function compressImage(file, maxDimension = MAX_DIMENSION) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Keep PNGs as PNG (logos/graphics may rely on transparency);
      // everything else becomes a compressed JPEG.
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Could not process image'));
        },
        outputType,
        0.82
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image'));
    };
    img.src = objectUrl;
  });
}

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
      let toUpload = file;
      try {
        toUpload = await compressImage(file);
      } catch (compressErr) {
        // If compression fails for any reason, still upload the original
        // rather than blocking the admin from adding the photo at all.
        console.warn('Image compression skipped:', compressErr);
      }

      const path = `${folder}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, toUpload);
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
