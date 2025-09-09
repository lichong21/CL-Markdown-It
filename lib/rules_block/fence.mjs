// 围栏代码块处理器（``` lang, ~~~ lang）
// 用于识别和解析以 ``` 或 ~~~ 包围的代码块

export default function fence (state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine]
  let max = state.eMarks[startLine]

  // 如果缩进超过3个空格，应该作为代码块处理
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }

  // 行长度至少需要3个字符才能形成围栏
  if (pos + 3 > max) { return false }

  const marker = state.src.charCodeAt(pos)

  // 围栏标记符只能是 ~ 或 `
  if (marker !== 0x7E/* ~ */ && marker !== 0x60 /* ` */) {
    return false
  }

  // 扫描标记符长度
  let mem = pos
  pos = state.skipChars(pos, marker)

  let len = pos - mem

  // 围栏标记符至少需要3个
  if (len < 3) { return false }

  const markup = state.src.slice(mem, pos)  // 围栏标记符序列
  const params = state.src.slice(pos, max)  // 语言标识和其他参数

  // 如果是反引号围栏，参数中不能包含反引号
  if (marker === 0x60 /* ` */) {
    if (params.indexOf(String.fromCharCode(marker)) >= 0) {
      return false
    }
  }

  // 静默模式：已找到开始标记，可以报告成功
  if (silent) { return true }

  // 查找块的结束位置
  let nextLine = startLine
  let haveEndMarker = false

  for (;;) {
    nextLine++
    if (nextLine >= endLine) {
      // 未关闭的块应该在文档结束时自动关闭
      // 块也可能在父级结束时自动关闭
      break
    }

    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine]
    max = state.eMarks[nextLine]

    if (pos < max && state.sCount[nextLine] < state.blkIndent) {
      // 缩进不足的非空行应该停止围栏:
      // - ```
      //  test
      break
    }

    // 检查是否是结束标记符
    if (state.src.charCodeAt(pos) !== marker) { continue }

    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      // 结束围栏的缩进应该少于4个空格
      continue
    }

    pos = state.skipChars(pos, marker)

    // 结束围栏的长度必须至少与开始围栏一样长
    if (pos - mem < len) { continue }

    // 确保尾部只有空格
    pos = state.skipSpaces(pos)

    if (pos < max) { continue }

    haveEndMarker = true
    // 找到结束标记！
    break
  }

  // 如果围栏有前导空格，应该从其内部块中移除它们
  len = state.sCount[startLine]

  // 更新解析器的当前行位置
  state.line = nextLine + (haveEndMarker ? 1 : 0)

  // 创建围栏代码块 token
  const token   = state.push('fence', 'code', 0)
  token.info    = params  // 语言信息和其他参数
  token.content = state.getLines(startLine + 1, nextLine, len, true)  // 代码内容
  token.markup  = markup  // 围栏标记符
  token.map     = [startLine, state.line]  // 行范围映射

  return true
}
