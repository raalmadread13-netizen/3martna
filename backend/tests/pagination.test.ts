import { paginate } from '../src/utils/pagination';

describe('paginate', () => {
  it('builds an envelope from TotalCount window column', () => {
    const rows = [
      { UserId: 1, Name: 'A', TotalCount: 45 },
      { UserId: 2, Name: 'B', TotalCount: 45 },
    ];
    const result = paginate(rows, { page: 2, pageSize: 20 });
    expect(result.pagination).toEqual({ page: 2, pageSize: 20, totalCount: 45, totalPages: 3 });
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).not.toHaveProperty('TotalCount');
  });

  it('handles empty result sets', () => {
    const result = paginate([], { page: 1, pageSize: 20 });
    expect(result.pagination.totalCount).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
    expect(result.data).toEqual([]);
  });
});
