// import { Router } from 'express';
// // import { AdminAuthController } from '@/controllers/admin/AuthController';
// import { adminAuth } from '@/middlewares/admin/adminAuth';

// const router = Router();
// const authController = new AdminAuthController();

// // Public routes
// router.post('/login', authController.login);
// router.post('/2fa/verify', authController.verify2FA);
// router.post('/2fa/resend', authController.resend2FA);
// router.post('/password/resend', authController.sendPasswordResetToken);
// router.post('/password/verify', authController.verifyPasswordResetToken);
// router.post('/password/reset', authController.resetPassword);

// // Protected routes
// router.use(adminAuth);
// router.get('/user', authController.getProfile);
// router.post('/logout', authController.logout);
// router.put('/2fa/toggle', authController.toggle2FA);
// router.post('/password/update', authController.updatePassword);
// router.post('/profile', authController.updateProfile);

// export default router;
