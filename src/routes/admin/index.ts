import { Router } from "express";
import adminAuthRoutes from "./auth";

const router = Router();

//admin
router.use("/auth", adminAuthRoutes);

export default router;
