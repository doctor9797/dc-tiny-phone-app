import React, { useRef } from 'react';

export default function ImageUploader({ 
  onImageSelected, 
  className, 
  children 
}: { 
  onImageSelected: (url: string) => void, 
  className?: string, 
  children?: React.ReactNode 
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max_size = 500;
          if (width > max_size || height > max_size) {
            if (width > height) {
              height = Math.round((height * max_size) / width);
              width = max_size;
            } else {
              width = Math.round((width * max_size) / height);
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          onImageSelected(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={className} onClick={() => fileInputRef.current?.click()}>
      {children}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  );
}
