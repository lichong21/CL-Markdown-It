/**
 * 解析反引号（代码标记）的内联规则
 * 
 * 这个模块负责处理内联代码块，如 `code` 或 ``code with ` backtick``
 * 
 * 特点：
 * - 支持多个反引号作为分隔符
 * - 开始和结束的反引号数量必须匹配
 * - 使用缓存优化性能，避免重复扫描
 * 
 * @module backticks
 */

/**
 * 反引号解析器主函数
 * 
 * @param {StateInline} state - 内联解析状态对象
 * @param {boolean} silent - 是否为静默模式（仅检查不生成 token）
 * @returns {boolean} 是否成功解析反引号代码块
 */
export default function backtick (state, silent) {
  let pos = state.pos
  const ch = state.src.charCodeAt(pos)

  // 必须以反引号开始
  if (ch !== 0x60/* ` */) { return false }

  const start = pos
  pos++
  const max = state.posMax

  // 扫描开始标记的长度（连续的反引号数量）
  while (pos < max && state.src.charCodeAt(pos) === 0x60/* ` */) { pos++ }

  const marker = state.src.slice(start, pos)
  const openerLength = marker.length

  // 检查缓存：如果已经扫描过，且这个长度的反引号在当前位置之前没有匹配的闭合符
  if (state.backticksScanned && (state.backticks[openerLength] || 0) <= start) {
    if (!silent) state.pending += marker
    state.pos += openerLength
    return true
  }

  let matchEnd = pos
  let matchStart

  // 缓存中没有找到，需要扫描到行尾（或直到找到匹配的标记）
  while ((matchStart = state.src.indexOf('`', matchEnd)) !== -1) {
    matchEnd = matchStart + 1

    // 扫描结束标记的长度
    while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60/* ` */) { matchEnd++ }

    const closerLength = matchEnd - matchStart

    if (closerLength === openerLength) {
      // 找到了匹配长度的闭合标记
      if (!silent) {
        const token = state.push('code_inline', 'code', 0)
        token.markup = marker
        token.content = state.src.slice(pos, matchStart)
          .replace(/\n/g, ' ')         // 将换行符替换为空格
          .replace(/^ (.+) $/, '$1')   // 去除首尾单个空格（如果存在）
      }
      state.pos = matchEnd
      return true
    }

    // 找到了不同长度的标记，将其放入缓存作为寻找闭合符的上限
    state.backticks[closerLength] = matchStart
  }

  // 扫描到行尾仍未找到匹配的闭合标记
  state.backticksScanned = true

  if (!silent) state.pending += marker
  state.pos += openerLength
  return true
}
