import nodemailer from "nodemailer";

function smtpConfiguration() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } =
    process.env;
  const port = Number(SMTP_PORT);
  if (
    !SMTP_HOST ||
    !EMAIL_FROM ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    Boolean(SMTP_USER) !== Boolean(SMTP_PASSWORD)
  ) {
    return null;
  }

  return {
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    from: EMAIL_FROM,
  };
}

export function hasEmailConfiguration() {
  return Boolean(smtpConfiguration());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export async function sendVerificationEmail({ email, name, token }) {
  // Tests exercise token state and endpoints without making network calls.
  if (process.env.NODE_ENV === "test") return;

  const config = smtpConfiguration();
  if (!config) {
    const error = new Error("Email delivery is not configured");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const verifyUrl = new URL("/verify-email", process.env.CORS_ORIGIN);
  // A fragment is never sent to the API, proxies, or third-party assets. The
  // SPA reads it and POSTs the token to the verification endpoint over HTTPS.
  verifyUrl.hash = token;
  const url = verifyUrl.toString();
  const greeting = name || "there";

  const transporter = nodemailer.createTransport(config);
  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: "Verify your Vichar email address",
    text: `Hi ${greeting},\n\nVerify your email address: ${url}\n\nThis link expires in 24 hours. If you did not create a Vichar account, you can ignore this email.`,
    html: `<p>Hi ${escapeHtml(greeting)},</p><p><a href="${url}">Verify your email address</a></p><p>This link expires in 24 hours. If you did not create a Vichar account, you can ignore this email.</p>`,
  });
}
