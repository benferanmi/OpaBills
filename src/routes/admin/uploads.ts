import { Router } from 'express';
import { ImageUploadController } from '@/controllers/admin/ImageUploadController';
import { adminAuth } from '@/middlewares/admin/adminAuth';
import { requirePermission } from '@/middlewares/admin/adminPermission';
import { ADMIN_PERMISSIONS } from '@/utils/admin-permissions';

const router = Router();
const imageUploadController = new ImageUploadController();

router.use(adminAuth);

router.post(
  '/image',
  requirePermission(ADMIN_PERMISSIONS.SETTINGS.UPDATE),
  imageUploadController.uploadImage
);

router.post(
  '/images',
  requirePermission(ADMIN_PERMISSIONS.SETTINGS.UPDATE),
  imageUploadController.uploadMultipleImages
);

// router.delete(
//   '/image',
//   requirePermission(ADMIN_PERMISSIONS.SETTINGS.UPDATE),
//   imageUploadController.deleteImage
// );

export default router;
