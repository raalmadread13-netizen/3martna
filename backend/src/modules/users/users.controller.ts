import { Request, Response } from 'express';
import { execProc, execProcOne } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';
import { isAdmin } from '../../middleware/auth';

const getUserOr404 = async (userId: number) => {
  const user = await execProcOne('sp_User_GetById', { UserId: userId });
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

export const usersController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const { recordset } = await execProc('sp_User_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      Search: req.query.search ?? null,
      Role: req.query.role ?? null,
      IsActive: req.query.isActive ?? null,
      SortBy: req.query.sortBy ?? 'CreatedAt',
      SortDir: req.query.sortDir ?? 'DESC',
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),

  me: catchAsync(async (req: Request, res: Response) => {
    const user = await getUserOr404(req.user!.userId);
    res.json({ success: true, data: user });
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const user = await getUserOr404(Number(req.params.id));
    res.json({ success: true, data: user });
  }),

  updateMe: catchAsync(async (req: Request, res: Response) => {
    const user = await execProcOne('sp_User_Update', {
      UserId: req.user!.userId,
      FullName: req.body.fullName ?? null,
      Email: req.body.email ?? null,
      NationalId: req.body.nationalId ?? null,
      ProfileImageUrl: req.body.profileImageUrl ?? null,
      Address: req.body.address ?? null,
      DateOfBirth: req.body.dateOfBirth ?? null,
      Gender: req.body.gender ?? null,
      PreferredLanguage: req.body.preferredLanguage ?? null,
    });
    res.json({ success: true, data: user });
  }),

  /** Admin: enable/disable an account. */
  setActive: catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_User_SetActive', {
      UserId: Number(req.params.id),
      IsActive: req.body.isActive,
    });
    res.json({ success: true, message: 'Account status updated' });
  }),

  /** Self-service account deletion (soft delete, GDPR-style anonymisation). */
  deleteMe: catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_User_SoftDelete', { UserId: req.user!.userId });
    res.json({ success: true, message: 'Account deleted' });
  }),

  /** Admin: delete any account. */
  deleteById: catchAsync(async (req: Request, res: Response) => {
    if (Number(req.params.id) === req.user!.userId) {
      throw ApiError.badRequest('Use /users/me to delete your own account');
    }
    await execProc('sp_User_SoftDelete', { UserId: Number(req.params.id) });
    res.json({ success: true, message: 'Account deleted' });
  }),

  roles: catchAsync(async (_req: Request, res: Response) => {
    const { recordset } = await execProc('sp_Role_List');
    res.json({ success: true, data: recordset });
  }),

  assignRole: catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_UserRole_Assign', {
      UserId: Number(req.params.id),
      RoleName: req.body.role,
      BuildingId: req.body.buildingId ?? null,
    });
    res.json({ success: true, data: await getUserOr404(Number(req.params.id)) });
  }),

  removeRole: catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_UserRole_Remove', {
      UserId: Number(req.params.id),
      RoleName: req.params.role,
    });
    res.json({ success: true, data: await getUserOr404(Number(req.params.id)) });
  }),

  /* ---- settings ---- */
  getSettings: catchAsync(async (req: Request, res: Response) => {
    const settings = await execProcOne('sp_UserSettings_Get', { UserId: req.user!.userId });
    res.json({ success: true, data: settings });
  }),

  updateSettings: catchAsync(async (req: Request, res: Response) => {
    const settings = await execProcOne('sp_UserSettings_Update', {
      UserId: req.user!.userId,
      PushNotifications: req.body.pushNotifications ?? null,
      EmailNotifications: req.body.emailNotifications ?? null,
      SmsNotifications: req.body.smsNotifications ?? null,
      Theme: req.body.theme ?? null,
      BiometricEnabled: req.body.biometricEnabled ?? null,
    });
    res.json({ success: true, data: settings });
  }),

  /* ---- emergency contacts ---- */
  listEmergencyContacts: catchAsync(async (req: Request, res: Response) => {
    const targetId =
      req.params.id && isAdmin(req) ? Number(req.params.id) : req.user!.userId;
    const { recordset } = await execProc('sp_EmergencyContact_List', { UserId: targetId });
    res.json({ success: true, data: recordset });
  }),

  addEmergencyContact: catchAsync(async (req: Request, res: Response) => {
    const contact = await execProcOne('sp_EmergencyContact_Create', {
      UserId: req.user!.userId,
      Name: req.body.name,
      Phone: req.body.phone,
      Relationship: req.body.relationship ?? null,
    });
    res.status(201).json({ success: true, data: contact });
  }),

  deleteEmergencyContact: catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_EmergencyContact_Delete', {
      ContactId: Number(req.params.contactId),
      UserId: req.user!.userId,
    });
    res.json({ success: true, message: 'Contact removed' });
  }),

  /* ---- devices (push tokens) ---- */
  registerDevice: catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_UserDevice_Register', {
      UserId: req.user!.userId,
      DeviceKey: req.body.deviceKey,
      FcmToken: req.body.fcmToken ?? null,
      Platform: req.body.platform,
      AppVersion: req.body.appVersion ?? null,
    });
    res.json({ success: true, message: 'Device registered' });
  }),
};
