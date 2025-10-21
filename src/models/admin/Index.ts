import mongoose, { Schema, Model } from "mongoose";
import { IAdmin, ADMIN_PERMISSIONS } from "@/types/admin";
import { Role } from "./Role";
import bcryptUtil from "@/utils/bcryptjs";

interface IAdminModel extends Model<IAdmin> {
  createAdmin(adminData: any): Promise<IAdmin>;
  findByEmail(email: string): Promise<IAdmin>;
}

// Create Admin schema
const adminSchema = new Schema<IAdmin>(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
      maxlength: [50, "First name cannot exceed 50 characters"],
      match: [
        /^[a-zA-Z\s]+$/,
        "First name can only contain letters and spaces",
      ],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [2, "Last name must be at least 2 characters"],
      maxlength: [50, "Last name cannot exceed 50 characters"],
      match: [/^[a-zA-Z\s]+$/, "Last name can only contain letters and spaces"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    status: {
      type: String,
      enum: ["active", "pending_verification", "suspended", "deactivated"],
      default: "active",
    },

    // Admin specific fields
    adminLevel: {
      type: String,
      required: [true, "Admin level is required"],
      index: true,
      validate: {
        validator: async function (value: string) {
          const role = await Role.findOne({ name: value.toLowerCase() });
          return !!role;
        },
        message: "Invalid admin level: role does not exist",
      },
    },
    permissions: {
      type: [String],
      required: true,
      validate: {
        validator: function (permissions: string[]) {
          const allPermissions = Object.values(ADMIN_PERMISSIONS).flatMap(
            (category) => Object.values(category)
          );
          return permissions.every((permission) =>
            allPermissions.includes(permission as any)
          );
        },
        message: "Invalid permission specified",
      },
    },

    // Security fields
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    passwordHistory: {
      type: [String],
      default: [],
      select: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    activeTokenId: {
      type: String,
      default: null,
      select: false,
    },

    // Profile fields
    phone: {
      type: String,
      default: null,
      match: [/^\+?[\d\s\-\(\)]{10,}$/, "Please enter a valid phone number"],
    },
    profilePicture: {
      type: String,
      default: null,
    },

    // Activity tracking
    lastActiveAt: {
      type: Date,
      default: null,
    },
    totalLogins: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "admins",
  }
);

// Compound indexes for better query performance
adminSchema.index({ email: 1, status: 1 });
adminSchema.index({ adminLevel: 1, status: 1 });
adminSchema.index({ createdAt: -1 });

// Virtual for full name
adminSchema.virtual("fullName").get(function (this: IAdmin) {
  return `${this.firstName} ${this.lastName}`;
});

adminSchema.methods.isLocked = function () {
  // Check if lockUntil exists and is in the future
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Pre-save middleware to hash password
adminSchema.pre("save", async function (this: IAdmin, next) {
  // Only hash password if it's modified
  if (!(this as any).isModified("password")) {
    return next();
  }

  try {
    this.password = await bcryptUtil.hashPassword(this.password);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Pre-save middleware to set default permissions based on admin level
adminSchema.pre("save", async function (this: IAdmin, next) {
  try {
    if ((this as any).isNew || this.isModified("adminLevel")) {
      if (!this.permissions || this.permissions.length === 0) {
        const role = await Role.findOne({
          name: this.adminLevel.toLowerCase(),
        });

        if (role) {
          this.permissions = role.permissions;
        } else {
          // this.permissions = [];

          return next(new Error(`Role '${this.adminLevel}' not found`));
        }
      }
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

adminSchema.pre("save", async function (this: IAdmin, next) {
  try {
    if (this.adminLevel?.toLowerCase().trim() === "super_admin") {
      if ((this as any).isNew || this.isModified("adminLevel")) {
        const existingSuperAdmin = await Admin.findOne({
          adminLevel: {
            $regex: new RegExp("^super_admin$", "i"),
          },
          _id: { $ne: this._id },
          status: { $in: ["active", "pending_verification"] },
        });

        if (existingSuperAdmin) {
          return next(
            new Error(
              "A super admin account already exists. Only one super admin is allowed."
            )
          );
        }
      }
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
adminSchema.methods.comparePassword = async function (
  this: IAdmin,
  candidatePassword: string
): Promise<boolean> {
  return await bcryptUtil.comparePassword(candidatePassword, this.password);
};

// Method to increment login attempts
adminSchema.methods.incrementLoginAttempts = async function (
  this: IAdmin
): Promise<void> {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || "10");
  const lockTime = parseInt(process.env.ACCOUNT_LOCKOUT_TIME || "900000"); // 15 minutes

  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    return (this as any)
      .updateOne({
        $unset: { lockUntil: 1 },
        $set: { loginAttempts: 1 },
      })
      .exec();
  }

  const updates: any = { $inc: { loginAttempts: 1 } };

  // Lock account after max attempts - use the new method name
  if (
    this.loginAttempts + 1 >= maxAttempts &&
    !(this as any).checkAccountLock()
  ) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTime) };
  }

  return (this as any).updateOne(updates).exec();
};

// Method to reset login attempts
adminSchema.methods.resetLoginAttempts = async function (
  this: IAdmin
): Promise<void> {
  return (this as any)
    .updateOne({
      $unset: {
        loginAttempts: 1,
        lockUntil: 1,
      },
    })
    .exec();
};

// Method to check if account is locked
adminSchema.methods.checkAccountLock = function (this: IAdmin): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// Method to check permissions
adminSchema.methods.hasPermission = function (
  this: IAdmin,
  permission: string
): boolean {
  return this.permissions.includes(permission);
};

// Method to update last active
adminSchema.methods.updateLastActive = async function (
  this: IAdmin
): Promise<void> {
  this.lastActiveAt = new Date();
  await (this as any).save();
};

// Static method to find by email
adminSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to create admin with validation
adminSchema.statics.createAdmin = async function (adminData: any) {
  const admin = new this(adminData);
  await admin.validate();
  return await admin.save();
};

// Transform JSON output (remove sensitive fields)
// adminSchema.set("toJSON", {
//   transform: function (doc, ret) {
//     delete ret.password;
//     delete ret.passwordHistory;
//     delete ret.__v;
//     delete ret.loginAttempts;
//     delete ret.lockUntil;
//     ret.id = ret._id;
//     delete ret._id;
//     return ret;
//   },
// });

// // Transform object output
// adminSchema.set("toObject", {
//   transform: function (doc, ret) {
//     delete ret.password;
//     delete ret.passwordHistory;
//     delete ret.__v;
//     ret.id = ret._id;
//     delete ret._id;
//     return ret;
//   },
// });

// Add text search index for searchability
adminSchema.index(
  {
    firstName: "text",
    lastName: "text",
    email: "text",
  },
  {
    weights: {
      email: 10,
      firstName: 5,
      lastName: 5,
    },
    name: "admin_text_index",
  }
);

// Export the model
export const Admin = mongoose.model<IAdmin, IAdminModel>("Admin", adminSchema);
export default Admin;
