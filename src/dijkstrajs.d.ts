declare module "dijkstrajs" {
  const dijkstra: {
    find_path(
      graph: Record<string, Record<string, number>>,
      start: string,
      end: string,
    ): string[];
  };
  export default dijkstra;
}
