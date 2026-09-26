import User from "../modals/user.modal.js";
import bcrypt from "bcryptjs";
import Note from "../modals/note.modal.js";
import Folder from "../modals/folder.modal.js";
import {
  signToken,
  setTokenCookie,
  clearTokenCookie,
} from "../libs/token.js";
import {
  LIMITS,
  normalizedEmail,
  normalizedText,
  validPassword,
} from "../libs/requestValidation.js";
import { logError } from "../libs/logger.js";
import {
  createEmailVerificationToken,
  hashVerificationId,
  readEmailVerificationToken,
} from "../libs/emailVerification.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../libs/mailer.js";
import {
  createPasswordResetToken,
  hashPasswordResetId,
  readPasswordResetToken,
} from "../libs/passwordReset.js";

async function issueVerificationEmail(user) {
  const verification = createEmailVerificationToken(user._id);
  user.emailVerificationTokenHash = verification.tokenHash;
  user.emailVerificationExpiresAt = verification.expiresAt;
  await user.save();
  await sendVerificationEmail({
    email: user.email,
    name: user.name,
    token: verification.token,
  });
}

async function issuePasswordResetEmail(user) {
  const reset = createPasswordResetToken(user._id);
  user.passwordResetTokenHash = reset.tokenHash;
  user.passwordResetExpiresAt = reset.expiresAt;
  await user.save();
  await sendPasswordResetEmail({
    email: user.email,
    name: user.name,
    token: reset.token,
  });
}

export async function signup(req, res) {
  try {
    const { name, email, password } = req.body ?? {};
    const nameResult = normalizedText(name, {
      label: "Name",
      maxLength: LIMITS.name,
    });
    const emailResult = normalizedEmail(email);
    const passwordResult = validPassword(password);
    const invalid = [nameResult, emailResult, passwordResult].find(
      (result) => result.error
    );
    if (invalid) return res.status(400).json({ message: invalid.error });

    const existing = await User.findOne({ email: emailResult.value });
    if (!existing) {
      const user = await User.create({
        name: nameResult.value,
        email: emailResult.value,
        password: passwordResult.value,
      });
      try {
        await issueVerificationEmail(user);
      } catch (error) {
        // An SMTP failure must not turn signup into an enumeration oracle. The
        // account is still usable and operators get the delivery failure log.
        logError(req, "auth.signup_verification_email_failed", error);
      }
    }

    // Do not issue a session here: returning a user object or a different
    // status for an existing address would reveal which emails have accounts.
    // A person who just registered can use the same credentials at /login.
    return res.status(202).json({
      message: "If this email address can be registered, check your inbox for verification instructions.",
    });
  } catch (error) {
    logError(req, "auth.signup_failed", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// This route intentionally does not require a session: the email link may be
// opened in another browser. Possession of the signed, random token is the
// credential, and its stored digest is atomically consumed below.
export async function verifyEmail(req, res) {
  try {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || token.length > 2048) {
      return res.status(400).json({ message: "A verification token is required" });
    }

    let payload;
    try {
      payload = readEmailVerificationToken(token);
    } catch {
      return res.status(400).json({ message: "Invalid or expired verification link" });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: payload.id,
        emailVerified: { $ne: true },
        emailVerificationTokenHash: hashVerificationId(payload.jti),
        emailVerificationExpiresAt: { $gt: new Date() },
      },
      {
        $set: { emailVerified: true, emailVerifiedAt: new Date() },
        $unset: {
          emailVerificationTokenHash: 1,
          emailVerificationExpiresAt: 1,
        },
      },
      { new: true }
    );
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification link" });
    }

    res.status(200).json({ user: user.toPublicJSON() });
  } catch (error) {
    logError(req, "auth.email_verification_failed", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function resendEmailVerification(req, res) {
  try {
    if (req.user.emailVerified) return res.status(204).end();

    // Reload it so the selected:false token fields and current document state
    // cannot be accidentally overwritten by a stale protect() document.
    const user = await User.findById(req.user._id).select(
      "+emailVerificationTokenHash +emailVerificationExpiresAt"
    );
    await issueVerificationEmail(user);
    return res.status(204).end();
  } catch (error) {
    logError(req, "auth.email_verification_resend_failed", error);
    return res.status(503).json({ message: "Verification email is unavailable" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body ?? {};
    const emailResult = normalizedEmail(email);
    const passwordResult = validPassword(password, { minLength: 1 });
    const invalid = [emailResult, passwordResult].find(
      (result) => result.error
    );
    if (invalid) return res.status(400).json({ message: invalid.error });

    // password is select:false on the schema, so ask for it explicitly
    const user = await User.findOne({ email: emailResult.value }).select(
      "+password +sessionVersion"
    );
    // Same message for unknown email and wrong password so the response
    // does not reveal which emails are registered.
    if (!user || !(await user.comparePassword(passwordResult.value))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    setTokenCookie(res, signToken(user._id, user.sessionVersion));
    res.status(200).json({ user: user.toPublicJSON() });
  } catch (error) {
    logError(req, "auth.login_failed", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export function logout(_, res) {
  clearTokenCookie(res);
  res.status(200).json({ message: "Logged out successfully" });
}

// Used by the frontend on boot to rehydrate the session from the cookie
export function me(req, res) {
  res.status(200).json({ user: req.user.toPublicJSON() });
}

// Deletion is immediate and irreversible: all documents owned by this user are
// removed, including encrypted note envelopes. We intentionally do not retain
// a tombstone or a recovery window because retained encrypted records still
// create an unnecessary key-management and privacy obligation.
export async function deleteAccount(req, res) {
  try {
    const passwordResult = validPassword(req.body?.currentPassword, {
      label: "Current password",
      minLength: 1,
    });
    if (passwordResult.error) {
      return res.status(400).json({ message: passwordResult.error });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user || !(await user.comparePassword(passwordResult.value))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Notes reference folders but neither schema cascades deletion. Remove both
    // collections explicitly before the account record. If an operation fails,
    // the account remains and a retry safely completes the same deletion.
    await Promise.all([
      Note.deleteMany({ owner: user._id }),
      Folder.deleteMany({ owner: user._id }),
    ]);
    await User.deleteOne({ _id: user._id });
    clearTokenCookie(res);
    return res.status(204).end();
  } catch (error) {
    logError(req, "auth.account_deletion_failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// This response is deliberately identical whether the address is registered,
// malformed, or cannot receive mail. That keeps this public endpoint from
// becoming an account-enumeration oracle.
export async function requestPasswordReset(req, res) {
  try {
    const emailResult = normalizedEmail(req.body?.email);
    if (!emailResult.error) {
      const user = await User.findOne({ email: emailResult.value }).select(
        "+passwordResetTokenHash +passwordResetExpiresAt"
      );
      if (user) {
        try {
          await issuePasswordResetEmail(user);
        } catch (error) {
          // Do not change the public response based on a known account. The
          // structured log retains the cause for operators to investigate.
          logError(req, "auth.password_reset_email_failed", error);
        }
      }
    }
    return res.status(204).end();
  } catch (error) {
    logError(req, "auth.password_reset_request_failed", error);
    return res.status(204).end();
  }
}

// Like verification, this endpoint is sessionless because people commonly
// open reset links on a different device. The database predicate consumes the
// token atomically, so concurrent submissions cannot both change a password.
export async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body ?? {};
    const passwordResult = validPassword(newPassword, { label: "New password" });
    if (passwordResult.error) {
      return res.status(400).json({ message: passwordResult.error });
    }
    if (typeof token !== "string" || token.length > 2048) {
      return res.status(400).json({ message: "Invalid or expired password-reset link" });
    }

    let payload;
    try {
      payload = readPasswordResetToken(token);
    } catch {
      return res.status(400).json({ message: "Invalid or expired password-reset link" });
    }

    // findOneAndUpdate bypasses the schema's pre-save hook, so hash explicitly
    // here. Keeping this as one atomic update is what makes a reset link one-use.
    const password = await bcrypt.hash(passwordResult.value, 10);
    const user = await User.findOneAndUpdate(
      {
        _id: payload.id,
        passwordResetTokenHash: hashPasswordResetId(payload.jti),
        passwordResetExpiresAt: { $gt: new Date() },
      },
      {
        $set: { password },
        $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
        $inc: { sessionVersion: 1 },
      },
      { new: true }
    );
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired password-reset link" });
    }

    // Do not create a session just from the emailed credential. Logging in
    // normally makes the session transition explicit, and the version bump
    // above has invalidated every session that used the old password.
    return res.status(204).end();
  } catch (error) {
    logError(req, "auth.password_reset_failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateEmail(req, res) {
  try {
    const { email, currentPassword } = req.body ?? {};
    const emailResult = normalizedEmail(email);
    const passwordResult = validPassword(currentPassword, {
      label: "Current password",
      minLength: 1,
    });
    const invalid = [emailResult, passwordResult].find(
      (result) => result.error
    );
    if (invalid) return res.status(400).json({ message: invalid.error });

    const nextEmail = emailResult.value;
    if (nextEmail === req.user.email) {
      return res
        .status(400)
        .json({ message: "That is already your email address" });
    }

    // protect() loads the user without the password (select:false)
    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(passwordResult.value))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const existing = await User.findOne({ email: nextEmail });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    user.email = nextEmail;
    user.emailVerified = false;
    user.emailVerifiedAt = undefined;
    await user.save();
    await issueVerificationEmail(user);
    res.status(200).json({ user: user.toPublicJSON() });
  } catch (error) {
    logError(req, "auth.email_update_failed", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// Account preferences. Deliberately does not ask for the current password the
// way updateEmail and updatePassword do: this changes nothing about who can get
// into the account, and the worst a stolen cookie achieves here is hiding or
// showing a button.
export async function updatePreferences(req, res) {
  try {
    const { encryptedNotesEnabled } = req.body ?? {};
    // Strict boolean check, not a truthiness coercion — a client sending the
    // string "false" would otherwise silently turn the setting on.
    if (typeof encryptedNotesEnabled !== "boolean") {
      return res
        .status(400)
        .json({ message: "encryptedNotesEnabled must be true or false" });
    }

    // findByIdAndUpdate rather than mutate-and-save(): protect() loads the user
    // without `password` (select:false), and saving a document whose required
    // field was never selected leans on Mongoose's unselected-path validation
    // rules. A targeted $set has no such question — it writes one field and
    // touches nothing else.
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { encryptedNotesEnabled },
      { new: true }
    );

    res.status(200).json({ user: user.toPublicJSON() });
  } catch (error) {
    logError(req, "auth.preferences_update_failed", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function updatePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    const currentPasswordResult = validPassword(currentPassword, {
      label: "Current password",
      minLength: 1,
    });
    const newPasswordResult = validPassword(newPassword, {
      label: "New password",
    });
    const invalid = [currentPasswordResult, newPasswordResult].find(
      (result) => result.error
    );
    if (invalid) return res.status(400).json({ message: invalid.error });
    if (newPasswordResult.value === currentPasswordResult.value) {
      return res
        .status(400)
        .json({ message: "New password must differ from the current one" });
    }

    const user = await User.findById(req.user._id).select("+password +sessionVersion");
    if (!(await user.comparePassword(currentPasswordResult.value))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // The pre("save") hook hashes it — never hash at the call site
    user.password = newPasswordResult.value;
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save();

    // Re-issue only this browser's cookie; bumping the version expires every
    // other session that was authenticated with the old password.
    setTokenCookie(res, signToken(user._id, user.sessionVersion));
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    logError(req, "auth.password_update_failed", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
