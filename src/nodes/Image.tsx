import * as React from "react";
import { DownloadIcon } from "outline-icons";
import { Plugin, TextSelection, NodeSelection } from "prosemirror-state";
import { InputRule } from "prosemirror-inputrules";
import styled from "styled-components";
import ImageZoom from "react-medium-image-zoom";
import getDataTransferFiles from "../lib/getDataTransferFiles";
import uploadPlaceholderPlugin from "../lib/uploadPlaceholder";
import insertFiles from "../commands/insertFiles";
import Node from "./Node";
import { isNumber } from "lodash";

/**
 * Matches following attributes in Markdown-typed image: [, alt, src, class]
 *
 * Example:
 * ![Lorem](image.jpg) -> [, "Lorem", "image.jpg"]
 * ![](image.jpg "class") -> [, "", "image.jpg", "small"]
 * ![Lorem](image.jpg "class") -> [, "Lorem", "image.jpg", "small"]
 */
const IMAGE_INPUT_REGEX = /!\[(?<alt>[^\]\[]*?)]\((?<filename>[^\]\[]*?)(?=\“|\))\“?(?<layoutclass>[^\]\[\”]+)?\”?\)$/;

const uploadPlugin = options =>
  new Plugin({
    props: {
      handleDOMEvents: {
        paste(view, event: ClipboardEvent): boolean {
          if ((view.props.editable && !view.props.editable(view.state)) || !options.uploadImage) {
            return false;
          }

          if (!event.clipboardData) return false;

          // check if we actually pasted any files
          const files = Array.prototype.slice
            .call(event.clipboardData.items)
            .map(dt => dt.getAsFile())
            .filter(file => file);

          if (files.length === 0) return false;

          const { tr } = view.state;
          if (!tr.selection.empty) {
            tr.deleteSelection();
          }
          const pos = tr.selection.from;

          insertFiles(view, event, pos, files, options);
          return true;
        },
        drop(view, event: DragEvent): boolean {
          if ((view.props.editable && !view.props.editable(view.state)) || !options.uploadImage) {
            return false;
          }

          // filter to only include image files
          const files = getDataTransferFiles(event).filter(file => /image/i.test(file.type));
          if (files.length === 0) {
            return false;
          }

          // grab the position in the document for the cursor
          const result = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });

          if (result) {
            insertFiles(view, event, result.pos, files, options);
            return true;
          }

          return false;
        },
      },
    },
  });

const IMAGE_CLASSES = ["right-50", "left-50"];
const getLayoutAndTitle = tokenTitle => {
  if (!tokenTitle) return {};
  if (IMAGE_CLASSES.includes(tokenTitle)) {
    return {
      layoutClass: tokenTitle,
    };
  } else {
    return {
      title: tokenTitle,
    };
  }
};

const downloadImageNode = async node => {
  const image = await fetch(node.attrs.src);
  const imageBlob = await image.blob();
  const imageURL = URL.createObjectURL(imageBlob);
  const extension = imageBlob.type.split("/")[1];
  const potentialName = node.attrs.alt || "image";

  // create a temporary link node and click it with our image data
  const link = document.createElement("a");
  link.href = imageURL;
  link.download = `${potentialName}.${extension}`;
  document.body.appendChild(link);
  link.click();

  // cleanup
  document.body.removeChild(link);
};

export default class Image extends Node {
  // 图片当前的宽度
  private imgWidth;
  // 图片当前的高度
  private imgHeight;
  // 设置图片宽度的值
  private iptWidth;
  // 设置图片高度的值
  private iptHeight;
  // 用于控制初次拿到图片的值
  private firstSize = false;
  // 当前图片节点的位置
  private imgPos;
  // 当前图片的地址
  private imgSrc;
  // 删除当前节点的储存
  private delTransaction;
  // 存储当前的图片的alt
  private imgAlt;

  get name() {
    return "image";
  }

  get schema() {
    return {
      inline: true,
      attrs: {
        src: {},
        alt: {
          default: null,
        },
        layoutClass: {
          default: null,
        },
        title: {
          default: null,
        },
      },
      content: "text*",
      marks: "",
      group: "inline",
      selectable: true,
      draggable: true,
      parseDOM: [
        {
          tag: "div[class~=image]",
          getAttrs: (dom: HTMLDivElement) => {
            const img = dom.getElementsByTagName("img")[0];
            const className = dom.className;
            const layoutClassMatched = className && className.match(/image-(.*)$/);
            const layoutClass = layoutClassMatched ? layoutClassMatched[1] : null;
            return {
              src: img?.getAttribute("src"),
              alt: img?.getAttribute("alt"),
              title: img?.getAttribute("title"),
              layoutClass: layoutClass,
            };
          },
        },
        {
          tag: "img",
          getAttrs: (dom: HTMLImageElement) => {
            return {
              src: dom.getAttribute("src"),
              alt: dom.getAttribute("alt"),
              title: dom.getAttribute("title"),
              width: dom.getAttribute("width"),
            };
          },
        },
      ],
      toDOM: node => {
        const className = node.attrs.layoutClass ? `image image-${node.attrs.layoutClass}` : "image";
        return [
          "div",
          {
            class: className,
          },
          ["img", { ...node.attrs, contentEditable: false }],
          ["p", { class: "caption" }, 0],
        ];
      },
    };
  }

  handleKeyDown = ({ node, getPos }) => event => {
    // Pressing Enter in the caption field should move the cursor/selection
    // below the image
    if (event.key === "Enter") {
      event.preventDefault();

      const { view } = this.editor;
      const $pos = view.state.doc.resolve(getPos() + node.nodeSize);
      view.dispatch(view.state.tr.setSelection(new TextSelection($pos)).split($pos.pos));
      view.focus();
      return;
    }

    // Pressing Backspace in an an empty caption field should remove the entire
    // image, leaving an empty paragraph
    if (event.key === "Backspace" && event.target.innerText === "") {
      const { view } = this.editor;
      const $pos = view.state.doc.resolve(getPos());
      const tr = view.state.tr.setSelection(new NodeSelection($pos));
      view.dispatch(tr.deleteSelection());
      view.focus();
      return;
    }
  };

  handleBlur = ({ node, getPos }) => event => {
    const alt = event.target.innerText;
    const { src, title, layoutClass } = node.attrs;

    if (alt === node.attrs.alt) return;

    const { view } = this.editor;
    const { tr } = view.state;

    // update meta on object
    const pos = getPos();
    const transaction = tr.setNodeMarkup(pos, undefined, {
      src,
      alt,
      title,
      layoutClass,
    });
    view.dispatch(transaction);
  };

  /**
   * @description 点击当前内容的图片
   * @version 1.1.0
   * @author 弹吉他的CoderQ
   */
  handleSelect = ({ getPos, node }) => event => {
    event.preventDefault();
    const { view } = this.editor;
    const $pos = view.state.doc.resolve(getPos());
    const transaction = view.state.tr.setSelection(new NodeSelection($pos));
    view.dispatch(transaction);

    // 存储当前图片的alt
    this.imgAlt = node.attrs.alt;
    this.imgPos = $pos.pos;
    this.imgSrc = node.attrs.src;
    // 获取点击时候的图片dom实例
    let imgNode = event.target.childNodes[1];
    // 这里是因为初次点击可能第一个target就是img，但是二次点击之后target可能会有多一个span所以就要做判断
    if (!imgNode) {
      imgNode = event.target;
    }
    /*
    firstSize的用途主要解决点击图片之后点击下方的宽高input会再次触发这个事件导致拿到的是input的宽高了
    所以只对初次拿的图片做存储
    */
    if (!this.firstSize && !this.iptHeight && !this.iptWidth) {
      this.imgWidth = imgNode.offsetWidth ? imgNode.offsetWidth : this.imgWidth;
      this.imgHeight = imgNode.offsetHeight ? imgNode.offsetHeight : this.imgHeight;
      this.firstSize = true;

      const domHeight = document.getElementsByClassName("img-h");
      const domWidth = document.getElementsByClassName("img-w");

      for (let i = 0; i < domHeight.length; i++) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        domHeight[i].value = this.imgHeight;
      }

      for (let i = 0; i < domWidth.length; i++) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        domWidth[i].value = this.imgWidth;
      }
    }
  };

  handleDownload = ({ node }) => event => {
    event.preventDefault();
    event.stopPropagation();
    downloadImageNode(node);
  };

  component = props => {
    const { theme, isSelected } = props;
    const { alt, src, title, layoutClass } = props.node.attrs;
    const className = layoutClass ? `image image-${layoutClass}` : "image";

    // 宽高触发文本事件
    const changeImgSize = (e: any, type) => {
      const val = e.target.value;
      const domHeight = document.getElementsByClassName("img-h");
      const domWidth = document.getElementsByClassName("img-w");
      const equalProportion = parseInt(this.imgWidth) / parseInt(this.imgHeight);

      // 当内容为空的时候，就要把宽高值重新设置为空
      if (!val) {
        if (type === "width") {
          for (let i = 0; i < domHeight.length; i++) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            domHeight[i].value = null;
          }
        }

        if (type === "height") {
          for (let i = 0; i < domWidth.length; i++) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            domWidth[i].value = null;
          }
        }
        return;
      }
      if (type === "width") {
        this.iptWidth = val;
        for (let i = 0; i < domHeight.length; i++) {
          this.iptHeight = Math.ceil(val / equalProportion);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          domHeight[i].value = this.iptHeight;
        }
      }

      if (type === "height") {
        this.iptHeight = val;
        for (let i = 0; i < domWidth.length; i++) {
          this.iptWidth = Math.ceil(val * equalProportion);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          domWidth[i].value = this.iptWidth;
        }
      }
    };

    // 失去宽高input的焦点编辑
    const blurIsShowImgSize = () => {
      this.firstSize = false;
      if (this.iptWidth && this.iptHeight) {
        const { view } = this.editor;
        const { schema } = view.state;
        // 存储当前准备要删除的节点
        const delTransaction = view.state.tr.deleteSelection();
        this.delTransaction = delTransaction;

        // 开始调用传进来的异步请求和后端换取修改尺寸后的图片地址
        this.options
          .changeImgSize(this.iptWidth, this.iptHeight, this.imgSrc)
          .then(src => {
            view.dispatch(this.delTransaction);
            const te = schema.nodes.image.create({ src, alt });
            const transaction = view.state.tr.replaceWith(this.imgPos, this.imgPos, te);
            view.dispatch(transaction);
            this.iptHeight = null;
            this.iptWidth = null;
          })
          .catch(() => {
            throw new Error("修改图片尺寸失败");
          });
      }
    };
    return (
      <div contentEditable={false} className={className}>
        <ImageWrapper className={isSelected ? "ProseMirror-selectednode" : ""} onClick={this.handleSelect(props)}>
          <Button>
            <DownloadIcon color="currentColor" onClick={this.handleDownload(props)} />
          </Button>
          <ImageZoom
            image={{
              src,
              alt,
              title,
            }}
            defaultStyles={{
              overlay: {
                backgroundColor: theme.background,
              },
            }}
            shouldRespectMaxDimension
          />
          {/* 修改图片宽高 */}
          <SizeWrapper style={{ display: isSelected ? "block" : "none" }}>
            <FlexWrapper>
              <span>宽：</span>
              <input
                onBlur={blurIsShowImgSize}
                type="text"
                className="imgSize-ipt img-w"
                onChange={e => changeImgSize(e, "width")}
              />
            </FlexWrapper>

            <FlexWrapper>
              <span>高：</span>
              <input
                onBlur={blurIsShowImgSize}
                type="text"
                className="imgSize-ipt img-h"
                onChange={e => changeImgSize(e, "height")}
              />
            </FlexWrapper>
          </SizeWrapper>
        </ImageWrapper>
        <Caption
          onKeyDown={this.handleKeyDown(props)}
          onBlur={this.handleBlur(props)}
          className="caption"
          tabIndex={-1}
          role="textbox"
          contentEditable
          suppressContentEditableWarning
          data-caption={this.options.dictionary.imageCaptionPlaceholder}
        >
          {alt}
        </Caption>
      </div>
    );
  };

  toMarkdown(state, node) {
    let markdown = " ![" + state.esc((node.attrs.alt || "").replace("\n", "") || "") + "](" + state.esc(node.attrs.src);
    if (node.attrs.layoutClass) {
      markdown += ' "' + state.esc(node.attrs.layoutClass) + '"';
    } else if (node.attrs.title) {
      markdown += ' "' + state.esc(node.attrs.title) + '"';
    }
    markdown += ")";
    state.write(markdown);
  }

  parseMarkdown() {
    return {
      node: "image",
      getAttrs: token => {
        return {
          src: token.attrGet("src"),
          alt: (token.children[0] && token.children[0].content) || null,
          ...getLayoutAndTitle(token.attrGet("title")),
        };
      },
    };
  }

  commands({ type }) {
    return {
      downloadImage: () => async state => {
        const { node } = state.selection;

        if (node.type.name !== "image") {
          return false;
        }

        downloadImageNode(node);

        return true;
      },
      deleteImage: () => (state, dispatch) => {
        dispatch(state.tr.deleteSelection());
        return true;
      },
      alignRight: () => (state, dispatch) => {
        const attrs = {
          ...state.selection.node.attrs,
          title: null,
          layoutClass: "right-50",
        };
        const { selection } = state;
        dispatch(state.tr.setNodeMarkup(selection.from, undefined, attrs));
        return true;
      },
      alignLeft: () => (state, dispatch) => {
        const attrs = {
          ...state.selection.node.attrs,
          title: null,
          layoutClass: "left-50",
        };
        const { selection } = state;
        dispatch(state.tr.setNodeMarkup(selection.from, undefined, attrs));
        return true;
      },
      alignCenter: () => (state, dispatch) => {
        const attrs = { ...state.selection.node.attrs, layoutClass: null };
        const { selection } = state;
        dispatch(state.tr.setNodeMarkup(selection.from, undefined, attrs));
        return true;
      },
      createImage: attrs => (state, dispatch) => {
        const { selection } = state;
        const position = selection.$cursor ? selection.$cursor.pos : selection.$to.pos;
        const node = type.create(attrs);
        const transaction = state.tr.insert(position, node);
        dispatch(transaction);
        return true;
      },
    };
  }

  inputRules({ type }) {
    return [
      new InputRule(IMAGE_INPUT_REGEX, (state, match, start, end) => {
        const [okay, alt, src, matchedTitle] = match;
        const { tr } = state;

        if (okay) {
          tr.replaceWith(
            start - 1,
            end,
            type.create({
              src,
              alt,
              ...getLayoutAndTitle(matchedTitle),
            })
          );
        }

        return tr;
      }),
    ];
  }

  get plugins() {
    return [uploadPlaceholderPlugin, uploadPlugin(this.options)];
  }
}

const Button = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  border: 0;
  margin: 0;
  padding: 0;
  border-radius: 4px;
  background: ${props => props.theme.background};
  color: ${props => props.theme.textSecondary};
  width: 24px;
  height: 24px;
  display: inline-block;
  cursor: pointer;
  opacity: 0;
  transition: opacity 100ms ease-in-out;

  &:active {
    transform: scale(0.98);
  }

  &:hover {
    color: ${props => props.theme.text};
    opacity: 1;
  }
`;

const SizeWrapper = styled.div`
  flex-direction: column;
  display: flex;
  justify-content: space-between;
  position: relative;
  display: none;
  border-radius: 5px;
  margin-top: 4px;
`;

const FlexWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  margin-right: 20px;
`;

const ImageWrapper = styled.span`
  line-height: 0;
  display: inline-block;
  position: relative;

  &:hover {
    ${Button} {
      opacity: 0.9;
    }
  }
`;

const Caption = styled.p`
  border: 0;
  display: block;
  font-size: 13px;
  font-style: italic;
  font-weight: normal;
  color: ${props => props.theme.textSecondary};
  padding: 2px 0;
  line-height: 16px;
  text-align: center;
  min-height: 1em;
  outline: none;
  background: none;
  resize: none;
  user-select: text;
  cursor: text;

  &:empty:before {
    color: ${props => props.theme.placeholder};
    content: attr(data-caption);
    pointer-events: none;
  }
`;
