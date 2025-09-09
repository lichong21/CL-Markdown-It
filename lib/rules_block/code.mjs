// 代码块处理器（4个空格缩进）
// 用于识别和解析以4个空格缩进开始的代码块

export default function code (state, startLine, endLine/*, silent */) {
  // 检查缩进是否达到4个空格的要求
  // 如果缩进少于4个空格，不认为是代码块
  if (state.sCount[startLine] - state.blkIndent < 4) { return false }

  let nextLine = startLine + 1
  let last = nextLine

  // 遍历后续行，查找代码块的结束位置
  while (nextLine < endLine) {
    // 空行继续处理，代码块可以包含空行
    if (state.isEmpty(nextLine)) {
      nextLine++
      continue
    }

    // 如果当前行缩进仍然大于等于4个空格，继续作为代码块处理
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      nextLine++
      last = nextLine
      continue
    }
    // 缩进不足4个空格，结束代码块
    break
  }

  // 更新解析器的当前行位置
  state.line = last

  // 创建代码块 token
  const token   = state.push('code_block', 'code', 0)
  // 获取代码块内容，移除4个空格的缩进
  token.content = state.getLines(startLine, last, 4 + state.blkIndent, false) + '\n'
  // 记录 token 在源码中的行范围
  token.map     = [startLine, state.line]

  return true
}
