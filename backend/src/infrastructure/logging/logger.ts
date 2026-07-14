import winston from 'winston';
import { ILogger } from '@application/interfaces/ILogger';
import { env } from '@shared/config/env';

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} ${level}: ${message}${rest}`;
  }),
);

const winstonLogger = winston.createLogger({
  level: env.isTest ? 'error' : env.logLevel,
  format: env.isProduction ? combine(timestamp(), json()) : devFormat,
  transports: [new winston.transports.Console()],
});

/** Winston-backed implementation of the application ILogger contract. */
export const logger: ILogger = {
  debug: (message, meta) => void winstonLogger.debug(message, meta),
  info: (message, meta) => void winstonLogger.info(message, meta),
  warn: (message, meta) => void winstonLogger.warn(message, meta),
  error: (message, meta) => void winstonLogger.error(message, meta),
};
