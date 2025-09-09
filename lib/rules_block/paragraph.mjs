// 段落处理器
// 用于识别和解析普通的文本段落

export default function paragraph (state, startLine, endLine) {
  // 获取所有可以终止段落的规则
  const terminatorRules = state.md.block.ruler.getRules('paragraph')
  const oldParentType = state.parentType
  let nextLine = startLine + 1
  state.parentType = 'paragraph'

  // 逐行查找直到遇到空行或文件结束
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    // 缩进超过3个空格通常是代码块，但在段落之后
    // 被认为是懒惰延续，无论那里有什么内容
    if (state.sCount[nextLine] - state.blkIndent > 3) { continue }

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

  // 获取段落内容并去除首尾空白
  const content = state.getLines(startLine, nextLine, state.blkIndent, false).trim()

  // 更新解析器的当前行位置
  state.line = nextLine

  // 创建段落开始 token
  const token_o    = state.push('paragraph_open', 'p', 1)
  token_o.map      = [startLine, state.line]

  // 创建内联内容 token
  const token_i    = state.push('inline', '', 0)
  token_i.content  = content  // 段落文本内容
  token_i.map      = [startLine, state.line]
  token_i.children = []

  // 创建段落结束 token
  state.push('paragraph_close', 'p', -1)

  // 恢复之前的父级类型
  state.parentType = oldParentType

  return true
}
