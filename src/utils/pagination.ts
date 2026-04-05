

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


