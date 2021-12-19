export function setAttr(attrs, name, value) {
  const result = {};
  for (const prop in attrs) result[prop] = attrs[prop];
  result[name] = value;
  return result;
}
