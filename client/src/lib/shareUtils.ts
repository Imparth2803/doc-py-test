import { Document } from '../types';

export const shareDocument = async (doc: Document) => {
   const text = `Document Details:\nName: ${doc.name}\nEntities: ${(doc.entities || []).join(', ') || 'N/A'}\nCategory: ${doc.folder}\nType: ${doc.docType || 'N/A'}\nTags: ${doc.tags?.join(', ')}`;
   const shareData: ShareData = { title: doc.name, text: text };
   try {
      if (doc.previewUrl && doc.previewUrl.startsWith('data:')) {
         const res = await fetch(doc.previewUrl);
         const blob = await res.blob();
         const ext = doc.mimeType === 'application/pdf' ? 'pdf' : (blob.type.split('/')[1] || 'png');
         const file = new File([blob], `${doc.name.replace(/\.[^/.]+$/, "")}.${ext}`, { type: blob.type });
         if (navigator.canShare && navigator.canShare({ files: [file] })) {
            shareData.files = [file];
         }
      }
      if (navigator.share) {
         await navigator.share(shareData);
      } else {
         const encodedText = encodeURIComponent(text);
         window.open(`https://wa.me/?text=${encodedText}`, '_blank');
      }
   } catch(err: any) {
      if (err.name !== 'AbortError') {
         const encodedText = encodeURIComponent(text);
         window.open(`https://wa.me/?text=${encodedText}`, '_blank');
      }
   }
};
