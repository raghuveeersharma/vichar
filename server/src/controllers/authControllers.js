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
