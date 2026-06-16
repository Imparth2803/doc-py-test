import multer from 'multer';
import path from 'path';
import fs from 'fs';

console.log('\nUPLOAD MIDDLEWARE LOADED');

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../../uploads');

console.log('UPLOAD DIRECTORY:', uploadDir);

if (!fs.existsSync(uploadDir)) {
  console.log('Creating uploads directory...');

  fs.mkdirSync(uploadDir, { recursive: true });

  console.log('Uploads directory created');
}

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('\n[MULTER] destination() called');

    console.log('FILE:', file.originalname);

    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    console.log('\n[MULTER] filename() called');

    const uniqueName =
      Date.now() + '-' + file.originalname;

    console.log('Generated filename:', uniqueName);

    cb(null, uniqueName);
  },
});

// Allowed types
const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

// File filter
const fileFilter: multer.Options['fileFilter'] = (
  req,
  file,
  cb
) => {
  console.log('\n[MULTER] fileFilter() called');

  console.log('Incoming MIME TYPE:', file.mimetype);

  console.log('Incoming FILE NAME:', file.originalname);

  if (allowedMimeTypes.includes(file.mimetype)) {
    console.log('✅ FILE TYPE ACCEPTED');

    cb(null, true);

  } else {
    console.log('❌ FILE TYPE REJECTED');

    cb(
      new Error(
        `Invalid file type: ${file.mimetype}`
      )
    );
  }
};

// Export upload middleware
export const upload = multer({
  storage,
  fileFilter,
});