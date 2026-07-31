import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // never returned by queries unless explicitly selected
    },
  },
  { timestamps: true }
);

// Hash the password whenever it is set or changed
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Shape sent to the client — never includes the password hash
userSchema.methods.toPublicJSON = function () {
  return { _id: this._id, name: this.name, email: this.email };
};

const User = mongoose.model("User", userSchema);
export default User;
