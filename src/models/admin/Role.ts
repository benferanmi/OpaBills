import { Schema, model, Document } from 'mongoose';


export interface IRole extends Document {
    name: string;
    description: string;
    permissions: string[];
    isSystemRole: boolean;
    createdAt: Date;
    updatedAt: Date;
}


const roleSchema = new Schema<IRole>({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    description: {
        type: String,
        required: true,
        maxlength: 500
    },
    permissions: [String],
    isSystemRole: {
        type: Boolean,
        default: false
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Prevent deletion of system roles
roleSchema.pre('deleteOne', function (next) {
    if ((this as any).isSystemRole) {
        next(new Error('Cannot delete system role'));
    } else {
        next();
    }
});

roleSchema.pre('findOneAndDelete', function (next) {
    const role = this.getQuery();
    if (role.isSystemRole) {
        next(new Error('Cannot delete system role'));
    } else {
        next();
    }
});

export const Role = model<IRole>('Role', roleSchema);