import { Request, Response, Router } from 'express';
import Joi from 'joi';
import PDFDocument from 'pdfkit';
import { execProc } from '../../config/db';
import { authenticate, authorize, isAdmin } from '../../middleware/auth';
import { id, validate } from '../../middleware/validate';
import { catchAsync } from '../../utils/catchAsync';

export const reportsRoutes = Router();
reportsRoutes.use(authenticate, authorize('BuildingOwner', 'Accountant'));

const dateRange = {
  fromDate: Joi.date().iso().required(),
  toDate: Joi.date().iso().min(Joi.ref('fromDate')).required(),
};

/** Scope owner-level reports to the caller unless admin. */
const ownerScope = (req: Request): number | null => (isAdmin(req) ? null : req.user!.userId);

const toCsv = (rows: Record<string, unknown>[]): string => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ].join('\n');
};

const sendExport = (
  res: Response,
  format: string | undefined,
  filename: string,
  sections: Record<string, Record<string, unknown>[]>,
): void => {
  if (format === 'csv') {
    // Excel-compatible CSV (UTF-8 BOM so Arabic renders correctly)
    const body = Object.entries(sections)
      .map(([name, rows]) => `# ${name}\n${toCsv(rows)}`)
      .join('\n\n');
    res
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
      .send(`﻿${body}`);
    return;
  }
  if (format === 'pdf') {
    const doc = new PDFDocument({ margin: 40 });
    res
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    doc.pipe(res);
    doc.fontSize(18).text(`3martna — ${filename}`, { align: 'center' }).moveDown();
    for (const [name, rows] of Object.entries(sections)) {
      doc.fontSize(13).fillColor('#1a1a1a').text(name).moveDown(0.3);
      doc.fontSize(9).fillColor('#333');
      for (const row of rows.slice(0, 60)) {
        doc.text(
          Object.entries(row)
            .map(([key, value]) => `${key}: ${value ?? '—'}`)
            .join('  |  '),
        );
      }
      doc.moveDown();
    }
    doc.end();
    return;
  }
  res.json({ success: true, data: sections });
};

/**
 * @openapi
 * /reports/financial:
 *   get:
 *     tags: [Reports]
 *     summary: Financial report (income, expenses, outstanding) — json/csv/pdf
 *     parameters:
 *       - { in: query, name: fromDate, required: true, schema: { type: string, format: date } }
 *       - { in: query, name: toDate, required: true, schema: { type: string, format: date } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, pdf] } }
 *     responses:
 *       200: { description: Report in requested format }
 */
reportsRoutes.get(
  '/financial',
  validate({
    query: Joi.object({
      ...dateRange,
      buildingId: id,
      format: Joi.string().valid('json', 'csv', 'pdf').default('json'),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Report_Financial', {
      BuildingId: req.query.buildingId ?? null,
      OwnerUserId: ownerScope(req),
      FromDate: req.query.fromDate,
      ToDate: req.query.toDate,
    });
    sendExport(res, req.query.format as string, 'financial-report', {
      monthly: recordsets[0] ?? [],
      totals: recordsets[1] ?? [],
      expenseBreakdown: recordsets[2] ?? [],
    });
  }),
);

reportsRoutes.get(
  '/occupancy',
  validate({
    query: Joi.object({ format: Joi.string().valid('json', 'csv', 'pdf').default('json') }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordset } = await execProc('sp_Report_Occupancy', { OwnerUserId: ownerScope(req) });
    sendExport(res, req.query.format as string, 'occupancy-report', { occupancy: recordset });
  }),
);

reportsRoutes.get(
  '/maintenance',
  validate({
    query: Joi.object({
      ...dateRange,
      buildingId: id,
      format: Joi.string().valid('json', 'csv', 'pdf').default('json'),
    }),
  }),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Report_Maintenance', {
      BuildingId: req.query.buildingId ?? null,
      OwnerUserId: ownerScope(req),
      FromDate: req.query.fromDate,
      ToDate: req.query.toDate,
    });
    sendExport(res, req.query.format as string, 'maintenance-report', {
      byStatus: recordsets[0] ?? [],
      byCategory: recordsets[1] ?? [],
      technicians: recordsets[2] ?? [],
    });
  }),
);
