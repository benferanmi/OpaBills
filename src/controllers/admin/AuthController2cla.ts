// import { Request, Response } from "express";
// import { AdminAuthService } from "@/services/admin/AdminAuthService";
// import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
// import { HTTP_STATUS } from "@/utils/constants";
// import { AuthenticatedAdminRequest } from "@/middlewares/admin/adminAuth";

// export class AdminAuthController {
//   private authService: AdminAuthService;

//   constructor() {
//     this.authService = new AdminAuthService();
//   }

//   login = async (req: Request, res: Response) => {
//     try {
//       const { email, password } = req.body;
//       const result = await this.authService.login(email, password);
//       return sendSuccessResponse(
//         res,
//         "Login successful",
//         result,
//         HTTP_STATUS.OK
//       );
//     } catch (error: any) {
//       return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
//     }
//   };

//   verify2FA = async (req: Request, res: Response) => {
//     try {
//       const { email, otp } = req.body;
//       const result = await this.authService.verify2FA(email, otp);
//       return sendSuccessResponse(
//         res,
//         "2FA verified successfully",
//         result,
//         HTTP_STATUS.OK
//       );
//     } catch (error: any) {
//       return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
//     }
//   };

//   resend2FA = async (req: Request, res: Response) => {
//     try {
//       const { email } = req.body;
//       const result = await this.authService.resend2FA(email);
//       return sendSuccessResponse(res, null, result.message);
//     } catch (error: any) {
//       return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
//     }
//   };

//   toggle2FA = async (req: AuthenticatedAdminRequest, res: Response) => {
//     try {
//       const { enable } = req.body;
//       const result = await this.authService.toggle2FA(
//         req.admin._id.toString(),
//         enable
//       );
//       return sendSuccessResponse(res, result.message, result, HTTP_STATUS.OK);
//     } catch (error: any) {
//       return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
//     }
//   };

//   sendPasswordResetToken = async (req: Request, res: Response) => {
//     try {
//       const { email } = req.body;
//       const result = await this.authService.sendPasswordResetToken(email);
//       return sendSuccessResponse(res, null, result.message);
//     } catch (error: any) {
//       return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
//     }
//   };

//   verifyPasswordResetToken = async (req: Request, res: Response) => {
//     try {
//       const { email, token } = req.body;
//       const result = await this.authService.verifyPasswordResetToken(
//         email,
//         token
//       );
//       return sendSuccessResponse(res, null, result.message);
//     } catch (error: any) {
//       return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
//     }
//   };

//   resetPassword = async (req: Request, res: Response) => {
//     try {
//       const { email, token, newPassword } = req.body;
//       const result = await this.authService.resetPassword(
//         email,
//         token,
//         newPassword
//       );
//       return sendSuccessResponse(res, null, result.message);
//     } catch (error: any) {
//       return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
//     }
//   };

//   updatePassword = async (req: AuthenticatedAdminRequest, res: Response) => {
//     try {
//       const { currentPassword, newPassword } = req.body;
//       const result = await this.authService.updatePassword(
//         req.admin._id.toString(),
//         currentPassword,
//         newPassword
//       );
//       return sendSuccessResponse(res, null, result.message);
//     } catch (error: any) {
//       return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
//     }
//   };

//   updateProfile = async (req: AuthenticatedAdminRequest, res: Response) => {
//     try {
//       const result = await this.authService.updateProfile(
//         req.admin._id.toString(),
//         req.body
//       );
//       return sendSuccessResponse(
//         res,
//         "Profile updated successfully",
//         result,
//         HTTP_STATUS.OK
//       );
//     } catch (error: any) {
//       return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
//     }
//   };

//   getProfile = async (req: AuthenticatedAdminRequest, res: Response) => {
//     try {
//       return sendSuccessResponse(
//         res,
//         "Admin profile",
//         req.admin,
//         HTTP_STATUS.OK
//       );
//     } catch (error: any) {
//       return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
//     }
//   };

//   logout = async (req: AuthenticatedAdminRequest, res: Response) => {
//     try {
//       const result = await this.authService.logout(req.admin._id.toString());
//       return sendSuccessResponse(res, null, result.message);
//     } catch (error: any) {
//       return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
//     }
//   };
// }
