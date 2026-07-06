import nodemailer from 'nodemailer';
import fs from 'fs';
import { IDocument } from '../models/Document';
import { getAbsoluteStoragePath } from '../utils/storagePathUtils';
import { buildDownloadFilename } from '../utils/filenameUtils';

// Initialize the Nodemailer transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

export const sendDocumentEmail = async (to: string, doc: IDocument): Promise<void> => {
  const absolutePath = getAbsoluteStoragePath(doc.storagePath);

  // 1. Read file from disk
  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.promises.readFile(absolutePath);
  } catch (err: any) {
    throw new Error(`Failed to read document file from disk: ${err.message}`);
  }

  // 2. Construct the email details
  const docName = buildDownloadFilename(doc.documentName || '', doc.originalName || '', doc.mimeType);
  const metadataText = `Document Details:\nName: ${docName}\nEntities: ${(doc.entities || []).join(', ') || 'N/A'}\nCategory: ${doc.vaultFolder || 'N/A'}\nType: ${doc.docType || 'N/A'}\nTags: ${(doc.tags || []).join(', ')}`;
  const disclaimerText = `---------------------------------------------------------\n\nCONFIDENTIALITY & SECURITY NOTICE: This email is generated via DMS (Document Management System, dms.com) and contains sensitive personal documentation transmitted voluntarily by the sender for the intended recipient's exclusive use. This communication is strictly confidential; the recipient is legally required to safeguard this data and process it solely for its authorized purpose under applicable data protection laws. Because standard email transmission is not fully encrypted, DMS accepts no liability for interception during transit. If you are not the intended recipient, any disclosure, copying, or misuse of this information is strictly prohibited; you must notify the sender immediately, permanently delete this email, and destroy all attached copies.\n\n---------------------------------------------------------`;

  const metadataHtml = `<strong>Document Details:</strong><br>Name: ${docName}<br>Entities: ${(doc.entities || []).join(', ') || 'N/A'}<br>Category: ${doc.vaultFolder || 'N/A'}<br>Type: ${doc.docType || 'N/A'}<br>Tags: ${(doc.tags || []).join(', ')}`;
  const disclaimerHtml = `<div style="font-family:Calibri,Helvetica,sans-serif;font-size:8pt;color:rgb(0,0,0)">
  <i>---------------------------------------------------------<br><br>CONFIDENTIALITY & SECURITY NOTICE: This email is generated via DMS (Document Management System, dms.com) and contains sensitive personal documentation transmitted voluntarily by the sender for the intended recipient's exclusive use. This communication is strictly confidential; the recipient is legally required to safeguard this data and process it solely for its authorized purpose under applicable data protection laws. Because standard email transmission is not fully encrypted, DMS accepts no liability for interception during transit. If you are not the intended recipient, any disclosure, copying, or misuse of this information is strictly prohibited; you must notify the sender immediately, permanently delete this email, and destroy all attached copies.<br><br>---------------------------------------------------------</i>
</div>`;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@dms.com',
    to,
    subject: `Shared Document: ${docName}`,
    text: `Please review this document:\n\n${metadataText}\n\n${disclaimerText}`,
    html: `<p>Please review this document:</p><p>${metadataHtml}</p><br>${disclaimerHtml}`,
    attachments: [
      {
        filename: docName,
        content: fileBuffer,
        contentType: doc.mimeType,
      },
    ],
  };

  // 3. Send email using the transporter
  try {
    await transporter.sendMail(mailOptions);
  } catch (err: any) {
    throw new Error(`Failed to send email via SMTP transporter: ${err.message}`);
  }
};
