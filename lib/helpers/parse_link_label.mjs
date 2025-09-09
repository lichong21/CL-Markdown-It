/**
 * 解析链接标签
 * 
 * 解析 Markdown 链接中的标签部分，例如 [这是链接文本] 中的 "这是链接文本"
 * 
 * 注意事项：
 * - 此函数假设第一个字符 "[" 已经匹配
 * - 支持嵌套的方括号，如 [外层[内层]文本]
 * - 正确处理转义字符和内联元素
 * 
 * @param {Object} state - 解析器状态对象，包含源文本和位置信息
 * @param {number} start - 开始解析的位置（"[" 的位置）
 * @param {boolean} disableNested - 是否禁用嵌套标签解析
 * @returns {number} 标签结束位置，如果解析失败返回 -1
 */
export default function parseLinkLabel (state, start, disableNested) {
  let level, found, marker, prevPos

  // 获取文本最大长度和当前位置
  const max = state.posMax
  const oldPos = state.pos

  // 从 "[" 后一位开始解析
  state.pos = start + 1
  level = 1  // 嵌套层级，从1开始（因为已经遇到了开始的 "["）

  // 遍历字符直到找到匹配的 "]" 或到达文本末尾
  while (state.pos < max) {
    marker = state.src.charCodeAt(state.pos)
    
    // 遇到 "]" 时减少嵌套层级
    if (marker === 0x5D /* ] */) {
      level--
      if (level === 0) {
        // 找到匹配的结束标记
        found = true
        break
      }
    }

    // 记录当前位置，然后跳过token
    prevPos = state.pos
    state.md.inline.skipToken(state)
    
    // 处理嵌套的 "["
    if (marker === 0x5B /* [ */) {
      if (prevPos === state.pos - 1) {
        // 如果找到的 "[" 不是任何token的一部分，增加嵌套层级
        level++
      } else if (disableNested) {
        // 如果禁用嵌套且遇到嵌套情况，恢复位置并返回失败
        state.pos = oldPos
        return -1
      }
    }
  }

  let labelEnd = -1

  // 如果找到了匹配的结束标记，记录结束位置
  if (found) {
    labelEnd = state.pos
  }

  // 恢复原始状态位置
  state.pos = oldPos

  return labelEnd
}
