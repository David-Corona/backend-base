import { paginate } from './pagination';

describe('paginate', () => {
  it('returns paginated results with correct meta', async () => {
    const countFn = jest.fn().mockResolvedValue(50);
    const findManyFn = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const result = await paginate(countFn, findManyFn, 1, 25);

    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      meta: {
        total: 50,
        page: 1,
        limit: 25,
        totalPages: 2,
      },
    });
  });

  it('calculates skip correctly for page 2', async () => {
    const countFn = jest.fn().mockResolvedValue(50);
    const findManyFn = jest.fn().mockResolvedValue([{ id: 26 }]);

    await paginate(countFn, findManyFn, 2, 25);

    expect(findManyFn).toHaveBeenCalledWith(25, 25);
  });

  it('returns empty data when no results found', async () => {
    const countFn = jest.fn().mockResolvedValue(0);
    const findManyFn = jest.fn().mockResolvedValue([]);

    const result = await paginate(countFn, findManyFn, 1, 10);

    expect(result).toEqual({
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
    });
  });

  it('rounds up totalPages when total is not evenly divisible by limit', async () => {
    const countFn = jest.fn().mockResolvedValue(5);
    const findManyFn = jest.fn().mockResolvedValue([]);

    const result = await paginate(countFn, findManyFn, 1, 3);

    expect(result.meta.totalPages).toBe(2);
  });

  it('calls countFn and findManyFn in parallel', async () => {
    const countFn = jest.fn().mockResolvedValue(10);
    const findManyFn = jest.fn().mockResolvedValue([]);

    await paginate(countFn, findManyFn, 1, 10);

    expect(countFn).toHaveBeenCalledTimes(1);
    expect(findManyFn).toHaveBeenCalledTimes(1);
  });
});
