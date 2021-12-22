export function pointsAtCell($pos) {
  return $pos.parent.type.spec.tableRole === "row" && $pos.nodeAfter;
}

export function cellAround($pos) {
  for (let d = $pos.depth - 1; d > 0; d--)
    if ($pos.node(d).type.spec.tableRole == "row")
      return $pos.node(0).resolve($pos.before(d + 1));
  return null;
}

export function setAttr(attrs, name, value) {
  const result = {};
  for (const prop in attrs) result[prop] = attrs[prop];
  result[name] = value;
  return result;
}
