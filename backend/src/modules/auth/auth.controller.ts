import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import { authService } from './auth.service';

export const authController = {
  register: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result });
  }),

  login: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.login({ ...req.body, ip: req.ip });
    res.json({ success: true, data: result });
  }),

  otpLogin: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.otpLogin({ ...req.body, ip: req.ip });
    res.json({ success: true, data: result });
  }),

  refresh: catchAsync(async (req: Request, res: Response) => {
    const tokens = await authService.refresh(req.body.refreshToken, req.ip);
    res.json({ success: true, data: tokens });
  }),

  logout: catchAsync(async (req: Request, res: Response) => {
    await authService.logout(req.user!.userId, req.body.refreshToken, req.body.deviceKey);
    res.json({ success: true, message: 'Logged out' });
  }),

  forgotPassword: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body.identifier);
    res.json({
      success: true,
      message: 'If the account exists, a reset link has been sent',
      ...(result.resetToken ? { data: result } : {}),
    });
  }),

  resetPassword: catchAsync(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    res.json({ success: true, message: 'Password has been reset' });
  }),

  changePassword: catchAsync(async (req: Request, res: Response) => {
    await authService.changePassword(
      req.user!.userId,
      req.body.currentPassword,
      req.body.newPassword,
    );
    res.json({ success: true, message: 'Password changed' });
  }),
};
