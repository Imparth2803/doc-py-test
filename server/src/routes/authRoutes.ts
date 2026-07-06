// POST /api/auth/google
// GET  /api/auth/me

import { Router } from "express";

import {
  googleLogin,
  getCurrentUser,
  getGoogleToken,
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

/**
 * GET /api/auth/token
 */
router.get(
  "/token",
  authenticateUser,
  getGoogleToken
);

export default router;