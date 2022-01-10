export function tableNodeTypes(schema) {
  let result = schema.cached.tableNodeTypes;
  if (!result) {
    result = schema.cached.tableNodeTypes = {};
    for (const name in schema.nodes) {
      const type = schema.nodes[name],
        role = type.spec.tableRole;
      if (role) result[role] = type;
    }
  }
  return result;
}

export function getCellAttrs(dom) {
  const widthAttr = dom.getAttribute("data-colwidth");
  const widths =
    widthAttr && /^\d+(,\d+)*$/.test(widthAttr)
      ? widthAttr.split(",").map(s => Number(s))
      : null;
  const colspan = Number(dom.getAttribute("colspan") || 1);
  const result = {
    colspan,
    rowspan: Number(dom.getAttribute("rowspan") || 1),
    colwidth: widths && widths.length === colspan ? widths : null,
  };
  // for (const prop in extraAttrs) {
  //   const getter = extraAttrs[prop].getFromDOM;
  //   const value = getter && getter(dom);
  //   if (value !== null) result[prop] = value;
  // }
  return result;
}

export function setCellAttrs(node) {
  // console.log("放下", node.attrs.colwidth, "nott", node);
  const attrs = {} as any;
  if (node.attrs.colspan != 1) attrs.colspan = node.attrs.colspan;
  if (node.attrs.rowspan != 1) attrs.rowspan = node.attrs.rowspan;
  if (node.attrs.colwidth) {
    attrs["data-colwidth"] = node.attrs.colwidth.join(",");
  }
  // for (const prop in extraAttrs) {
  //   const setter = extraAttrs[prop].setDOMAttr;
  //   if (setter) setter(node.attrs[prop], attrs);
  // }
  return attrs;
}
