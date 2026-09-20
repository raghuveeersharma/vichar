const REDACTED = "[REDACTED]";
const SENSITIVE_FIELD =
  /authorization|cookie|password|token|secret|key|content|html|note|email/i;

function serializeError(error) {
  if (!(error instanceof Error)) return { message: String(error) };

  return {
    name: error.name,
    code: error.code,
    status: error.status ?? error.statusCode,
    // The first stack line repeats the error message, which can be derived
    // from user input by database and upstream-client libraries. Keep call
    // sites for diagnosis without writing that untrusted value to a log sink.
    stack: error.stack?.split("\n").slice(1).join("\n"),
  };
}

function redact(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      SENSITIVE_FIELD.test(key) ? REDACTED : value,
    ])
  );
}

function write(level, event, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redact(fields),
  };
  const output = JSON.stringify(entry);

  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}

export const logger = {
  info(event, fields) {
    write("info", event, fields);
  },
  warn(event, fields) {
    write("warn", event, fields);
  },
  error(event, fields) {
    write("error", event, fields);
  },
};

export function requestContext(req) {
  return {
    requestId: req.id,
    method: req.method,
    path: req.logPath ?? req.path,
    userId: req.user?._id?.toString(),
  };
}

export function logError(req, event, error, fields = {}) {
  logger.error(event, {
    ...requestContext(req),
    ...fields,
    error: serializeError(error),
  });
}
