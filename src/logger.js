const { createLogger, format, transports } = require("winston");

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.colorize(),
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : "";
      return `${timestamp} [${level}]: ${message}${metaString}\n`;
    })
  ),
  transports: [new transports.Console()],
});

module.exports = logger;