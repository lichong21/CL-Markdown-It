// 水平分割线处理器
// 用于识别和解析 Markdown 中的水平分割线（--- 或 *** 或 ___）

import { isSpace } from '../common/utils.mjs'

export default function hr (state, startLine, endLine, silent) {
  const max = state.eMarks[startLine]
  // 如果缩进超过3个空格，应该作为代码块处理
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  let pos = state.bMarks[startLine] + state.tShift[startLine]
  const marker = state.src.charCodeAt(pos++)

  // 检查水平分割线标记符
  // 只接受 * - _ 三种字符
  if (marker !== 0x2A/* * */ &&
      marker !== 0x2D/* - */ &&
      marker !== 0x5F/* _ */) {
    return false
  }

  // 标记符可以与空格混合，但必须至少有3个相同的标记符

  let cnt = 1  // 已经找到一个标记符
  while (pos < max) {
    const ch = state.src.charCodeAt(pos++)
    // 如果字符既不是标记符也不是空格，则无效
    if (ch !== marker && !isSpace(ch)) { return false }
    // 统计标记符数量
    if (ch === marker) { cnt++ }
  }

  // 标记符数量必须至少为3
  if (cnt < 3) { return false }

  // 静默模式：已确认是有效的水平分割线
  if (silent) { return true }

  // 更新解析器的当前行位置
  state.line = startLine + 1

  // 创建水平分割线 token
  const token  = state.push('hr', 'hr', 0)
  token.map    = [startLine, state.line]
  // 记录原始标记符序列
  token.markup = Array(cnt + 1).join(String.fromCharCode(marker))

  return true
}
