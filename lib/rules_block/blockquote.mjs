// 块引用处理器
// 用于识别和解析 Markdown 中的块引用内容（以 > 开头）

import { isSpace } from '../common/utils.mjs'

export default function blockquote (state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine]
  let max = state.eMarks[startLine]

  const oldLineMax = state.lineMax

  // 如果缩进超过3个空格，应该作为代码块处理
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  // 检查块引用标记符 >
  if (state.src.charCodeAt(pos) !== 0x3E/* > */) { return false }

  // 静默模式：已知这将是一个有效的块引用，
  // 所以没有必要在静默模式下尝试找到它的结束位置
  if (silent) { return true }

  // 保存原始状态，用于后续恢复
  const oldBMarks  = []  // 行开始位置
  const oldBSCount = []  // 虚拟空格数量
  const oldSCount  = []  // 空格数量
  const oldTShift  = []  // 缩进偏移

  // 获取块引用的终止规则
  const terminatorRules = state.md.block.ruler.getRules('blockquote')

  const oldParentType = state.parentType
  state.parentType = 'blockquote'
  let lastLineEmpty = false  // 记录上一行是否为空
  let nextLine

  // 查找块的结束位置
  //
  // 块的结束条件包括：
  //  1. 外部的空行：
  //     ```
  //     > test
  //
  //     ```
  //  2. 内部的空行：
  //     ```
  //     >
  //     test
  //     ```
  //  3. 其他标签：
  //     ```
  //     > test
  //      - - -
  //     ```
  for (nextLine = startLine; nextLine < endLine; nextLine++) {
    // 检查是否为出檀（outdented），即它在列表项内部且缩进
    // 少于该列表项：
    //
    // ```
    // 1. anything
    //    > current blockquote
    // 2. checking this line
    // ```
    const isOutdented = state.sCount[nextLine] < state.blkIndent

    pos = state.bMarks[nextLine] + state.tShift[nextLine]
    max = state.eMarks[nextLine]

    if (pos >= max) {
      // 情况1：行不在块引用内，且该行为空
      break
    }

    if (state.src.charCodeAt(pos++) === 0x3E/* > */ && !isOutdented) {
      // 这一行在块引用内部

      // 设置偏移位置越过空格和 ">"
      let initial = state.sCount[nextLine] + 1
      let spaceAfterMarker   // 标记符后是否有空格
      let adjustTab          // 是否需要调整制表符

      // 跳过 '>' 后的一个可选空格
      if (state.src.charCodeAt(pos) === 0x20 /* space */) {
        // ' >   test '
        //     ^ -- 行开始位置在这里：
        pos++
        initial++
        adjustTab = false
        spaceAfterMarker = true
      } else if (state.src.charCodeAt(pos) === 0x09 /* tab */) {
        spaceAfterMarker = true

        if ((state.bsCount[nextLine] + initial) % 4 === 3) {
          // '  >\t  test '
          //       ^ -- 行开始位置在这里（制表符宽度===1）
          pos++
          initial++
          adjustTab = false
        } else {
          // ' >\t  test '
          //    ^ -- 行开始位置在这里 + 稍微偏移 bsCount
          //         使额外空格出现
          adjustTab = true
        }
      } else {
        spaceAfterMarker = false
      }

      let offset = initial
      // 保存原始行标记并更新当前行标记
      oldBMarks.push(state.bMarks[nextLine])
      state.bMarks[nextLine] = pos

      // 计算缩进偏移
      while (pos < max) {
        const ch = state.src.charCodeAt(pos)

        if (isSpace(ch)) {
          if (ch === 0x09) {
            offset += 4 - (offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4
          } else {
            offset++
          }
        } else {
          break
        }

        pos++
      }

      // 检查这一行是否为空
      lastLineEmpty = pos >= max

      // 保存并更新状态
      oldBSCount.push(state.bsCount[nextLine])
      state.bsCount[nextLine] = state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0)

      oldSCount.push(state.sCount[nextLine])
      state.sCount[nextLine] = offset - initial

      oldTShift.push(state.tShift[nextLine])
      state.tShift[nextLine] = pos - state.bMarks[nextLine]
      continue
    }

    // 情况2：行不在块引用内，且上一行为空
    if (lastLineEmpty) { break }

    // 情况3：找到其他标签
    let terminate = false
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true
        break
      }
    }

    if (terminate) {
      // 特殊处理：强制对段落实行“硬终止模式”；
      // 通常如果调用 `tokenize(state, startLine, nextLine)`，
      // 段落会在 nextLine 之后查找段落的继续，
      // 但如果块引用被其他标签终止，它们就不应该这样做
      state.lineMax = nextLine

      if (state.blkIndent !== 0) {
        // state.blkIndent 非零，现在将其设为零，
        // 所以需要重新计算所有偏移以使其看起来像
        // 缩进没有改变
        oldBMarks.push(state.bMarks[nextLine])
        oldBSCount.push(state.bsCount[nextLine])
        oldTShift.push(state.tShift[nextLine])
        oldSCount.push(state.sCount[nextLine])
        state.sCount[nextLine] -= state.blkIndent
      }

      break
    }

    // 保存状态以便后续恢复
    oldBMarks.push(state.bMarks[nextLine])
    oldBSCount.push(state.bsCount[nextLine])
    oldTShift.push(state.tShift[nextLine])
    oldSCount.push(state.sCount[nextLine])

    // 负缩进意味着这是段落的继续
    //
    state.sCount[nextLine] = -1
  }

  const oldIndent = state.blkIndent
  state.blkIndent = 0

  // 创建块引用开始 token
  const token_o  = state.push('blockquote_open', 'blockquote', 1)
  token_o.markup = '>'
  const lines = [startLine, 0]
  token_o.map    = lines

  // 递归解析块引用内部内容
  state.md.block.tokenize(state, startLine, nextLine)

  // 创建块引用结束 token
  const token_c  = state.push('blockquote_close', 'blockquote', -1)
  token_c.markup = '>'

  // 恢复状态
  state.lineMax = oldLineMax
  state.parentType = oldParentType
  lines[1] = state.line

  // 恢复原始 tShift；这可能不是必需的，因为解析器
  // 已经在这里了，但为了确保我们可以这样做。
  for (let i = 0; i < oldTShift.length; i++) {
    state.bMarks[i + startLine] = oldBMarks[i]
    state.tShift[i + startLine] = oldTShift[i]
    state.sCount[i + startLine] = oldSCount[i]
    state.bsCount[i + startLine] = oldBSCount[i]
  }
  state.blkIndent = oldIndent

  return true
}
