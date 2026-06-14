import { Document } from '../types';

export const getShareContent = (doc: Document) => {
   const text = `Document Details:\nName: ${doc.name}\nEntities: ${(doc.entities || []).join(', ') || 'N/A'}\nCategory: ${doc.folder}\nType: ${doc.docType || 'N/A'}\nTags: ${doc.tags?.join(', ')}`;
   return {
      title: doc.name,
      text: text,
      url: window.location.origin // In a real app, this would be a specific share link
   };
};

export const shareToWhatsApp = (doc: Document) => {
   const { text } = getShareContent(doc);
   const encodedText = encodeURIComponent(text);
   window.open(`https://wa.me/?text=${encodedText}`, '_blank');
};

export const shareToEmail = (doc: Document) => {
   const { title, text } = getShareContent(doc);
   const subject = encodeURIComponent(`Shared Document: ${title}`);
   const body = encodeURIComponent(`Please review this document:\n\n${text}`);
   window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

export const shareToTeams = (doc: Document) => {
   const { text } = getShareContent(doc);
   const encodedText = encodeURIComponent(text);
   window.open(`https://teams.microsoft.com/share?msgText=${encodedText}`, '_blank');
};

export const downloadDocument = (doc: Document) => {
   if (!doc.previewUrl) return;
   const link = document.createElement('a');
   link.href = doc.previewUrl;
   link.download = doc.name;
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
};

export const shareDocument = async (doc: Document) => {
   const { title, text } = getShareContent(doc);
   const shareData: ShareData = { title, text };
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
         shareToWhatsApp(doc);
      }
   } catch(err: any) {
      if (err.name !== 'AbortError') {
         shareToWhatsApp(doc);
      }
   }
};
