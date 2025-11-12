import { Request, Response, NextFunction } from "express";
import { ImageUploadService } from "@/services/admin/ImageUploadService";

export class ImageUploadController {
  private imageUploadService: ImageUploadService;

  constructor() {
    this.imageUploadService = new ImageUploadService();
  }

  uploadImage = async (req: Request, res: Response, next: NextFunction) => {
    // try {
    //   const { folder = 'general' } = req.body;
    //   if (!req.files || !req.files.image) {
    //     return res.status(400).json({ message: 'No image file provided' });
    //   }
    //   const result = await this.imageUploadService.uploadImage(req.files.image, folder);
    //   res.status(201).json(result);
    // } catch (error) {
    //   next(error);
    // }
  };

  uploadMultipleImages = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    // try {
    //   const { folder = 'general' } = req.body;
    //   if (!req.files || !req.files.images) {
    //     return res.status(400).json({ message: 'No image files provided' });
    //   }
    //   const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
    //   const result = await this.imageUploadService.uploadMultipleImages(images, folder);
    //   res.status(201).json(result);
    // } catch (error) {
    //   next(error);
    // }
  };

  // deleteImage = async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     const { imageUrl } = req.body;

  //     if (!imageUrl) {
  //       return res.status(400).json({ message: 'Image URL is required' });
  //     }

  //     const result = await this.imageUploadService.deleteImage(imageUrl);
  //     res.json(result);
  //   } catch (error) {
  //     next(error);
  //   }
  // };
}
