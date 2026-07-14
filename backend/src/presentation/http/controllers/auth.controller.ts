import { NextFunction, Request, RequestHandler, Response } from 'express';
import { getContainer } from '@presentation/http/container';

/** Wraps an async handler so rejections reach the error middleware. */
const handle =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const ip = (req: Request): string | null => req.ip ?? null;
const userAgent = (req: Request): string | null => req.headers['user-agent'] ?? null;

export const authController = {
  register: handle(async (req, res) => {
    const result = await getContainer().registerUser.execute({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email || null,
      phoneNumber: req.body.phoneNumber,
      password: req.body.password,
      preferredLanguage: req.body.preferredLanguage,
      ip: ip(req),
      userAgent: userAgent(req),
    });
    res.status(201).json({ success: true, data: result });
  }),

  login: handle(async (req, res) => {
    const result = await getContainer().loginUser.execute({
      identifier: req.body.identifier,
      password: req.body.password,
      ip: ip(req),
      userAgent: userAgent(req),
    });
    res.json({ success: true, data: result });
  }),

  refresh: handle(async (req, res) => {
    const tokens = await getContainer().refreshSession.execute(req.body.refreshToken, ip(req));
    res.json({ success: true, data: tokens });
  }),

  logout: handle(async (req, res) => {
    await getContainer().logoutUser.execute(req.user!.userId, req.body.refreshToken, ip(req));
    res.json({ success: true, message: 'Logged out' });
  }),

  changePassword: handle(async (req, res) => {
    await getContainer().changePassword.execute(
      req.user!.userId,
      req.body.currentPassword,
      req.body.newPassword,
      ip(req),
    );
    res.json({ success: true, message: 'Password changed' });
  }),

  forgotPassword: handle(async (req, res) => {
    const result = await getContainer().forgotPassword.execute(req.body.identifier, ip(req));
    res.json({
      success: true,
      message: 'If the account exists, a reset code has been sent',
      ...(result.devCode ? { data: { devCode: result.devCode } } : {}),
    });
  }),

  resetPassword: handle(async (req, res) => {
    await getContainer().resetPassword.execute(
      req.body.identifier,
      req.body.code,
      req.body.newPassword,
      ip(req),
    );
    res.json({ success: true, message: 'Password has been reset' });
  }),

  requestVerification: handle(async (req, res) => {
    const result = await getContainer().requestVerification.execute(
      req.user!.userId,
      req.body.channel,
    );
    res.json({
      success: true,
      message: 'Verification code sent',
      ...(result.devCode ? { data: { devCode: result.devCode } } : {}),
    });
  }),

  confirmVerification: handle(async (req, res) => {
    await getContainer().confirmVerification.execute(
      req.user!.userId,
      req.body.channel,
      req.body.code,
    );
    res.json({ success: true, message: 'Verified' });
  }),

  me: handle(async (req, res) => {
    const user = await getContainer().getCurrentUser.execute(req.user!.userId);
    res.json({ success: true, data: user });
  }),
};
