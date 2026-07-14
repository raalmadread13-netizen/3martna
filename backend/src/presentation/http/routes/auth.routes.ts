import { Router } from 'express';
import { authController } from '@presentation/http/controllers/auth.controller';
import { authenticate } from '@presentation/http/middleware/auth';
import { authLimiter } from '@presentation/http/middleware/rateLimiter';
import { validate } from '@presentation/http/middleware/validate';
import {
  changePasswordSchema,
  confirmVerificationSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  requestVerificationSchema,
  resetPasswordSchema,
} from '@presentation/http/validation/auth.validation';

export const authRoutes = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Register a new account (assigned the Resident role)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, phoneNumber, password]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string, nullable: true }
 *               phoneNumber: { type: string, example: "+962790000000" }
 *               password: { type: string, minLength: 8, description: "Needs upper, lower and digit" }
 *               preferredLanguage: { type: string, enum: [ar, en], default: ar }
 *     responses:
 *       201: { description: Account created — returns user + token pair }
 *       400: { description: Validation failure or weak password }
 *       409: { description: Phone or email already registered }
 */
authRoutes.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  authController.register,
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Login with email or phone + password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier: { type: string, description: Email or phone number }
 *               password: { type: string }
 *     responses:
 *       200: { description: User profile + access/refresh token pair }
 *       401: { description: Invalid credentials (generic — no enumeration) }
 *       429: { description: Account temporarily locked after repeated failures }
 */
authRoutes.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Rotate the refresh token and get a new access token
 *     description: Presenting a previously-used refresh token revokes every session (reuse detection).
 *     responses:
 *       200: { description: New token pair }
 *       401: { description: Invalid, expired or reused refresh token }
 */
authRoutes.post('/refresh', validate({ body: refreshSchema }), authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the presented refresh token
 *     responses:
 *       200: { description: Logged out }
 */
authRoutes.post('/logout', authenticate, validate({ body: logoutSchema }), authController.logout);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password (revokes all sessions)
 *     responses:
 *       200: { description: Password changed }
 *       401: { description: Current password incorrect }
 */
authRoutes.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Request a password-reset code (email or SMS)
 *     description: Always succeeds — the response never reveals whether the account exists.
 *     responses:
 *       200: { description: Generic acknowledgement }
 */
authRoutes.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Reset the password using the 6-digit code
 *     responses:
 *       200: { description: Password reset — all sessions revoked }
 *       400: { description: Invalid or expired code (generic) }
 */
authRoutes.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);

/**
 * @openapi
 * /auth/verification/request:
 *   post:
 *     tags: [Auth]
 *     summary: Send a 6-digit email/phone verification code
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [channel]
 *             properties:
 *               channel: { type: string, enum: [email, phone] }
 *     responses:
 *       200: { description: Code sent }
 *       400: { description: Already verified / no email on account }
 */
authRoutes.post(
  '/verification/request',
  authenticate,
  authLimiter,
  validate({ body: requestVerificationSchema }),
  authController.requestVerification,
);

/**
 * @openapi
 * /auth/verification/confirm:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm a verification code and mark email/phone verified
 *     responses:
 *       200: { description: Verified }
 *       400: { description: Invalid or expired code }
 */
authRoutes.post(
  '/verification/confirm',
  authenticate,
  validate({ body: confirmVerificationSchema }),
  authController.confirmVerification,
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Current user profile with roles and permissions
 *     responses:
 *       200: { description: Public user profile }
 *       401: { description: Missing or invalid token }
 */
authRoutes.get('/me', authenticate, authController.me);
