import { Document, Schema } from "mongoose";

export interface AdminJWTPayload {
    id: string;
    adminId: string;
    email: string;
    adminLevel: string;
    permissions: string[];
    department?: string;
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string;
}
export interface AdminAuthenticatedRequest extends Request {
    admin?: AdminJWTPayload;
    params: any;
    body: any;
    query: any;
    route: any;
    get: any;
}

export interface CreateAdminRequest {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    adminLevel: string;
    permissions?: string[];
    department?: string;
    phone?: string;
    status?: "active" | "pending_verification" | "suspended" | "deactivated";
}

export interface UpdateAdminRequest {
    firstName?: string;
    lastName?: string;
    adminLevel?: string;
    permissions?: string[];
    department?: string;
    phone?: string;
    status?: "active" | "pending_verification" | "suspended" | "deactivated";
}

export interface IAdmin extends Document {
    _id: Schema.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    status: "active" | "pending_verification" | "suspended" | "deactivated";
    adminLevel: string;
    permissions: string[];
    department?: string;
    loginAttempts: number;
    lockUntil?: Date;
    lastLogin?: Date;
    passwordHistory: string[];
    phone?: string;
    profilePicture?: string;
    lastActiveAt?: Date;
    totalLogins: number;
    createdBy?: string;
    updatedBy?: string;
    createdAt: Date;
    updatedAt: Date;

    // Virtual fields
    fullName: string;

    // Instance methods
    comparePassword(candidatePassword: string): Promise<boolean>;
    incrementLoginAttempts(): Promise<void>;
    resetLoginAttempts(): Promise<void>;
    checkAccountLock(): boolean;
    hasPermission(permission: string): boolean;
    updateLastActive(): Promise<void>;
    isLocked(): boolean;
}

// Static methods interface
export interface IAdminModel {
    findByEmail(email: string): Promise<IAdmin | null>;
    createAdmin(adminData: Partial<IAdmin>): Promise<IAdmin>;
}

// Admin permissions enum
export const ADMIN_PERMISSIONS = {
    // User management permissions
    USERS: {
        VIEW: "users.view",
        CREATE: "users.create",
        UPDATE: "users.update",
        DELETE: "users.delete",
        SUSPEND: "users.suspend",
        VERIFY: "users.verify",
    },

    // Vendor management permissions
    VENDORS: {
        VIEW: "vendors.view",
        CREATE: "vendors.create",
        UPDATE: "vendors.update",
        DELETE: "vendors.delete",
        APPROVE: "vendors.approve",
        SUSPEND: "vendors.suspend",
    },

    // Admin management permissions
    ADMIN: {
        VIEW: "admin.view",
        CREATE: "admin.create",
        UPDATE: "admin.update",
        DELETE: "admin.delete",
        MANAGE_ROLES: "admin.manage_roles",
    },

    // System permissions
    SYSTEM: {
        ANALYTICS: "system.analytics",
        SETTINGS: "system.settings",
        LOGS: "system.logs",
        BACKUP: "system.backup",
        MAINTENANCE: "system.maintenance",
    },

    // Financial permissions
    FINANCE: {
        VIEW_TRANSACTIONS: "finance.view_transactions",
        MANAGE_PAYMENTS: "finance.manage_payments",
        REFUNDS: "finance.refunds",
        REPORTS: "finance.reports",
    },

    // Content management permissions
    CONTENT: {
        VIEW: "content.view",
        CREATE: "content.create",
        UPDATE: "content.update",
        DELETE: "content.delete",
        PUBLISH: "content.publish",
    },

    // Support permissions
    SUPPORT: {
        VIEW_TICKETS: "support.view_tickets",
        MANAGE_TICKETS: "support.manage_tickets",
        VIEW_CHATS: "support.view_chats",
        MANAGE_CHATS: "support.manage_chats",
    },
} as const;

// Extract all permission values for validation
export type AdminPermission =
    | (typeof ADMIN_PERMISSIONS.USERS)[keyof typeof ADMIN_PERMISSIONS.USERS]
    | (typeof ADMIN_PERMISSIONS.VENDORS)[keyof typeof ADMIN_PERMISSIONS.VENDORS]
    | (typeof ADMIN_PERMISSIONS.ADMIN)[keyof typeof ADMIN_PERMISSIONS.ADMIN]
    | (typeof ADMIN_PERMISSIONS.SYSTEM)[keyof typeof ADMIN_PERMISSIONS.SYSTEM]
    | (typeof ADMIN_PERMISSIONS.FINANCE)[keyof typeof ADMIN_PERMISSIONS.FINANCE]
    | (typeof ADMIN_PERMISSIONS.CONTENT)[keyof typeof ADMIN_PERMISSIONS.CONTENT]
    | (typeof ADMIN_PERMISSIONS.SUPPORT)[keyof typeof ADMIN_PERMISSIONS.SUPPORT];

// Get all permission values as a flat array
export const ALL_PERMISSIONS = Object.values(ADMIN_PERMISSIONS).flatMap((category) =>
    Object.values(category)
);

// Pagination interface
export interface PaginationResult<T> {
    data: T[];
    pagination: {
        current: number;
        pages: number;
        total: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

// Admin statistics interface
export interface AdminStatistics {
    byLevel: Array<{
        _id: string;
        count: number;
        active: number;
        suspended: number;
        deactivated: number;
    }>;
    overall: {
        total: number;
        active: number;
        recentLogins: number;
    };
}
