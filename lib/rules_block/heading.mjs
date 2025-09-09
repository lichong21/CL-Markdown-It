// ATX 标题处理器（#, ##, ###, ...）
// 用于识别和解析以 # 开头的标题语法

import { isSpace } from '../common/utils.mjs'

export default function heading (state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine]
  let max = state.eMarks[startLine]

  // 如果缩进超过3个空格，应该作为代码块处理
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  let ch  = state.src.charCodeAt(pos)

  // 必须以 # 字符开始，且位置有效
  if (ch !== 0x23/* # */ || pos >= max) { return false }

  // 计算标题级别（# 的数量）
  let level = 1
  ch = state.src.charCodeAt(++pos)
  while (ch === 0x23/* # */ && pos < max && level <= 6) {
    level++
    ch = state.src.charCodeAt(++pos)
  }

  // 标题级别不能超过6，且 # 后面必须是空格或行尾
  if (level > 6 || (pos < max && !isSpace(ch))) { return false }

  // 静默模式：已确认是有效的标题
  if (silent) { return true }

  // 去除行尾的尾随 # 符号和空格
  // 例如："### 标题 ###   " -> "### 标题"

  max = state.skipSpacesBack(max, pos)
  const tmp = state.skipCharsBack(max, 0x23, pos) // 向后跳过 #
  if (tmp > pos && isSpace(state.src.charCodeAt(tmp - 1))) {
    max = tmp
  }

  // 更新解析器的当前行位置
  state.line = startLine + 1

  // 创建标题开始 token
  const token_o  = state.push('heading_open', 'h' + String(level), 1)
  token_o.markup = '########'.slice(0, level)  // 记录 # 标记符
  token_o.map    = [startLine, state.line]

  // 创建内联内容 token
  const token_i    = state.push('inline', '', 0)
  token_i.content  = state.src.slice(pos, max).trim()  // 标题文本内容
  token_i.map      = [startLine, state.line]
  token_i.children = []

  // 创建标题结束 token
  const token_c  = state.push('heading_close', 'h' + String(level), -1)
  token_c.markup = '########'.slice(0, level)

  return true
}
