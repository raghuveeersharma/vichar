import User from "../modals/user.modal.js";
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
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({
      name: nameResult.value,
      email: emailResult.value,
      password: passwordResult.value,
    });
    setTokenCookie(res, signToken(user._id));
    res.status(201).json({ user: user.toPublicJSON() });
  } catch (error) {
    console.error("Error in signup:", error);
    res.status(500).json({ message: "Internal server error" });
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
      "+password"
    );
    // Same message for unknown email and wrong password so the response
    // does not reveal which emails are registered.
    if (!user || !(await user.comparePassword(passwordResult.value))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    setTokenCookie(res, signToken(user._id));
    res.status(200).json({ user: user.toPublicJSON() });
  } catch (error) {
    console.error("Error in login:", error);
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
    await user.save();
    res.status(200).json({ user: user.toPublicJSON() });
  } catch (error) {
    console.error("Error in updateEmail:", error);
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
    console.error("Error in updatePreferences:", error);
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

    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(currentPasswordResult.value))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // The pre("save") hook hashes it — never hash at the call site
    user.password = newPasswordResult.value;
    await user.save();

    // Re-issue the cookie so the session survives the change
    setTokenCookie(res, signToken(user._id));
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error in updatePassword:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
