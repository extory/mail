export interface PageRequest { page: number; pageSize: number }
export function readPage(params: URLSearchParams): PageRequest {
  const number = (key: string, fallback: number, max: number) => {
    const value = Number(params.get(key));
    return Number.isSafeInteger(value) && value > 0 ? Math.min(value, max) : fallback;
  };
  return {page: number('page', 1, 1000000), pageSize: number('pageSize', 30, 200)};
}
export function pageInfo(total: number, request: PageRequest) {
  const page = Math.min(request.page, Math.max(1, Math.ceil(total / request.pageSize)));
  return {total, page, pageSize: request.pageSize, offset: (page - 1) * request.pageSize};
}
