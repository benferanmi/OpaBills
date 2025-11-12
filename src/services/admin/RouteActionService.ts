import { RouteActionRepository } from "@/repositories/admin/RouteActionRepository";

export class RouteActionService {
  private routeActionRepository: RouteActionRepository;

  constructor() {
    this.routeActionRepository = new RouteActionRepository();
  }

  async listRouteActions(
    page: number = 1,
    limit: number = 20,
    filters: any = {}
  ) {
    const query: any = {};

    if (filters.module) {
      query.module = filters.module;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    const result = await this.routeActionRepository.findWithPagination(
      query,
      page,
      limit
    );

    return {
      routeActions: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createRouteAction(data: any) {
    // const existingRoute = await this.routeActionRepository.findByRoute(data.route);
    // if (existingRoute) {
    //   throw new Error('Route action already exists');
    // }

    const routeAction = await this.routeActionRepository.create(data);
    return { message: "Route action created successfully", routeAction };
  }

  async getRouteActionDetails(routeActionId: string) {
    const routeAction = await this.routeActionRepository.findById(
      routeActionId
    );
    if (!routeAction) {
      throw new Error("Route action not found");
    }
    return routeAction;
  }

  async updateRouteAction(routeActionId: string, data: any) {
    const routeAction = await this.routeActionRepository.findById(
      routeActionId
    );
    if (!routeAction) {
      throw new Error("Route action not found");
    }

    Object.assign(routeAction, data);
    await routeAction.save();

    return { message: "Route action updated successfully", routeAction };
  }

  async deleteRouteAction(routeActionId: string) {
    await this.routeActionRepository.delete(routeActionId);
    return { message: "Route action deleted successfully" };
  }

  async getRoutesByRole(roleId: string) {
    // const routes = await this.routeActionRepository.findByRole(roleId);
    // return routes;
  }
}
