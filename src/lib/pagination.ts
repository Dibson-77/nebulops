import { prisma } from "./prisma";
import { IPaginationParams, IPaginationResult } from "@/types";

export class PaginationService {
  /**
   * Pagination générique pour Prisma (adaptée pour Next.js sans safeTransaction)
   */
  static async paginate<T = any>(
    model: keyof typeof prisma,
    params?: IPaginationParams,
    options: {
      where?: any;
      include?: any;
      select?: any;
      orderBy?: any;
      searchables?: string[];
    } = {}
  ): Promise<IPaginationResult<T>> {
    const DEFAULT_LIMIT = 10;
    const safeParams = params ?? {};
    const limit = Math.max(1, Number(safeParams.limit ?? DEFAULT_LIMIT));
    const page = Math.max(1, Number(safeParams.page ?? 1));
    const all = Boolean(safeParams.all);
    const skip = (page - 1) * limit;

    let { where = {}, include, select, orderBy, searchables = [] } = options;

    // Recherche texte
    const searchTerm = safeParams.search ?? safeParams.searchWord;
    if (searchTerm && searchables.length) {
      where = this.generateNestedSearchQuery(searchTerm, searchables, where);
    }

    // Exécution en parallèle (Next.js/Prisma standard)
    const [data, totalItems] = await Promise.all([
      (prisma[model] as any).findMany({
        where,
        ...(include ? { include } : {}),
        ...(select ? { select } : {}),
        orderBy: orderBy || undefined,
        skip: !all ? skip : undefined,
        take: !all ? limit : undefined,
      }),
      (prisma[model] as any).count({ where }),
    ]);

    const totalPages = all
      ? totalItems > 0 ? 1 : 0
      : Math.ceil(totalItems / limit);

    return {
      data,
      metadata: {
        currentPage: all ? 1 : page,
        previousPage: !all && page > 1 ? page - 1 : null,
        nextPage: !all && page < totalPages ? page + 1 : null,
        itemsPerPage: all ? totalItems : limit,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Génère une requête de recherche nested pour Prisma (OR sur plusieurs champs)
   */
  private static generateNestedSearchQuery(
    search: string,
    searchables: string[],
    where: any,
  ): any {
    const searchConditions = searchables.map((field) => {
      const parts = field.split('.');
      if (parts.length > 1) {
        let condition: any = {
          contains: search,
          mode: 'insensitive',
        };
        for (let i = parts.length - 1; i > 0; i--) {
          condition = { [parts[i]]: condition };
        }
        return { [parts[0]]: condition };
      }
      return {
        [field]: {
          contains: search,
          mode: 'insensitive',
        },
      };
    });

    if (where.OR) {
      return {
        ...where,
        AND: [{ OR: where.OR }, { OR: searchConditions }],
      };
    }

    return {
      ...where,
      OR: searchConditions,
    };
  }

  /**
   * Pagination en mémoire pour des tableaux de données déjà chargés
   */
  static paginateInMemory<T>(
    data: T[],
    params?: IPaginationParams,
  ): IPaginationResult<T> {
    const safeParams = params ?? {};
    if (safeParams.all) {
      return {
        data,
        metadata: {
          currentPage: 1,
          previousPage: null,
          nextPage: null,
          itemsPerPage: data.length,
          totalItems: data.length,
          totalPages: 1,
        },
      };
    }

    const page = Number(safeParams.page) || 1;
    const limit = Number(safeParams.limit) || 10;
    const skip = (page - 1) * limit;
    const paginatedData = data.slice(skip, skip + limit);
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: paginatedData,
      metadata: {
        currentPage: page,
        previousPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
        itemsPerPage: limit,
        totalItems,
        totalPages,
      },
    };
  }
}
