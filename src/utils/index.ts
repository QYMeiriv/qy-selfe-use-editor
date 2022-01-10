// 当前工具抽离的核心逻辑为Prosemirror-utils@0.9.6版本的创建表格逻辑(createTable)
// 因为需要创建表格的时候对第一行的表格添加列宽内容，为了后续
// 用户有拉伸的操作，让拉伸逻辑的时候能修改到当前的列宽数据
// 所以当前代码各别与源代码有细微修改

export const tableNodeTypes = schema => {
  if (schema.cached.tableNodeTypes) {
    return schema.cached.tableNodeTypes;
  }
  const roles = {};
  Object.keys(schema.nodes).forEach(type => {
    const nodeType = schema.nodes[type];
    if (nodeType.spec.tableRole) {
      roles[nodeType.spec.tableRole] = nodeType;
    }
  });
  schema.cached.tableNodeTypes = roles;
  return roles;
};

export const createCell = (cellType: any, cellContent = null, cellHasWidth = null) => {
  if (cellContent) {
    return cellType.createChecked(null, cellContent);
  }
  if (cellHasWidth) {
    return cellHasWidth;
  }

  return cellType.createAndFill();
};

export const createTable = (schema, rowsCount = 3, colsCount = 3, withHeaderRow = true, cellContent = null) => {
  const { cell: tableCell, header_cell: tableHeader, row: tableRow, table } = tableNodeTypes(schema);

  const cells = [] as any[];
  const headerCells = [] as any[];
  for (let i = 0; i < colsCount; i++) {
    cells.push(createCell(tableCell, cellContent));

    if (withHeaderRow) {
      const phNode = schema.nodes.paragraph.create(null, schema.text("列宽<305>"));
      const cellHasWidth = tableHeader.create(null, phNode);
      const thNode = createCell(tableHeader, cellContent, cellHasWidth);
      headerCells.push(thNode);
    }
  }

  const rows = [] as any[];
  for (let i = 0; i < rowsCount; i++) {
    rows.push(tableRow.createChecked(null, withHeaderRow && i === 0 ? headerCells : cells));
  }

  return table.createChecked(null, rows);
};
