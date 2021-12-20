//@ts-nocheck

import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { tableNodeTypes, TableView, cellAround, setAttr, TableMap, updateColumns } from "./module";

export const key = new PluginKey("tableResizePlugin");

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function columnResizing({ handleWidth = 5, cellMinWidth = 25, View = TableView, lastColumnResizable = true } = {}) {
  const plugin = new Plugin({
    key,
    state: {
      init(_, state) {
        this.spec.props.nodeViews[tableNodeTypes(state.schema).table.name] = (node, view) => {
          return new View(node, cellMinWidth, view);
        };
        return new ResizeState(-1, false);
      },

      apply(tr, prev) {
        return prev.apply(tr);
      },
    },
    props: {
      attributes(state) {
        const pluginState = key.getState(state);
        return pluginState.activeHandle > -1 ? { class: "resize-cursor" } : null;
      },

      handleDOMEvents: {
        mousemove(view, event) {
          return handleMouseMove(view, event, handleWidth, cellMinWidth, lastColumnResizable);
        },
        mouseleave(view) {
          handleMouseLeave(view);
        },
        mousedown(view, event) {
          handleMouseDown(view, event, cellMinWidth);
        },
      },

      decorations(state) {
        const pluginState = key.getState(state);
        if (pluginState.activeHandle > -1) return handleDecorations(state, pluginState.activeHandle);
      },

      nodeViews: {},
    },
  });
  return plugin;
}

class ResizeState {
  constructor(activeHandle, dragging) {
    this.activeHandle = activeHandle;
    this.dragging = dragging;
  }

  apply(tr) {
    let state = this,
      action = tr.getMeta(key);
    if (action && action.setHandle != null) return new ResizeState(action.setHandle, null);
    if (action && action.setDragging !== undefined) return new ResizeState(state.activeHandle, action.setDragging);
    if (state.activeHandle > -1 && tr.docChanged) {
      let handle = tr.mapping.map(state.activeHandle, -1);
      if (!pointsAtCell(tr.doc.resolve(handle))) handle = null;
      state = new ResizeState(handle, state.dragging);
    }
    return state;
  }
}

function domCellAround(target) {
  while (target && target.nodeName != "TD" && target.nodeName != "TH")
    target = target.classList.contains("ProseMirror") ? null : target.parentNode;
  return target;
}

export function pointsAtCell($pos) {
  return $pos.parent.type.spec.tableRole == "row" && $pos.nodeAfter;
}

function handleMouseMove(view, event, handleWidth, cellMinWidth, lastColumnResizable) {
  const pluginState = key.getState(view.state);
  if (!pluginState.dragging) {
    // eslint-disable-next-line prefer-const
    let target = domCellAround(event.target),
      cell = -1;
    if (target) {
      const { left, right } = target.getBoundingClientRect();
      if (event.clientX - left <= handleWidth) cell = edgeCell(view, event, "left");
      else if (right - event.clientX <= handleWidth) cell = edgeCell(view, event, "right");
    }

    if (cell != pluginState.activeHandle) {
      if (!lastColumnResizable && cell !== -1) {
        const $cell = view.state.doc.resolve(cell);
        const table = $cell.node(-1),
          map = TableMap.get(table),
          start = $cell.start(-1);
        const col = map.colCount($cell.pos - start) + $cell.nodeAfter.attrs.colspan - 1;

        if (col == map.width - 1) {
          return;
        }
      }

      updateHandle(view, cell);
    }
  }
}

function edgeCell(view, event, side) {
  const found = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!found) return -1;
  const { pos } = found;
  const $cell = cellAround(view.state.doc.resolve(pos));
  if (!$cell) return -1;
  if (side == "right") return $cell.pos;
  const map = TableMap.get($cell.node(-1)),
    start = $cell.start(-1);
  const index = map.map.indexOf($cell.pos - start);
  return index % map.width == 0 ? -1 : start + map.map[index - 1];
}

function updateHandle(view, value) {
  view.dispatch(view.state.tr.setMeta(key, { setHandle: value }));
}

// 拖动后改变colgroup的style
function displayColumnWidth(view, cell, width, cellMinWidth) {
  const $cell = view.state.doc.resolve(cell);
  const table = $cell.node(-1),
    start = $cell.start(-1);
  const col = TableMap.get(table).colCount($cell.pos - start) + $cell.nodeAfter.attrs.colspan - 1;
  let dom = view.domAtPos($cell.start(-1)).node;
  while (dom.nodeName != "TABLE") dom = dom.parentNode;
  // 更新Col
  updateColumns(table, dom.firstChild, dom, cellMinWidth, col, width);
}

function handleMouseLeave(view) {
  const pluginState = key.getState(view.state);
  if (pluginState.activeHandle > -1 && !pluginState.dragging) updateHandle(view, -1);
}

function handleMouseDown(view, event, cellMinWidth) {
  const pluginState = key.getState(view.state);
  if (pluginState.activeHandle == -1 || pluginState.dragging) return false;

  const cell = view.state.doc.nodeAt(pluginState.activeHandle);
  const width = currentColWidth(view, pluginState.activeHandle, cell.attrs);
  view.dispatch(
    view.state.tr.setMeta(key, {
      setDragging: { startX: event.clientX, startWidth: width },
    })
  );

  // 拖动放开之后触发的事件
  function finish(event) {
    window.removeEventListener("mouseup", finish);
    window.removeEventListener("mousemove", move);
    const pluginState = key.getState(view.state);
    if (pluginState.dragging) {
      updateColumnWidth(view, pluginState.activeHandle, draggedWidth(pluginState.dragging, event, cellMinWidth));
      view.dispatch(view.state.tr.setMeta(key, { setDragging: null }));
    }
  }

  // 点击之后进行拖动触发的事件
  function move(event) {
    console.log("产生拖动");
    if (!event.which) return finish(event);
    const pluginState = key.getState(view.state);
    const dragged = draggedWidth(pluginState.dragging, event, cellMinWidth);
    displayColumnWidth(view, pluginState.activeHandle, dragged, cellMinWidth);
  }

  window.addEventListener("mouseup", finish);
  window.addEventListener("mousemove", move);
  event.preventDefault();
  return true;
}

function currentColWidth(view, cellPos, { colspan, colwidth }) {
  const width = colwidth && colwidth[colwidth.length - 1];
  if (width) return width;
  const dom = view.domAtPos(cellPos);
  const node = dom.node.childNodes[dom.offset];
  let domWidth = node.offsetWidth,
    parts = colspan;
  if (colwidth)
    for (let i = 0; i < colspan; i++)
      if (colwidth[i]) {
        domWidth -= colwidth[i];
        parts--;
      }
  return domWidth / parts;
}

function draggedWidth(dragging, event, cellMinWidth) {
  const offset = event.clientX - dragging.startX;
  return Math.max(cellMinWidth, dragging.startWidth + offset);
}

function updateColumnWidth(view, cell, width) {
  const $cell = view.state.doc.resolve(cell);
  const table = $cell.node(-1),
    map = TableMap.get(table),
    start = $cell.start(-1);
  const col = map.colCount($cell.pos - start) + $cell.nodeAfter.attrs.colspan - 1;
  const tr = view.state.tr;
  for (let row = 0; row < map.height; row++) {
    const mapIndex = row * map.width + col;
    // Rowspanning cell that has already been handled
    if (row && map.map[mapIndex] == map.map[mapIndex - map.width]) continue;
    const pos = map.map[mapIndex],
      { attrs } = table.nodeAt(pos);
    const index = attrs.colspan == 1 ? 0 : col - map.colCount(pos);
    if (attrs.colwidth && attrs.colwidth[index] == width) continue;
    const colwidth = attrs.colwidth ? attrs.colwidth.slice() : zeroes(attrs.colspan);
    colwidth[index] = width;
    tr.setNodeMarkup(start + pos, null, setAttr(attrs, "colwidth", colwidth));
  }
  if (tr.docChanged) view.dispatch(tr);
}

function zeroes(n) {
  const result = [];
  for (let i = 0; i < n; i++) result.push(0);
  return result;
}

function handleDecorations(state, cell) {
  const decorations = [];
  const $cell = state.doc.resolve(cell);
  const table = $cell.node(-1),
    map = TableMap.get(table),
    start = $cell.start(-1);
  const col = map.colCount($cell.pos - start) + $cell.nodeAfter.attrs.colspan;
  for (let row = 0; row < map.height; row++) {
    const index = col + row * map.width - 1;
    // For positions that are have either a different cell or the end
    // of the table to their right, and either the top of the table or
    // a different cell above them, add a decoration
    if (
      (col == map.width || map.map[index] != map.map[index + 1]) &&
      (row == 0 || map.map[index - 1] != map.map[index - 1 - map.width])
    ) {
      const cellPos = map.map[index];
      const pos = start + cellPos + table.nodeAt(cellPos).nodeSize - 1;
      const dom = document.createElement("div");
      dom.className = "column-resize-handle";
      decorations.push(Decoration.widget(pos, dom));
    }
  }
  return DecorationSet.create(state.doc, decorations);
}

export function getCellAttrs(dom, extraAttrs) {
  console.log("getCellAttrs", extraAttrs);
  const widthAttr = dom.getAttribute("data-colwidth");
  const widths = widthAttr && /^\d+(,\d+)*$/.test(widthAttr) ? widthAttr.split(",").map(s => Number(s)) : null;
  const colspan = Number(dom.getAttribute("colspan") || 1);
  const result = {
    colspan,
    rowspan: Number(dom.getAttribute("rowspan") || 1),
    colwidth: widths && widths.length == colspan ? widths : null,
  };
  for (const prop in extraAttrs) {
    const getter = extraAttrs[prop].getFromDOM;
    const value = getter && getter(dom);
    if (value != null) result[prop] = value;
  }
  return result;
}

export function setCellAttrs(node, extraAttrs) {
  const attrs = {};
  if (node.attrs.colspan != 1) attrs.colspan = node.attrs.colspan;
  if (node.attrs.rowspan != 1) attrs.rowspan = node.attrs.rowspan;
  if (node.attrs.colwidth) attrs["data-colwidth"] = node.attrs.colwidth.join(",");
  for (const prop in extraAttrs) {
    const setter = extraAttrs[prop].setDOMAttr;
    if (setter) setter(node.attrs[prop], attrs);
  }
  return attrs;
}
