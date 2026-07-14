/**
 * Outbound messaging contracts. Sprint 2 ships console/log implementations;
 * a provider sprint replaces them with a real email service and a
 * Jordanian SMS gateway without touching the use-cases.
 */
export interface IEmailSender {
  send(to: string, subject: string, body: string): Promise<void>;
}

export interface ISmsSender {
  send(toPhoneNumber: string, message: string): Promise<void>;
}
