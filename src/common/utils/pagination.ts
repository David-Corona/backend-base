import type { PaginatedResponse } from '../dto/paginated-response.dto';

export async function paginate<T>(
  countFn: () => Promise<number>,
  findManyFn: (skip: number, take: number) => Promise<T[]>,
  page: number,
  limit: number,
): Promise<PaginatedResponse<T>> {
  const skip = (page - 1) * limit;
  const [total, data] = await Promise.all([
    countFn(),
    findManyFn(skip, limit),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}