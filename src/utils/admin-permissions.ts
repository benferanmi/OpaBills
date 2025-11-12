export const ADMIN_PERMISSIONS = {
  // User management permissions
  USERS: {
    VIEW: "users.view",
    CREATE: "users.create",
    UPDATE: "users.update",
    DELETE: "users.delete",
    SUSPEND: "users.suspend",
    VERIFY: "users.verify",
    MANAGE_WALLET: "users.manage_wallet",
    VIEW_BVN: "users.view_bvn",
  },

  // Admin management permissions
  ADMIN: {
    VIEW: "admin.view",
    CREATE: "admin.create",
    UPDATE: "admin.update",
    DELETE: "admin.delete",
    MANAGE_ROLES: "admin.manage_roles",
  },

  // Transaction permissions
  TRANSACTIONS: {
    VIEW: "transactions.view",
    UPDATE: "transactions.update",
    REVERSE: "transactions.reverse",
    EXPORT: "transactions.export",
  },

  // Finance permissions
  FINANCE: {
    VIEW_DEPOSITS: "finance.view_deposits",
    APPROVE_DEPOSITS: "finance.approve_deposits",
    VIEW_WITHDRAWALS: "finance.view_withdrawals",
    APPROVE_WITHDRAWALS: "finance.approve_withdrawals",
    MANAGE_BANK_ACCOUNTS: "finance.manage_bank_accounts",
  },

  SYSTEM_BANK_ACCOUNTS: {
    VIEW: "system_bank_accounts.view",
    CREATE: "system_bank_accounts.create",
    UPDATE: "system_bank_accounts.update",
    DELETE: "system_bank_accounts.delete",
  },

  // Settings permissions
  SETTINGS: {
    VIEW: "settings.view",
    UPDATE: "settings.update",
  },

  // System permissions
  SYSTEM: {
    MANAGE_PROVIDERS: "system.manage_providers",
    MANAGE_SERVICES: "system.manage_services",
    MANAGE_PRODUCTS: "system.manage_products",
    MANAGE_SERVICE_CHARGES: "system.manage_service_charges",
    VIEW_SETTINGS: "system.view_settings",
    UPDATE_SETTINGS: "system.update_settings",
  },
  SERVICE_CHARGES: {
    VIEW: "service_charges.view",
    CREATE: "service_charges.create",
    UPDATE: "service_charges.update",
    DELETE: "service_charges.delete",
  },

  ROUTE_ACTIONS: {
    VIEW: "route_actions.view",
    CREATE: "route_actions.create",
    DELETE: "route_actions.delete",
    UPDATE: "route_actions.update",
  },
  REFERRAL: {
    VIEW: "referral.view",
    CREATE: "referral.create",
    UPDATE: "referral.update",
    DELETE: "referral.delete",
  },
  // Discount permissions
  DISCOUNTS: {
    VIEW: "discounts.view",
    CREATE: "discounts.create",
    UPDATE: "discounts.update",
    DELETE: "discounts.delete",
  },

  // Content permissions
  CONTENT: {
    MANAGE_BANNERS: "content.manage_banners",
    MANAGE_FAQS: "content.manage_faqs",
    MANAGE_ALERTS: "content.manage_alerts",
    SEND_ALERTS: "content.send_alerts",
  },

  // Notification permissions
  NOTIFICATIONS: {
    VIEW: "notifications.view",
    CREATE: "notifications.create",
    DELETE: "notifications.delete",
  },

  // Reports permissions
  REPORTS: {
    VIEW: "reports.view",
    EXPORT: "reports.export",
    GENERATE: "reports.generate",
  },
  APP_VERSIONS: {
    VIEW: "app_versions.view",
    CREATE: "app_versions.create",
    UPDATE: "app_versions.update",
    DELETE: "app_versions.delete",
  },
  // Audit permissions
  AUDIT: {
    VIEW: "audit.view",
    EXPORT: "audit.export",
  },
} as const;

// Extract all permission values for validation
export type AdminPermission =
  | (typeof ADMIN_PERMISSIONS.USERS)[keyof typeof ADMIN_PERMISSIONS.USERS]
  | (typeof ADMIN_PERMISSIONS.ADMIN)[keyof typeof ADMIN_PERMISSIONS.ADMIN]
  | (typeof ADMIN_PERMISSIONS.TRANSACTIONS)[keyof typeof ADMIN_PERMISSIONS.TRANSACTIONS]
  | (typeof ADMIN_PERMISSIONS.FINANCE)[keyof typeof ADMIN_PERMISSIONS.FINANCE]
  | (typeof ADMIN_PERMISSIONS.APP_VERSIONS)[keyof typeof ADMIN_PERMISSIONS.APP_VERSIONS]
  | (typeof ADMIN_PERMISSIONS.SETTINGS)[keyof typeof ADMIN_PERMISSIONS.SETTINGS]
  | (typeof ADMIN_PERMISSIONS.SYSTEM)[keyof typeof ADMIN_PERMISSIONS.SYSTEM]
  | (typeof ADMIN_PERMISSIONS.DISCOUNTS)[keyof typeof ADMIN_PERMISSIONS.DISCOUNTS]
  | (typeof ADMIN_PERMISSIONS.REFERRAL)[keyof typeof ADMIN_PERMISSIONS.REFERRAL]
  | (typeof ADMIN_PERMISSIONS.CONTENT)[keyof typeof ADMIN_PERMISSIONS.CONTENT]
  | (typeof ADMIN_PERMISSIONS.ROUTE_ACTIONS)[keyof typeof ADMIN_PERMISSIONS.ROUTE_ACTIONS]
  | (typeof ADMIN_PERMISSIONS.NOTIFICATIONS)[keyof typeof ADMIN_PERMISSIONS.NOTIFICATIONS]
  | (typeof ADMIN_PERMISSIONS.REPORTS)[keyof typeof ADMIN_PERMISSIONS.REPORTS]
  | (typeof ADMIN_PERMISSIONS.AUDIT)[keyof typeof ADMIN_PERMISSIONS.AUDIT]
  | (typeof ADMIN_PERMISSIONS.SYSTEM_BANK_ACCOUNTS)[keyof typeof ADMIN_PERMISSIONS.SYSTEM_BANK_ACCOUNTS];

// Helper to get all permissions as an array
export const getAllPermissions = (): string[] => {
  const permissions: string[] = [];
  Object.values(ADMIN_PERMISSIONS).forEach((category) => {
    Object.values(category).forEach((permission) => {
      permissions.push(permission);
    });
  });
  return permissions;
};
