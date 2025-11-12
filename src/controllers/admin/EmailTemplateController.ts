// import { Request, Response, NextFunction } from 'express';
// import { EmailTemplateService } from '@/services/admin/EmailTemplateService';

// export class EmailTemplateController {
//   private emailTemplateService: EmailTemplateService;

//   constructor() {
//     this.emailTemplateService = new EmailTemplateService();
//   }

//   listEmailTemplates = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { page = 1, limit = 20, status, category, search } = req.query;
//       const result = await this.emailTemplateService.listEmailTemplates(
//         Number(page),
//         Number(limit),
//         { status, category, search }
//       );
//       res.json(result);
//     } catch (error) {
//       next(error);
//     }
//   };

//   createEmailTemplate = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const result = await this.emailTemplateService.createEmailTemplate(req.body);
//       res.status(201).json(result);
//     } catch (error) {
//       next(error);
//     }
//   };

//   getEmailTemplateDetails = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { id } = req.params;
//       const template = await this.emailTemplateService.getEmailTemplateDetails(id);
//       res.json(template);
//     } catch (error) {
//       next(error);
//     }
//   };

//   updateEmailTemplate = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { id } = req.params;
//       const result = await this.emailTemplateService.updateEmailTemplate(id, req.body);
//       res.json(result);
//     } catch (error) {
//       next(error);
//     }
//   };

//   deleteEmailTemplate = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { id } = req.params;
//       const result = await this.emailTemplateService.deleteEmailTemplate(id);
//       res.json(result);
//     } catch (error) {
//       next(error);
//     }
//   };

//   renderTemplate = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { slug } = req.params;
//       const { variables } = req.body;
//       const result = await this.emailTemplateService.renderTemplate(slug, variables || {});
//       res.json(result);
//     } catch (error) {
//       next(error);
//     }
//   };
// }
