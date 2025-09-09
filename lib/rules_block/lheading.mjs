// Setext 风格标题处理器（---, ===）
// 用于识别和解析使用下划线的标题语法

export default function lheading (state, startLine, endLine/*, silent */) {
  // 获取段落的终止规则，因为 Setext 标题基于段落
  const terminatorRules = state.md.block.ruler.getRules('paragraph')

  // 如果缩进超过3个空格，应该作为代码块处理
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  const oldParentType = state.parentType
  state.parentType = 'paragraph' // 使用段落来匹配终止规则

  // 逐行查找直到遇到空行或文件结束
  let level = 0  // 标题级别（1 或 2）
  let marker     // 下划线标记符（= 或 -）
  let nextLine = startLine + 1

  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    // 缩进超过3个空格通常是代码块，但在段落之后
    // 被认为是懒惰延续，无论那里有什么内容
    if (state.sCount[nextLine] - state.blkIndent > 3) { continue }

    //
    // 检查 Setext 标题中的下划线
    //
    if (state.sCount[nextLine] >= state.blkIndent) {
      let pos = state.bMarks[nextLine] + state.tShift[nextLine]
      const max = state.eMarks[nextLine]

      if (pos < max) {
        marker = state.src.charCodeAt(pos)

        // 检查是否为有效的下划线标记符
        if (marker === 0x2D/* - */ || marker === 0x3D/* = */) {
          pos = state.skipChars(pos, marker)  // 跳过所有相同的标记符
          pos = state.skipSpaces(pos)         // 跳过空格

          // 如果到达行尾，说明这是有效的下划线
          if (pos >= max) {
            level = (marker === 0x3D/* = */ ? 1 : 2)  // = 表示 h1，- 表示 h2
            break
          }
        }
      }
    }

    // 块引用的特殊情况，这一行应该已经被块引用规则检查过
    if (state.sCount[nextLine] < 0) { continue }

    // 某些标签可以在没有空行的情况下终止段落
    let terminate = false
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true
        break
      }
    }
    if (terminate) { break }
  }

  if (!level) {
    // 没有找到有效的下划线
    return false
  }

  // 获取标题内容（从开始行到下划线行之前）
  const content = state.getLines(startLine, nextLine, state.blkIndent, false).trim()

  // 更新解析器的当前行位置（跳过下划线行）
  state.line = nextLine + 1

  // 创建标题开始 token
  const token_o    = state.push('heading_open', 'h' + String(level), 1)
  token_o.markup   = String.fromCharCode(marker)  // 记录下划线标记符
  token_o.map      = [startLine, state.line]

  // 创建内联内容 token
  const token_i    = state.push('inline', '', 0)
  token_i.content  = content  // 标题文本内容
  token_i.map      = [startLine, state.line - 1]
  token_i.children = []

  // 创建标题结束 token
  const token_c    = state.push('heading_close', 'h' + String(level), -1)
  token_c.markup   = String.fromCharCode(marker)

  // 恢复之前的父级类型
  state.parentType = oldParentType

  return true
}
