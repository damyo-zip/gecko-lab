import type { GameState, Individual } from "./model";

export interface KinshipWarning {
  code: "same" | "lineal" | "siblings" | "recent-ancestor";
  message: string;
  ancestorIds: string[];
}

/** Returns minimum ancestor distances; iterative traversal is safe for long pedigrees. */
export function ancestorDistances(id: string, individuals: GameState["individuals"], maxDepth = Infinity): Map<string, number> {
  const distances = new Map<string, number>();
  const queue: { id: string; depth: number }[] = [{ id, depth: 0 }];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (current.depth >= maxDepth) continue;
    const parentIds = individuals[current.id]?.parents;
    if (!parentIds) continue;
    for (const parentId of [parentIds.fatherId, parentIds.motherId]) {
      const depth = current.depth + 1, previous = distances.get(parentId);
      if (parentId === id || (previous !== undefined && previous <= depth)) continue;
      distances.set(parentId, depth);
      queue.push({ id: parentId, depth });
    }
  }
  return distances;
}

/**
 * Conservative GAME POLICY: block all lineal matings and shared ancestors within
 * two generations of both parents (siblings, half siblings, avuncular and cousins).
 * This is not a calculated inbreeding coefficient.
 */
export function checkKinship(a: Individual, b: Individual, individuals: GameState["individuals"]): KinshipWarning | null {
  if (a.id === b.id) return { code: "same", message: "같은 개체끼리는 교배할 수 없습니다.", ancestorIds: [a.id] };
  const ancestorsA = ancestorDistances(a.id, individuals), ancestorsB = ancestorDistances(b.id, individuals);
  if (ancestorsA.has(b.id) || ancestorsB.has(a.id))
    return { code: "lineal", message: "부모·자손을 포함한 직계 혈통 교배는 차단됩니다.", ancestorIds: [ancestorsA.has(b.id) ? b.id : a.id] };
  const shared = [...ancestorsA.keys()].filter((id) => ancestorsB.has(id) && ancestorsA.get(id)! <= 2 && ancestorsB.get(id)! <= 2);
  if (!shared.length) return null;
  const siblings = shared.some((id) => ancestorsA.get(id) === 1 && ancestorsB.get(id) === 1);
  return { code: siblings ? "siblings" : "recent-ancestor",
    message: siblings ? "형제자매·반형제자매 교배는 차단됩니다." : "두 부모의 최근 2세대에 공통 조상이 있어 교배가 차단됩니다.",
    ancestorIds: shared };
}
