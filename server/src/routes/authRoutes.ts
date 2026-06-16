// POST /api/auth/google
// GET  /api/auth/me

import { Router } from "express";

import {
  googleLogin,
  getCurrentUser,
} from "../controllers/authController";

import {
  authenticateUser,
} from "../middleware/auth";

const router = Router();

/**
 * POST /api/auth/google
 */
router.post(
  "/google",
  googleLogin
);

/**
 * GET /api/auth/me
 */
router.get(
  "/me",
  authenticateUser,
  getCurrentUser
);

export default router;