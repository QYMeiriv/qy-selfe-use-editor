// @ts-nocheck

import { updateColumns } from "./updateColumns";

export class TableView {
  constructor(node, cellMinWidth) {
    this.node = node;
    this.cellMinWidth = cellMinWidth;
    this.dom = document.createElement("div");
    this.dom.className = "tableWrapper";
    this.table = this.dom.appendChild(document.createElement("table"));
    this.colgroup = this.table.appendChild(document.createElement("colgroup"));
    updateColumns(node, this.colgroup, this.table, cellMinWidth);
    this.contentDOM = this.table.appendChild(document.createElement("tbody"));
  }

  update(node) {
    if (node.type != this.node.type) return false;
    this.node = node;
    updateColumns(node, this.colgroup, this.table, this.cellMinWidth);
    return true;
  }

  ignoreMutation(record) {
    return (
      record.type == "attributes" &&
      (record.target == this.table || this.colgroup.contains(record.target))
    );
  }
}
