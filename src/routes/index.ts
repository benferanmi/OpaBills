import { Router } from "express";
import adminRoute from "./admin";
import clientRoute from "./client";

const router = Router();

router.use("/admin", adminRoute);
router.use("/", clientRoute);

export default router;
