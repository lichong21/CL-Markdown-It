// 引用定义处理器
// 用于识别和解析 Markdown 中的引用定义（如：[id]: url "title"）

import { isSpace, normalizeReference } from '../common/utils.mjs'

export default function reference (state, startLine, _endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine]
  let max = state.eMarks[startLine]
  let nextLine = startLine + 1

  // 如果缩进超过3个空格，应该作为代码块处理
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  // 引用定义必须以 '[' 开始
  if (state.src.charCodeAt(pos) !== 0x5B/* [ */) { return false }

  // 获取下一行内容的辅助函数
  function getNextLine (nextLine) {
    const endLine = state.lineMax

    if (nextLine >= endLine || state.isEmpty(nextLine)) {
      // 空行或输入结束
      return null
    }

    let isContinuation = false

    // 缩进超过3个空格通常是代码块，但在段落之后
    // 被认为是懒惰延续，无论那里有什么内容
    if (state.sCount[nextLine] - state.blkIndent > 3) { isContinuation = true }

    // 块引用的特殊情况，这一行应该已经被块引用规则检查过
    if (state.sCount[nextLine] < 0) { isContinuation = true }

    if (!isContinuation) {
      const terminatorRules = state.md.block.ruler.getRules('reference')
      const oldParentType = state.parentType
      state.parentType = 'reference'

      // 某些标签可以在没有空行的情况下终止段落
      let terminate = false
      for (let i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true
          break
        }
      }

      state.parentType = oldParentType
      if (terminate) {
        // 被其他块终止
        return null
      }
    }

    const pos = state.bMarks[nextLine] + state.tShift[nextLine]
    const max = state.eMarks[nextLine]

    // max + 1 显式包含换行符
    return state.src.slice(pos, max + 1)
  }

  let str = state.src.slice(pos, max + 1)

  max = str.length
  let labelEnd = -1

  // 查找引用标签的结束位置 ']'
  for (pos = 1; pos < max; pos++) {
    const ch = str.charCodeAt(pos)
    if (ch === 0x5B /* [ */) {
      // 嵌套的 '[' 不允许
      return false
    } else if (ch === 0x5D /* ] */) {
      labelEnd = pos
      break
    } else if (ch === 0x0A /* \n */) {
      // 如果遇到换行，获取下一行内容
      const lineContent = getNextLine(nextLine)
      if (lineContent !== null) {
        str += lineContent
        max = str.length
        nextLine++
      }
    } else if (ch === 0x5C /* \ */) {
      // 处理转义字符
      pos++
      if (pos < max && str.charCodeAt(pos) === 0x0A) {
        const lineContent = getNextLine(nextLine)
        if (lineContent !== null) {
          str += lineContent
          max = str.length
          nextLine++
        }
      }
    }
  }

  // 检查引用标签后是否有 ':'
  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 0x3A/* : */) { return false }

  // [label]:   destination   'title'
  //         ^^^ 跳过这里的可选空白字符
  for (pos = labelEnd + 2; pos < max; pos++) {
    const ch = str.charCodeAt(pos)
    if (ch === 0x0A) {
      const lineContent = getNextLine(nextLine)
      if (lineContent !== null) {
        str += lineContent
        max = str.length
        nextLine++
      }
    } else if (isSpace(ch)) {
      /* eslint no-empty:0 */
    } else {
      break
    }
  }

  // [label]:   destination   'title'
  //            ^^^^^^^^^^^ 解析这部分的目标地址
  const destRes = state.md.helpers.parseLinkDestination(str, pos, max)
  if (!destRes.ok) { return false }

  // 标准化和验证链接
  const href = state.md.normalizeLink(destRes.str)
  if (!state.md.validateLink(href)) { return false }

  pos = destRes.pos

  // 保存游标状态，可能需要回滚
  const destEndPos = pos
  const destEndLineNo = nextLine

  // [label]:   destination   'title'
  //                       ^^^ 跳过这些空格
  const start = pos
  for (; pos < max; pos++) {
    const ch = str.charCodeAt(pos)
    if (ch === 0x0A) {
      const lineContent = getNextLine(nextLine)
      if (lineContent !== null) {
        str += lineContent
        max = str.length
        nextLine++
      }
    } else if (isSpace(ch)) {
      /* eslint no-empty:0 */
    } else {
      break
    }
  }

  // [label]:   destination   'title'
  //                          ^^^^^^^ 解析这部分的标题
  let titleRes = state.md.helpers.parseLinkTitle(str, pos, max)
  // 处理跨行的标题
  while (titleRes.can_continue) {
    const lineContent = getNextLine(nextLine)
    if (lineContent === null) break
    str += lineContent
    pos = max
    max = str.length
    nextLine++
    titleRes = state.md.helpers.parseLinkTitle(str, pos, max, titleRes)
  }
  let title

  // 处理标题解析结果
  if (pos < max && start !== pos && titleRes.ok) {
    title = titleRes.str
    pos = titleRes.pos
  } else {
    title = ''
    pos = destEndPos
    nextLine = destEndLineNo
  }

  // 跳过尾随空格直到行的其余部分
  while (pos < max) {
    const ch = str.charCodeAt(pos)
    if (!isSpace(ch)) { break }
    pos++
  }

  // 处理行尾的垃圾字符
  if (pos < max && str.charCodeAt(pos) !== 0x0A) {
    if (title) {
      // 标题后行尾有垃圾字符，
      // 但如果我们回滚，它仍然可能是一个有效的引用
      title = ''
      pos = destEndPos
      nextLine = destEndLineNo
      while (pos < max) {
        const ch = str.charCodeAt(pos)
        if (!isSpace(ch)) { break }
        pos++
      }
    }
  }

  if (pos < max && str.charCodeAt(pos) !== 0x0A) {
    // 行尾有垃圾字符
    return false
  }

  // 标准化引用标签
  const label = normalizeReference(str.slice(1, labelEnd))
  if (!label) {
    // CommonMark 0.20 不允许空标签
    return false
  }

  // 引用不能终止任何东西。这个检查仅仅是为了安全。
  /* istanbul ignore if */
  if (silent) { return true }

  // 初始化引用存储
  if (typeof state.env.references === 'undefined') {
    state.env.references = {}
  }
  // 存储引用定义（不覆盖已存在的）
  if (typeof state.env.references[label] === 'undefined') {
    state.env.references[label] = { title, href }
  }

  // 更新解析器的当前行位置
  state.line = nextLine
  return true
}
