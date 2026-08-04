import User from "../modals/user.modal.js";
import {
  signToken,
  setTokenCookie,
  clearTokenCookie,
} from "../libs/token.js";

export async function signup(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({ name, email, password });
    setTokenCookie(res, signToken(user._id));
    res.status(201).json({ user: user.toPublicJSON() });
  } catch (error) {
    console.error("Error in signup:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // password is select:false on the schema, so ask for it explicitly
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );
    // Same message for unknown email and wrong password so the response
    // does not reveal which emails are registered.
    if (!user || !(await user.comparePassword(password))) {
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
    const { email, currentPassword } = req.body;
    if (!email || !currentPassword) {
      return res
        .status(400)
        .json({ message: "Email and current password are required" });
    }

    const nextEmail = email.toLowerCase().trim();
    if (nextEmail === req.user.email) {
      return res
        .status(400)
        .json({ message: "That is already your email address" });
    }

    // protect() loads the user without the password (select:false)
    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(currentPassword))) {
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
    const { encryptedNotesEnabled } = req.body;
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
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }
    if (newPassword === currentPassword) {
      return res
        .status(400)
        .json({ message: "New password must differ from the current one" });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // The pre("save") hook hashes it — never hash at the call site
    user.password = newPassword;
    await user.save();

    // Re-issue the cookie so the session survives the change
    setTokenCookie(res, signToken(user._id));
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error in updatePassword:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
