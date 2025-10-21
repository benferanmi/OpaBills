import { Router } from "express";
import { ProfileController } from "@/controllers/ProfileController";
import { ProfileService } from "@/services/ProfileService";
import { UserRepository } from "@/repositories/UserRepository";
import { CacheService } from "@/services/CacheService";
import { authenticate } from "@/middlewares/auth";
import { validateQuery, validateRequest } from "@/middlewares/validation";
import {
  updateProfileSchema,
  toogleBiometricSchema,
} from "@/validations/profileValidation";

const router = Router();

// Initialize dependencies
const userRepository = new UserRepository();
const cacheService = new CacheService();
const profileService = new ProfileService(userRepository, cacheService);
const profileController = new ProfileController(profileService);

// Routes (all protected)
router.use(authenticate);
router.get("/", profileController.getProfile);
router.put(
  "/",
  validateRequest(updateProfileSchema),
  profileController.updateProfile
);
router.put(
  "/biometric",
  validateRequest(toogleBiometricSchema),
  profileController.toogleBiometric
);
router.post("/deactivate", profileController.deactivateAccount)

export default router;
