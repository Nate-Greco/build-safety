import dijkstra from "dijkstrajs";
import type { ZoneId } from "./engine";

export interface MapNode {
  x: number;
  y: number;
  zone?: ZoneId;
  stepFreeEntrance?: boolean;
}
export const NODES: Record<string, MapNode> = {
  south: { x: 430, y: 735 },
  village: { x: 430, y: 580, zone: "residence", stepFreeEntrance: false },
  green: { x: 680, y: 580 },
  engineering: { x: 915, y: 420, zone: "engineering" },
  library: { x: 1090, y: 255, zone: "library" },
  west: { x: 430, y: 330 },
  north: { x: 760, y: 265 },
  parking: { x: 650, y: 125, zone: "parking" },
  southEast: { x: 730, y: 740 },
  east: { x: 1080, y: 680 },
};
export const EDGES = [
  ["south", "village"],
  ["village", "green"],
  ["green", "engineering"],
  ["engineering", "library"],
  ["village", "west"],
  ["west", "north"],
  ["north", "library"],
  ["north", "parking"],
  ["south", "southEast"],
  ["southEast", "east"],
  ["east", "engineering"],
  ["east", "library"],
] as const;
export const PLACES = [
  { id: "south", name: "South entrance" },
  { id: "library", name: "Dana Porter Library" },
  { id: "engineering", name: "Engineering 7" },
  { id: "village", name: "Village 1" },
  { id: "parking", name: "North parking" },
] as const;
export type PlaceId = (typeof PLACES)[number]["id"];
export type RouteMode = "fastest" | "weather" | "safety" | "accessible";
// Illustrative path attributes, not surveyed accessibility data.
export const PATH_TRAITS: Record<
  string,
  { stairs?: boolean; slope?: number; surface?: "gravel" | "paved" }
> = {
  "green:engineering": { stairs: true },
  "village:west": { slope: 8 },
  "west:north": { surface: "gravel", slope: 3 },
  "engineering:library": { slope: 7 },
  "east:engineering": { slope: 5 },
};
export interface WalkingRoute {
  nodes: string[];
  path: string;
  metres: number;
  minutes: number;
}
export function pathFor(nodes: string[]): string {
  return nodes
    .map((id, index) => `${index ? "L" : "M"} ${NODES[id].x} ${NODES[id].y}`)
    .join(" ");
}
export function findRoute(
  origin: PlaceId,
  destination: PlaceId,
  excluded: ZoneId[] = [],
  mode: RouteMode = "fastest",
): WalkingRoute | null {
  const blocked = (id: string) =>
    Boolean(NODES[id].zone && excluded.includes(NODES[id].zone!));
  if (blocked(origin) || blocked(destination)) return null;
  if (
    mode === "accessible" &&
    [origin, destination].some((id) => NODES[id].stepFreeEntrance === false)
  )
    return null;
  const graph: Record<string, Record<string, number>> = {};
  for (const id of Object.keys(NODES)) if (!blocked(id)) graph[id] = {};
  for (const [from, to] of EDGES) {
    if (blocked(from) || blocked(to)) continue;
    const distance = Math.hypot(
      NODES[from].x - NODES[to].x,
      NODES[from].y - NODES[to].y,
    );
    const traits = PATH_TRAITS[`${from}:${to}`];
    if (mode === "accessible" && traits?.stairs) continue;
    const cost =
      mode === "accessible"
        ? distance *
          (1 +
            (traits?.slope ?? 0) / 3 +
            (traits?.surface === "gravel" ? 2 : 0))
        : distance;
    graph[from][to] = cost;
    graph[to][from] = cost;
  }
  try {
    const nodes = dijkstra.find_path(graph, origin, destination);
    const metres = Math.round(
      nodes
        .slice(1)
        .reduce(
          (distance, id, index) =>
            distance +
            Math.hypot(
              NODES[id].x - NODES[nodes[index]].x,
              NODES[id].y - NODES[nodes[index]].y,
            ),
          0,
        ) * 0.65,
    );
    return {
      nodes,
      path: pathFor(nodes),
      metres,
      minutes: Math.ceil(metres / 75),
    };
  } catch {
    return null;
  }
}
