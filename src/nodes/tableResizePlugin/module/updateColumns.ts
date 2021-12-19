/**
 * 修改当前行数
 * @param node 当前编辑器state实例
 * @param colgroup colgroup实例
 * @param table table实例
 * @param cellMinWidth 每格的最小宽度
 * @param overrideCol 当前点击cell的列下标
 * @param overrideValue 拖动宽度
 */

export function updateColumns(node, colgroup, table, cellMinWidth, overrideCol, overrideValue) {
  // console.log(
  //   "overrideCol",
  //   overrideCol,
  //   "cellMinWidth",
  //   cellMinWidth,
  //   "overrideValue",
  //   overrideValue
  // );
  let totalWidth = 0;
  let fixedWidth = true;
  let nextDOM = colgroup.firstChild;
  // eslint-disable-next-line prefer-const
  let row = node.firstChild;
  // console.log("nextDom", nextDOM, "row", row.child(0));
  for (let i = 0, col = 0; i < row.childCount; i++) {
    const { colspan, colwidth } = row.child(i).attrs;
    // console.log("colspan", colspan, "colwidth", colwidth);
    for (let j = 0; j < colspan; j++, col++) {
      const hasWidth = overrideCol == col ? overrideValue : colwidth && colwidth[j];
      console.log("hasWidth++", hasWidth);
      const cssWidth = hasWidth ? hasWidth + "px" : "";
      totalWidth += hasWidth || cellMinWidth;
      if (!hasWidth) fixedWidth = false;
      if (!nextDOM) {
        colgroup.appendChild(document.createElement("col")).style.width = cssWidth;
      } else {
        if (nextDOM.style.width != cssWidth) nextDOM.style.width = cssWidth;
        nextDOM = nextDOM.nextSibling;
      }
    }
  }

  while (nextDOM) {
    const after = nextDOM.nextSibling;
    nextDOM.parentNode.removeChild(nextDOM);
    nextDOM = after;
  }

  if (fixedWidth) {
    table.style.width = totalWidth + "px";
    table.style.minWidth = "";
  } else {
    table.style.width = "";
    table.style.minWidth = totalWidth + "px";
  }
}
