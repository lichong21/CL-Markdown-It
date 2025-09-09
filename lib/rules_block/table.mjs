// GFM 表格处理器，参考：https://github.github.com/gfm/#tables-extension-
// 用于识别和解析 GitHub Flavored Markdown 中的表格语法

import { isSpace } from '../common/utils.mjs'

// 限制表格中空的自动完成单元格的数量，
// 参考 https://github.com/markdown-it/markdown-it/issues/1000，
//
// pulldown-cmark 和 commonmark-hs 都以这种方式将单元格数量限制在 ~200k。
// 我们将其设置为 65k，可以将用户输入扩展 x370 倍
// （256x256 的正方形从 1.8kB 扩展到 650kB）。
const MAX_AUTOCOMPLETED_CELLS = 0x10000

// 获取指定行的内容
function getLine (state, line) {
  const pos = state.bMarks[line] + state.tShift[line]
  const max = state.eMarks[line]

  return state.src.slice(pos, max)
}

// 分割字符串，处理转义的管道符
function escapedSplit (str) {
  const result = []
  const max = str.length

  let pos = 0
  let ch = str.charCodeAt(pos)
  let isEscaped = false  // 是否被转义
  let lastPos = 0
  let current = ''

  while (pos < max) {
    if (ch === 0x7c/* | */) {
      if (!isEscaped) {
        // 分隔单元格的管道符 '|'
        result.push(current + str.substring(lastPos, pos))
        current = ''
        lastPos = pos + 1
      } else {
        // 转义的管道符 '\|'
        current += str.substring(lastPos, pos - 1)
        lastPos = pos
      }
    }

    isEscaped = (ch === 0x5c/* \ */)
    pos++

    ch = str.charCodeAt(pos)
  }

  result.push(current + str.substring(lastPos))

  return result
}

export default function table (state, startLine, endLine, silent) {
  // 表格至少应该有2行（表头 + 分隔符）
  if (startLine + 2 > endLine) { return false }

  let nextLine = startLine + 1

  if (state.sCount[nextLine] < state.blkIndent) { return false }

  // 如果缩进超过3个空格，应该作为代码块处理
  if (state.sCount[nextLine] - state.blkIndent >= 4) { return false }

  // 第二行的第一个字符应该是 '|'、'-'、':'，
  // 除了空格之外不允许其他字符；
  // 基本上，这等价于 /^[-:|][-:|\s]*$/ 正则表达式

  let pos = state.bMarks[nextLine] + state.tShift[nextLine]
  if (pos >= state.eMarks[nextLine]) { return false }

  const firstCh = state.src.charCodeAt(pos++)
  if (firstCh !== 0x7C/* | */ && firstCh !== 0x2D/* - */ && firstCh !== 0x3A/* : */) { return false }

  if (pos >= state.eMarks[nextLine]) { return false }

  const secondCh = state.src.charCodeAt(pos++)
  if (secondCh !== 0x7C/* | */ && secondCh !== 0x2D/* - */ && secondCh !== 0x3A/* : */ && !isSpace(secondCh)) {
    return false
  }

  // 如果第一个字符是 '-'，那么第二个字符不能是空格
  // （由于与列表的解析歧义）
  if (firstCh === 0x2D/* - */ && isSpace(secondCh)) { return false }

  // 检查剩余字符是否合法
  while (pos < state.eMarks[nextLine]) {
    const ch = state.src.charCodeAt(pos)

    if (ch !== 0x7C/* | */ && ch !== 0x2D/* - */ && ch !== 0x3A/* : */ && !isSpace(ch)) { return false }

    pos++
  }

  // 解析分隔符行和列对齐方式
  let lineText = getLine(state, startLine + 1)
  let columns = lineText.split('|')
  const aligns = []
  for (let i = 0; i < columns.length; i++) {
    const t = columns[i].trim()
    if (!t) {
      // 允许表格前后有空列，但不允许在列之间有空列；
      // 例如允许 ` |---| `，不允许 ` ---||--- `
      if (i === 0 || i === columns.length - 1) {
        continue
      } else {
        return false
      }
    }

    // 检查对齐格式
    if (!/^:?-+:?$/.test(t)) { return false }
    if (t.charCodeAt(t.length - 1) === 0x3A/* : */) {
      aligns.push(t.charCodeAt(0) === 0x3A/* : */ ? 'center' : 'right')
    } else if (t.charCodeAt(0) === 0x3A/* : */) {
      aligns.push('left')
    } else {
      aligns.push('')  // 默认对齐
    }
  }

  // 解析表头行
  lineText = getLine(state, startLine).trim()
  if (lineText.indexOf('|') === -1) { return false }  // 必须包含管道符
  if (state.sCount[startLine] - state.blkIndent >= 4) { return false }
  columns = escapedSplit(lineText)
  if (columns.length && columns[0] === '') columns.shift()      // 移除第一个空列
  if (columns.length && columns[columns.length - 1] === '') columns.pop()  // 移除最后一个空列

  // 表头行将定义整个表格的列数，
  // 对齐行应该完全相同（其余行可以不同）
  const columnCount = columns.length
  if (columnCount === 0 || columnCount !== aligns.length) { return false }

  // 静默模式：已确认是有效的表格
  if (silent) { return true }

  const oldParentType = state.parentType
  state.parentType = 'table'

  // 使用 'blockquote' 的终止规则，因为它与表格最相似
  const terminatorRules = state.md.block.ruler.getRules('blockquote')

  // 创建表格 tokens
  const token_to = state.push('table_open', 'table', 1)
  const tableLines = [startLine, 0]
  token_to.map = tableLines

  // 创建表头
  const token_tho = state.push('thead_open', 'thead', 1)
  token_tho.map = [startLine, startLine + 1]

  const token_htro = state.push('tr_open', 'tr', 1)
  token_htro.map = [startLine, startLine + 1]

  // 创建表头单元格
  for (let i = 0; i < columns.length; i++) {
    const token_ho = state.push('th_open', 'th', 1)
    if (aligns[i]) {
      token_ho.attrs  = [['style', 'text-align:' + aligns[i]]]  // 设置对齐方式
    }

    const token_il = state.push('inline', '', 0)
    token_il.content  = columns[i].trim()  // 单元格内容
    token_il.children = []

    state.push('th_close', 'th', -1)
  }

  state.push('tr_close', 'tr', -1)
  state.push('thead_close', 'thead', -1)

  let tbodyLines
  let autocompletedCells = 0  // 记录自动完成的单元格数量

  // 处理表格数据行
  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) { break }

    // 检查是否被其他规则终止
    let terminate = false
    for (let i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true
        break
      }
    }

    if (terminate) { break }
    lineText = getLine(state, nextLine).trim()
    if (!lineText) { break }  // 空行终止表格
    if (state.sCount[nextLine] - state.blkIndent >= 4) { break }  // 缩进过多
    columns = escapedSplit(lineText)
    if (columns.length && columns[0] === '') columns.shift()
    if (columns.length && columns[columns.length - 1] === '') columns.pop()

    // 注意：如果用户指定的列数超过表头，自动完成计数可能为负数，
    // 但这不影响预期用途（限制扩展）
    autocompletedCells += columnCount - columns.length
    if (autocompletedCells > MAX_AUTOCOMPLETED_CELLS) { break }

    // 第一次创建 tbody
    if (nextLine === startLine + 2) {
      const token_tbo = state.push('tbody_open', 'tbody', 1)
      token_tbo.map = tbodyLines = [startLine + 2, 0]
    }

    // 创建表格行
    const token_tro = state.push('tr_open', 'tr', 1)
    token_tro.map = [nextLine, nextLine + 1]

    // 创建表格数据单元格
    for (let i = 0; i < columnCount; i++) {
      const token_tdo = state.push('td_open', 'td', 1)
      if (aligns[i]) {
        token_tdo.attrs  = [['style', 'text-align:' + aligns[i]]]  // 应用对齐方式
      }

      const token_il = state.push('inline', '', 0)
      token_il.content  = columns[i] ? columns[i].trim() : ''  // 单元格内容，空的设为空字符串
      token_il.children = []

      state.push('td_close', 'td', -1)
    }
    state.push('tr_close', 'tr', -1)
  }

  // 完成表格的创建
  if (tbodyLines) {
    state.push('tbody_close', 'tbody', -1)
    tbodyLines[1] = nextLine
  }

  state.push('table_close', 'table', -1)
  tableLines[1] = nextLine

  // 恢复状态
  state.parentType = oldParentType
  state.line = nextLine
  return true
}
