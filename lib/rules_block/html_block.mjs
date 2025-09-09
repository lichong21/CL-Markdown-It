// HTML 块处理器
// 用于识别和解析 Markdown 中的 HTML 块内容

import block_names from '../common/html_blocks.mjs'
import { HTML_OPEN_CLOSE_TAG_RE } from '../common/html_re.mjs'

// HTML 标签的开始和结束序列数组
// 每个元素包含：[开始正则表达式, 结束正则表达式, 是否可以终止段落]
// 最后一个参数定义该序列是否可以终止段落
const HTML_SEQUENCES = [
  [/^<(script|pre|style|textarea)(?=(\s|>|$))/i, /<\/(script|pre|style|textarea)>/i, true], // script、pre、style、textarea 标签
  [/^<!--/,        /-->/,   true], // HTML 注释
  [/^<\?/,         /\?>/,   true], // 处理指令（如 <?xml ?>）
  [/^<![A-Z]/,     />/,     true], // DOCTYPE 声明
  [/^<!\[CDATA\[/, /\]\]>/, true], // CDATA 块
  [new RegExp('^</?(' + block_names.join('|') + ')(?=(\\s|/?>|$))', 'i'), /^$/, true], // 块级 HTML 标签
  [new RegExp(HTML_OPEN_CLOSE_TAG_RE.source + '\\s*$'),  /^$/, false] // 完整的开闭标签对
]

export default function html_block (state, startLine, endLine, silent) {
  // 获取当前行的起始位置和结束位置
  let pos = state.bMarks[startLine] + state.tShift[startLine] // 行开始位置 + 缩进
  let max = state.eMarks[startLine] // 行结束位置

  // 如果缩进超过 3 个空格，应该作为代码块处理
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  // 如果禁用了 HTML 解析，直接返回 false
  if (!state.md.options.html) { return false }

  // 检查是否以 '<' 字符开始
  if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false }

  // 获取当前行的文本内容
  let lineText = state.src.slice(pos, max)

  // 遍历所有 HTML 序列模式，查找匹配的模式
  let i = 0
  for (; i < HTML_SEQUENCES.length; i++) {
    if (HTML_SEQUENCES[i][0].test(lineText)) { break }
  }
  // 如果没有找到匹配的模式，返回 false
  if (i === HTML_SEQUENCES.length) { return false }

  if (silent) {
    // 静默模式：返回该序列是否可以作为终止符
    // true 表示可以终止段落，false 表示不能
    return HTML_SEQUENCES[i][2]
  }

  let nextLine = startLine + 1

  // 如果执行到这里，说明检测到了 HTML 块
  // 继续向下查找直到块结束
  if (!HTML_SEQUENCES[i][1].test(lineText)) {
    // 逐行查找结束标记
    for (; nextLine < endLine; nextLine++) {
      // 如果缩进小于块缩进，停止查找
      if (state.sCount[nextLine] < state.blkIndent) { break }

      // 获取下一行的位置和内容
      pos = state.bMarks[nextLine] + state.tShift[nextLine]
      max = state.eMarks[nextLine]
      lineText = state.src.slice(pos, max)

      // 检查是否匹配结束模式
      if (HTML_SEQUENCES[i][1].test(lineText)) {
        if (lineText.length !== 0) { nextLine++ } // 如果不是空行，包含结束行
        break
      }
    }
  }

  // 更新解析器的当前行位置
  state.line = nextLine

  // 创建 HTML 块 token
  const token   = state.push('html_block', '', 0)
  token.map     = [startLine, nextLine] // 记录 token 在源码中的行范围
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true) // 获取 HTML 块的完整内容

  return true
}
