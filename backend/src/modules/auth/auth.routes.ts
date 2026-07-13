import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimiter';
import { validate } from '../../middleware/validate';
import { authController } from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  otpLoginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.validation';

export const authRoutes = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Register a new account (Tenant, ApartmentOwner or BuildingOwner)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, phone, password]
 *             properties:
 *               fullName: { type: string }
 *               email: { type: string }
 *               phone: { type: string, example: "+962790000000" }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [Tenant, ApartmentOwner, BuildingOwner] }
 *               firebaseIdToken: { type: string, description: Firebase OTP proof of phone ownership }
 *     responses:
 *       201: { description: Account created with token pair }
 *       409: { description: Phone or email already registered }
 */
authRoutes.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Login with email/phone + password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier: { type: string, description: Email or phone }
 *               password: { type: string }
 *               deviceKey: { type: string }
 *               fcmToken: { type: string }
 *     responses:
 *       200: { description: Token pair + user profile }
 *       401: { description: Invalid credentials }
 */
authRoutes.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);

/**
 * @openapi
 * /auth/otp-login:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Login using a Firebase phone-OTP ID token
 *     responses:
 *       200: { description: Token pair + user profile }
 */
authRoutes.post('/otp-login', authLimiter, validate({ body: otpLoginSchema }), authController.otpLogin);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Rotate refresh token and get a new access token
 *     responses:
 *       200: { description: New token pair }
 *       401: { description: Invalid refresh token }
 */
authRoutes.post('/refresh', validate({ body: refreshSchema }), authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the refresh token and unregister the device
 *     responses:
 *       200: { description: Logged out }
 */
authRoutes.post('/logout', authenticate, validate({ body: logoutSchema }), authController.logout);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Request a password-reset token (no account enumeration)
 *     responses:
 *       200: { description: Always succeeds }
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
 *     summary: Reset password using a reset token
 *     responses:
 *       200: { description: Password reset }
 */
authRoutes.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password (revokes all sessions)
 *     responses:
 *       200: { description: Password changed }
 */
authRoutes.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);
