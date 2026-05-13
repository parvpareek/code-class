import type { PortfolioSectionId } from '@/types/portfolio';

export function moveInOrder(
  order: PortfolioSectionId[],
  id: PortfolioSectionId,
  dir: -1 | 1
): PortfolioSectionId[] {
  const i = order.indexOf(id);
  if (i < 0) return order;
  const j = i + dir;
  if (j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
