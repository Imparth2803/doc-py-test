import { Document } from '../types';
import { emailDocument } from '../services/documentApi';

export const getShareContent = (doc: Document) => {
   const linkText = doc.previewUrl ? `\nLink: ${doc.previewUrl}` : '';
   const text = `Document Details:\nName: ${doc.name}\nEntities: ${(doc.entities || []).join(', ') || 'N/A'}\nCategory: ${doc.folder}\nType: ${doc.docType || 'N/A'}\nTags: ${doc.tags?.join(', ')}${linkText}`;
   return {
      title: doc.name,
      text: text,
      url: doc.previewUrl || window.location.origin
   };
};

export const getConfidentialityDisclaimer = () => {
   return `---------------------------------------------------------\n\nCONFIDENTIALITY & SECURITY NOTICE: This email is generated via DMS (Document Management System, dms.com) and contains sensitive personal documentation transmitted voluntarily by the sender for the intended recipient's exclusive use. This communication is strictly confidential; the recipient is legally required to safeguard this data and process it solely for its authorized purpose under applicable data protection laws. Because standard email transmission is not fully encrypted, DMS accepts no liability for interception during transit. If you are not the intended recipient, any disclosure, copying, or misuse of this information is strictly prohibited; you must notify the sender immediately, permanently delete this email, and destroy all attached copies.\n\n---------------------------------------------------------`;
};

export const shareToWhatsApp = (doc: Document) => {
   const { text } = getShareContent(doc);
   const encodedText = encodeURIComponent(text);
   window.open(`https://wa.me/?text=${encodedText}`, '_blank');
};

export const shareToEmail = async (
   doc: Document,
   recipientEmail: string
): Promise<{ success: boolean; error?: string }> => {
   try {
      await emailDocument(doc._id, recipientEmail);
      return { success: true };
   } catch (error: any) {
      console.error('[SHARE_EMAIL_ERROR]', error);
      return { success: false, error: error.message || 'Failed to send email' };
   }
};

export const shareToTeams = (doc: Document) => {
   const { text } = getShareContent(doc);
   const encodedText = encodeURIComponent(text);
   window.open(`https://teams.microsoft.com/share?msgText=${encodedText}`, '_blank');
};

import { buildDownloadFilename } from './filenameUtils';

export const downloadDocument = (doc: Document) => {
   if (!doc.previewUrl) return;
   const downloadName = buildDownloadFilename(doc);

   const link = document.createElement('a');
   link.href = doc.previewUrl;
   link.download = downloadName;
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
};

/**
 * Converts a remote preview URL or base64 string into a physical browser File object
 */
const fetchFileFromUrl = async (url: string, filename: string, mimeType: string): Promise<File> => {
   console.log('\n[DOWNLOAD]');
   console.log('URL:', url);
   
   const response = await fetch(url);
   
   console.log('HTTP Status:', response.status);
   console.log('Content-Type:', response.headers.get('Content-Type') || 'N/A');
   console.log('Content-Length:', response.headers.get('Content-Length') || 'N/A');
   console.log('response.ok:', response.ok);

   if (!response.ok) {
      console.log('Download aborted due to HTTP error. Do not create File object.');
      console.log('----------------------------------------\n');
      throw new Error(`Download failed with status ${response.status}`);
   }

   const blob = await response.blob();
   console.log('Blob Size:', blob.size);
   console.log('----------------------------------------\n');

   return new File([blob], filename, { type: blob.type || mimeType });
};

export const shareDocument = async (doc: Document) => {
   const { title, text } = getShareContent(doc);
   const shareData: ShareData = { 
      title, 
      text,
      url: doc.previewUrl || window.location.origin
   };

   try {
      if (doc.previewUrl) {
         // Upgraded: Converts both base64 string AND live network links (http://localhost:8000/...) into physical file structures
         const downloadName = buildDownloadFilename(doc);
         const file = await fetchFileFromUrl(doc.previewUrl, downloadName, doc.mimeType || '');
         
         if (navigator.canShare && navigator.canShare({ files: [file] })) {
            shareData.files = [file];
            // Clear URL text if sending as a file to prevent redundancy in supportive apps
            delete shareData.url; 
         }
      }

      if (navigator.share) {
         // Triggers native mobile/mac OS panel sheet.
         // If supported (Mail app, Outlook native, AirDrop), the real file is physically attached!
         await navigator.share(shareData);
         return { success: true, method: 'native' };
      } else {
         // Fallback layout if client browser blocks the programmatic share sheet
         shareToWhatsApp(doc);
         return { success: true, method: 'whatsapp_fallback' };
      }
   } catch (err: any) {
      if (err.name !== 'AbortError') {
         console.warn('[SHARE_ENGINE] Native execution bypassed or failed. Reverting to communication links.', err);
         shareToWhatsApp(doc);
      }
      return { success: false, error: err.name };
   }
};