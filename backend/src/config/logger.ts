import winston from 'winston';
import { env } from './env';

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} ${level}: ${message}${rest}`;
  }),
);

export const logger = winston.createLogger({
  level: env.isTest ? 'error' : env.logLevel,
  format: env.isProduction ? combine(timestamp(), json()) : devFormat,
  transports: [new winston.transports.Console()],
});
