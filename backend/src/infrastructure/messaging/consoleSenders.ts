import { IEmailSender, ISmsSender } from '@application/interfaces/IMessageSenders';
import { logger } from '@infrastructure/logging/logger';

/**
 * Development implementations — log instead of sending.
 * A provider sprint swaps these for a real email service and a Jordanian
 * SMS gateway; the use-cases stay untouched (they depend on the interfaces).
 */
export class ConsoleEmailSender implements IEmailSender {
  async send(to: string, subject: string, body: string): Promise<void> {
    logger.info(`📧 [email → ${to}] ${subject}: ${body}`);
  }
}

export class ConsoleSmsSender implements ISmsSender {
  async send(toPhoneNumber: string, message: string): Promise<void> {
    logger.info(`📱 [sms → ${toPhoneNumber}] ${message}`);
  }
}
