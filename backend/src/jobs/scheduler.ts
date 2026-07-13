import cron from 'node-cron';
import { execProc } from '../config/db';
import { logger } from '../config/logger';
import { notifyUser } from '../services/notify';

/**
 * Scheduled business jobs. In multi-instance deployments run these on a
 * single worker (ENABLE_JOBS=true on one instance only).
 */
export const startJobs = (): void => {
  // 1st of each month 06:00 UTC — generate rent invoices for active contracts
  cron.schedule('0 6 1 * *', async () => {
    try {
      const { recordset } = await execProc<{
        InvoiceId: number;
        InvoiceNumber: string;
        IssuedToUserId: number;
        Amount: number;
      }>('sp_Invoice_GenerateMonthly');
      logger.info(`Job: generated ${recordset.length} monthly invoices`);
      for (const invoice of recordset) {
        await notifyUser({
          userId: invoice.IssuedToUserId,
          title: 'فاتورة إيجار جديدة | New rent invoice',
          body: `Invoice ${invoice.InvoiceNumber} for ${invoice.Amount} JOD`,
          type: 'Payment',
          entityType: 'Invoice',
          entityId: invoice.InvoiceId,
        });
      }
    } catch (error) {
      logger.error('Job failed: monthly invoices', { error: (error as Error).message });
    }
  });

  // Daily 05:00 UTC — mark overdue invoices & apply late fees, expire contracts
  cron.schedule('0 5 * * *', async () => {
    try {
      await execProc('sp_Invoice_ApplyOverdue');
      await execProc('sp_Contract_ExpireOverdue');
      await execProc('sp_RefreshToken_Cleanup');
      logger.info('Job: overdue invoices & contract expiry processed');
    } catch (error) {
      logger.error('Job failed: overdue processing', { error: (error as Error).message });
    }
  });

  // Daily 08:00 UTC — payment reminders for invoices due within 3 days
  cron.schedule('0 8 * * *', async () => {
    try {
      const { recordset } = await execProc<{
        InvoiceId: number;
        InvoiceNumber: string;
        IssuedToUserId: number;
        TotalAmount: number;
        DueDate: Date;
        Status: string;
      }>('sp_Invoice_GetDueForReminder', { DaysAhead: 3 });
      for (const invoice of recordset) {
        const overdue = invoice.Status === 'Overdue';
        await notifyUser({
          userId: invoice.IssuedToUserId,
          title: overdue
            ? '⚠️ فاتورة متأخرة | Overdue invoice'
            : 'تذكير بالدفع | Payment reminder',
          body: `${invoice.InvoiceNumber} — ${invoice.TotalAmount} JOD`,
          type: 'Payment',
          entityType: 'Invoice',
          entityId: invoice.InvoiceId,
        });
      }
      logger.info(`Job: sent ${recordset.length} payment reminders`);
    } catch (error) {
      logger.error('Job failed: payment reminders', { error: (error as Error).message });
    }
  });

  logger.info('Scheduled jobs registered');
};
