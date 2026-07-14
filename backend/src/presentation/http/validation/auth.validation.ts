import Joi from 'joi';

export const phone = Joi.string()
  .pattern(/^\+?[0-9]{9,15}$/)
  .messages({ 'string.pattern.base': 'phone must be a valid international number' });

/** Structural rules only — full policy is enforced in the application layer. */
export const password = Joi.string().min(8).max(128);

export const registerSchema = Joi.object({
  firstName: Joi.string().min(2).max(75).required(),
  lastName: Joi.string().min(2).max(75).required(),
  email: Joi.string().email().max(255).allow(null, ''),
  phoneNumber: phone.required(),
  password: password.required(),
  preferredLanguage: Joi.string().valid('ar', 'en').default('ar'),
});

export const loginSchema = Joi.object({
  identifier: Joi.string().max(255).required(),
  password: password.required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().length(64).hex().required(),
});

export const logoutSchema = refreshSchema;

export const changePasswordSchema = Joi.object({
  currentPassword: password.required(),
  newPassword: password.required(),
});

export const forgotPasswordSchema = Joi.object({
  identifier: Joi.string().max(255).required(),
});

export const resetPasswordSchema = Joi.object({
  identifier: Joi.string().max(255).required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required(),
  newPassword: password.required(),
});

export const requestVerificationSchema = Joi.object({
  channel: Joi.string().valid('email', 'phone').required(),
});

export const confirmVerificationSchema = Joi.object({
  channel: Joi.string().valid('email', 'phone').required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required(),
});
