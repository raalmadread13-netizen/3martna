import { Router } from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../../middleware/auth';
import { id, pageQuery, phone, validate } from '../../middleware/validate';
import { usersController } from './users.controller';

export const usersRoutes = Router();
usersRoutes.use(authenticate);

const idParam = Joi.object({ id: id.required() });

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List users (admin) with search, role filter, sorting & pagination
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: pageSize, schema: { type: integer } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: role, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Paginated users
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Paginated' }
 */
usersRoutes.get(
  '/',
  authorize('SystemAdmin'),
  validate({
    query: Joi.object({
      ...pageQuery,
      search: Joi.string().max(150),
      role: Joi.string().max(50),
      isActive: Joi.boolean(),
      sortBy: Joi.string().valid('CreatedAt', 'FullName').default('CreatedAt'),
      sortDir: Joi.string().valid('ASC', 'DESC').default('DESC'),
    }),
  }),
  usersController.list,
);

/** @openapi
 * /users/me:
 *   get: { tags: [Users], summary: Current user profile, responses: { 200: { description: Profile } } }
 */
usersRoutes.get('/me', usersController.me);

usersRoutes.put(
  '/me',
  validate({
    body: Joi.object({
      fullName: Joi.string().min(2).max(150),
      email: Joi.string().email().max(255),
      nationalId: Joi.string().max(20),
      profileImageUrl: Joi.string().uri().max(500),
      address: Joi.string().max(300),
      dateOfBirth: Joi.date().iso().max('now'),
      gender: Joi.string().valid('Male', 'Female'),
      preferredLanguage: Joi.string().valid('ar', 'en'),
    }).min(1),
  }),
  usersController.updateMe,
);

usersRoutes.delete('/me', usersController.deleteMe);

usersRoutes.get('/roles/all', usersController.roles);

/* Settings */
usersRoutes.get('/me/settings', usersController.getSettings);
usersRoutes.put(
  '/me/settings',
  validate({
    body: Joi.object({
      pushNotifications: Joi.boolean(),
      emailNotifications: Joi.boolean(),
      smsNotifications: Joi.boolean(),
      theme: Joi.string().valid('light', 'dark', 'system'),
      biometricEnabled: Joi.boolean(),
    }).min(1),
  }),
  usersController.updateSettings,
);

/* Emergency contacts */
usersRoutes.get('/me/emergency-contacts', usersController.listEmergencyContacts);
usersRoutes.post(
  '/me/emergency-contacts',
  validate({
    body: Joi.object({
      name: Joi.string().min(2).max(150).required(),
      phone: phone.required(),
      relationship: Joi.string().max(50),
    }),
  }),
  usersController.addEmergencyContact,
);
usersRoutes.delete(
  '/me/emergency-contacts/:contactId',
  validate({ params: Joi.object({ contactId: id.required() }) }),
  usersController.deleteEmergencyContact,
);

/* Devices */
usersRoutes.post(
  '/me/devices',
  validate({
    body: Joi.object({
      deviceKey: Joi.string().max(128).required(),
      fcmToken: Joi.string().max(512),
      platform: Joi.string().valid('ios', 'android', 'web').required(),
      appVersion: Joi.string().max(20),
    }),
  }),
  usersController.registerDevice,
);

/* Admin user management */
usersRoutes.get('/:id', authorize('SystemAdmin', 'BuildingOwner'), validate({ params: idParam }), usersController.getById);
usersRoutes.patch(
  '/:id/status',
  authorize('SystemAdmin'),
  validate({ params: idParam, body: Joi.object({ isActive: Joi.boolean().required() }) }),
  usersController.setActive,
);
usersRoutes.delete('/:id', authorize('SystemAdmin'), validate({ params: idParam }), usersController.deleteById);
usersRoutes.post(
  '/:id/roles',
  authorize('SystemAdmin'),
  validate({
    params: idParam,
    body: Joi.object({ role: Joi.string().max(50).required(), buildingId: id }),
  }),
  usersController.assignRole,
);
usersRoutes.delete(
  '/:id/roles/:role',
  authorize('SystemAdmin'),
  validate({ params: Joi.object({ id: id.required(), role: Joi.string().max(50).required() }) }),
  usersController.removeRole,
);
