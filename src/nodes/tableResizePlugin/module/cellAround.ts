export function cellAround($pos) {
  for (let d = $pos.depth - 1; d > 0; d--)
    if ($pos.node(d).type.spec.tableRole == "row")
      return $pos.node(0).resolve($pos.before(d + 1));
  return null;
}
