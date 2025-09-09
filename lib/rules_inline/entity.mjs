/**
 * 处理 HTML 实体的内联规则
 * 
 * 这个模块负责解析和转换 HTML 实体，支持三种类型：
 * 1. 数字实体：&#123; (十进制)
 * 2. 十六进制实体：&#xAF; (十六进制)
 * 3. 命名实体：&quot;、&amp;、&lt; 等
 * 
 * 所有有效的实体都会被转换为对应的 Unicode 字符
 * 
 * @module entity
 */

import { decodeHTML } from 'entities'
import { isValidEntityCode, fromCodePoint } from '../common/utils.mjs'

/**
 * 数字实体的正则表达式
 * 匹配 &#123; (十进制) 或 &#xAF; (十六进制) 格式
 */
const DIGITAL_RE = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i

/**
 * 命名实体的正则表达式
 * 匹配如 &quot;、&amp; 等命名实体
 */
const NAMED_RE   = /^&([a-z][a-z0-9]{1,31});/i

/**
 * HTML 实体解析器主函数
 * 
 * @param {StateInline} state - 内联解析状态对象
 * @param {boolean} silent - 是否为静默模式（仅检查不生成 token）
 * @returns {boolean} 是否成功解析 HTML 实体
 */
export default function entity (state, silent) {
  const pos = state.pos
  const max = state.posMax

  // 必须以 '&' 开始
  if (state.src.charCodeAt(pos) !== 0x26/* & */) return false

  // 至少需要两个字符
  if (pos + 1 >= max) return false

  const ch = state.src.charCodeAt(pos + 1)

  if (ch === 0x23 /* # */) {
    // 处理数字实体：&#123; 或 &#xAF;
    const match = state.src.slice(pos).match(DIGITAL_RE)
    if (match) {
      if (!silent) {
        // 解析数字：十六进制或十进制
        const code = match[1][0].toLowerCase() === 'x' ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10)

        const token   = state.push('text_special', '', 0)
        token.content = isValidEntityCode(code) ? fromCodePoint(code) : fromCodePoint(0xFFFD)
        token.markup  = match[0]
        token.info    = 'entity'
      }
      state.pos += match[0].length
      return true
    }
  } else {
    // 处理命名实体：&quot;、&amp; 等
    const match = state.src.slice(pos).match(NAMED_RE)
    if (match) {
      const decoded = decodeHTML(match[0])
      if (decoded !== match[0]) { // 确实是有效的实体
        if (!silent) {
          const token   = state.push('text_special', '', 0)
          token.content = decoded
          token.markup  = match[0]
          token.info    = 'entity'
        }
        state.pos += match[0].length
        return true
      }
    }
  }

  return false
}
