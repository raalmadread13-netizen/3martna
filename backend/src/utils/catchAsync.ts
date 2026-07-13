import { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wrap an async handler so rejections reach the error middleware. */
export const catchAsync =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
