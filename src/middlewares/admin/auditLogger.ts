import { Response, NextFunction } from "express";
import { AuditLog } from "@/models/admin/AuditLog";
import { AdminAuthenticatedRequest } from "@/types/admin";

export const auditLog = (action: string, resource: string) => {
  return async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    // Store original send function
    const originalSend = res.send;

    // Override send function to capture response
    res.send = function (data: any): Response {
      // Log the admin action
      if (req.admin) {
        const status =
          res.statusCode >= 200 && res.statusCode < 300 ? "success" : "failed";

        AuditLog.create({
          adminId: req.admin.id,
          action,
          resource,
          resourceId: req.params.id || req.body.id,
          details: {
            method: req.method,
            path: req.path,
            body: req.body,
            query: req.query,
            params: req.params,
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("user-agent"),
          status,
          errorMessage: status === "failed" ? JSON.stringify(data) : undefined,
        }).catch((error) => {
          console.error("Audit log error:", error);
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
};
