import { MiddlewareHandler } from 'hono';

// Pagination utilities
export interface PaginationOptions {
  page: number;
  limit: number;
  offset: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

export const parsePagination = (c: any): PaginationOptions => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '10')));
  const offset = (page - 1) * limit;
  const sortBy = c.req.query('sortBy');
  const sortOrder = (c.req.query('sortOrder') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

  return { page, limit, offset, sortBy, sortOrder };
};

export const createPaginatedResponse = <T>(
  data: T[],
  total: number,
  pagination: PaginationOptions
) => {
  const totalPages = Math.ceil(total / pagination.limit);

  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1
    }
  };
};

// Search and filter utilities
export interface SearchOptions {
  search?: string;
  filters?: Record<string, any>;
}

export const parseSearchFilters = (c: any): SearchOptions => {
  const search = c.req.query('search');
  const filters: Record<string, any> = {};

  // Parse filter parameters (e.g., status=active, category=repair)
  for (const [key, value] of Object.entries(c.req.queries())) {
    if (key.startsWith('filter_')) {
      const filterKey = key.replace('filter_', '');
      filters[filterKey] = value;
    }
  }

  return { search, filters };
};

// Build SQL WHERE clause for search
export const buildSearchWhereClause = (searchFields: string[], searchTerm?: string) => {
  if (!searchTerm || !searchFields.length) return '';

  const conditions = searchFields.map(field =>
    `${field} ILIKE '%${searchTerm.replace(/'/g, "''")}%'`
  );

  return `(${conditions.join(' OR ')})`;
};

// Build SQL WHERE clause for filters
export const buildFilterWhereClause = (filters: Record<string, any>) => {
  const conditions: string[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'boolean') {
        conditions.push(`${key} = ${value}`);
      } else if (typeof value === 'number') {
        conditions.push(`${key} = ${value}`);
      } else {
        conditions.push(`${key} = '${value.toString().replace(/'/g, "''")}'`);
      }
    }
  }

  return conditions.join(' AND ');
};