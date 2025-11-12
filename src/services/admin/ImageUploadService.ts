import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

export class ImageUploadService {
  private uploadDir: string;
  private allowedMimeTypes: string[];
  private maxFileSize: number;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    this.maxFileSize = 5 * 1024 * 1024; // 5MB

    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadImage(file: any, folder: string = 'general') {
    // Validate file
    if (!file) {
      throw new Error('No file provided');
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only images are allowed');
    }

    if (file.size > this.maxFileSize) {
      throw new Error('File size exceeds maximum limit of 5MB');
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const folderPath = path.join(this.uploadDir, folder);

    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const filePath = path.join(folderPath, fileName);

    // Save file
    await file.mv(filePath);

    // Return URL path
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const imageUrl = `${baseUrl}/uploads/${folder}/${fileName}`;

    return {
      message: 'Image uploaded successfully',
      imageUrl,
      fileName,
      folder,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async deleteImage(imageUrl: string) {
    try {
      // Extract file path from URL
      const urlPath = new URL(imageUrl).pathname;
      const filePath = path.join(process.cwd(), urlPath);

      // Check if file exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return {
          message: 'Image deleted successfully',
        };
      } else {
        throw new Error('Image not found');
      }
    } catch (error) {
      throw new Error('Failed to delete image');
    }
  }

  async uploadMultipleImages(files: any[], folder: string = 'general') {
    const uploadPromises = files.map((file) => this.uploadImage(file, folder));
    const results = await Promise.all(uploadPromises);
    return {
      message: `${results.length} images uploaded successfully`,
      images: results,
    };
  }
}
