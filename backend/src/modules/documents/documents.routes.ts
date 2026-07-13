import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { execProc, execProcOne } from '../../config/db';
import { authenticate, isAdmin } from '../../middleware/auth';
import { id, pageQuery, validate } from '../../middleware/validate';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';

export const documentsRoutes = Router();
documentsRoutes.use(authenticate);

const idParam = Joi.object({ id: id.required() });

/**
 * Files themselves live in Firebase Storage — the mobile/web clients upload
 * directly with the Firebase SDK and register the resulting URL here, so
 * the API stays stateless and binary-free.
 *
 * @openapi
 * /documents:
 *   get:
 *     tags: [Documents]
 *     summary: List documents (own documents unless admin)
 *     responses:
 *       200: { description: Paginated documents }
 *   post:
 *     tags: [Documents]
 *     summary: Register an uploaded document (creates version 1)
 *     responses:
 *       201: { description: Document registered }
 */
documentsRoutes.get(
  '/',
  validate({
    query: Joi.object({
      ...pageQuery,
      buildingId: id,
      apartmentId: id,
      ownerUserId: id,
      category: Joi.string().valid('Contract', 'NationalId', 'Invoice', 'Receipt', 'Image', 'Report', 'Other'),
      search: Joi.string().max(200),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const { recordset } = await execProc('sp_Document_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      OwnerUserId: isAdmin(req) ? req.query.ownerUserId ?? null : req.user!.userId,
      BuildingId: req.query.buildingId ?? null,
      ApartmentId: req.query.apartmentId ?? null,
      Category: req.query.category ?? null,
      Search: req.query.search ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),
);

documentsRoutes.post(
  '/',
  validate({
    body: Joi.object({
      buildingId: id.allow(null),
      apartmentId: id.allow(null),
      category: Joi.string()
        .valid('Contract', 'NationalId', 'Invoice', 'Receipt', 'Image', 'Report', 'Other')
        .required(),
      title: Joi.string().min(1).max(200).required(),
      fileUrl: Joi.string().uri().max(500).required(),
      fileType: Joi.string().valid('pdf', 'image', 'doc', 'xls', 'other').required(),
      fileSizeBytes: Joi.number().integer().min(0),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const document = await execProcOne('sp_Document_Create', {
      OwnerUserId: req.user!.userId,
      BuildingId: req.body.buildingId ?? null,
      ApartmentId: req.body.apartmentId ?? null,
      Category: req.body.category,
      Title: req.body.title,
      FileUrl: req.body.fileUrl,
      FileType: req.body.fileType,
      FileSizeBytes: req.body.fileSizeBytes ?? null,
    });
    res.status(201).json({ success: true, data: document });
  }),
);

/** Version history. */
documentsRoutes.get(
  '/:id/versions',
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordset } = await execProc('sp_Document_Versions', {
      DocumentId: Number(req.params.id),
    });
    res.json({ success: true, data: recordset });
  }),
);

/** Upload a new version of an existing document. */
documentsRoutes.post(
  '/:id/versions',
  validate({
    params: idParam,
    body: Joi.object({
      fileUrl: Joi.string().uri().max(500).required(),
      changeNote: Joi.string().max(300),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const version = await execProcOne('sp_Document_AddVersion', {
      DocumentId: Number(req.params.id),
      FileUrl: req.body.fileUrl,
      UploadedByUserId: req.user!.userId,
      ChangeNote: req.body.changeNote ?? null,
    });
    res.status(201).json({ success: true, data: version });
  }),
);

documentsRoutes.delete(
  '/:id',
  validate({ params: idParam }),
  catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_Document_Archive', {
      DocumentId: Number(req.params.id),
      OwnerUserId: req.user!.userId,
    });
    res.json({ success: true, message: 'Document archived' });
  }),
);
