import Joi from 'joi';
import { password, phone } from '../../middleware/validate';

export const registerSchema = Joi.object({
  fullName: Joi.string().min(2).max(150).required(),
  email: Joi.string().email().max(255).allow(null, ''),
  phone: phone.required(),
  password: password.required(),
  nationalId: Joi.string().max(20).allow(null, ''),
  preferredLanguage: Joi.string().valid('ar', 'en').default('ar'),
  role: Joi.string()
    .valid('Tenant', 'ApartmentOwner', 'BuildingOwner')
    .default('Tenant'),
  // Firebase ID token proving the phone number was verified via OTP
  firebaseIdToken: Joi.string().allow(null, ''),
});

export const loginSchema = Joi.object({
  identifier: Joi.string().max(255).required(), // email or phone
  password: password.required(),
  deviceKey: Joi.string().max(128).allow(null, ''),
  fcmToken: Joi.string().max(512).allow(null, ''),
  platform: Joi.string().valid('ios', 'android', 'web').default('android'),
});

export const otpLoginSchema = Joi.object({
  firebaseIdToken: Joi.string().required(),
  deviceKey: Joi.string().max(128).allow(null, ''),
  fcmToken: Joi.string().max(512).allow(null, ''),
  platform: Joi.string().valid('ios', 'android', 'web').default('android'),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().length(64).hex().required(),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().length(64).hex().required(),
  deviceKey: Joi.string().max(128).allow(null, ''),
});

export const forgotPasswordSchema = Joi.object({
  identifier: Joi.string().max(255).required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().length(64).hex().required(),
  newPassword: password.required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: password.required(),
  newPassword: password.required(),
});
