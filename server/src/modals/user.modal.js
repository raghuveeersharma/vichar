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
    // Opt-in, per account: gates the "create encrypted note" button in the UI
    // and the `encrypted: true` flag on POST /notes. Defaults to false so the
    // extra button is not in the way of users who never wanted it — existing
    // accounts start with it off and turn it on in settings.
    //
    // It only governs *creating* encrypted notes. Notes already sealed stay
    // sealed and keep decrypting on read whatever this says, because the
    // controllers branch on the note's own `isEncrypted` flag.
    encryptedNotesEnabled: {
      type: Boolean,
      default: false,
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
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    // Sent on every auth response so the SPA can decide what to render without
    // a second request — accounts created before this field existed have no
    // value stored, hence the `??` rather than a migration.
    encryptedNotesEnabled: this.encryptedNotesEnabled ?? false,
  };
};

const User = mongoose.model("User", userSchema);
export default User;
