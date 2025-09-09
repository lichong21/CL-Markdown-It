/**
 * 解析链接目标地址
 * 
 * 解析 Markdown 链接中的目标地址部分，支持以下格式：
 * - <https://example.com> (尖括号包围的URL)
 * - https://example.com (直接的URL)
 * - /path/to/file (相对路径)
 * 
 * 功能特点：
 * - 支持尖括号包围的URL（可以包含空格）
 * - 支持裸露的URL（不能包含空格）
 * - 正确处理转义字符
 * - 支持嵌套括号平衡检查
 */

import { unescapeAll } from '../common/utils.mjs'

/**
 * 在指定范围内解析链接目标地址
 * 
 * @param {string} str - 要解析的字符串
 * @param {number} start - 开始位置
 * @param {number} max - 结束位置
 * @returns {Object} 解析结果，包含：
 *   - ok: 是否解析成功
 *   - pos: 结束位置
 *   - str: 解析出的目标地址
 */
export default function parseLinkDestination (str, start, max) {
  let code
  let pos = start

  // 解析结果对象
  const result = {
    ok: false,   // 是否解析成功
    pos: 0,      // 结束位置
    str: ''      // 解析出的目标地址
  }

  // 处理尖括号包围的URL格式：<url>
  if (str.charCodeAt(pos) === 0x3C /* < */) {
    pos++  // 跳过开始的 '<'
    
    while (pos < max) {
      code = str.charCodeAt(pos)
      
      // 遇到换行符，无效的URL
      if (code === 0x0A /* \n */) { return result }
      
      // 遇到嵌套的 '<'，无效的URL
      if (code === 0x3C /* < */) { return result }
      
      // 找到结束的 '>'
      if (code === 0x3E /* > */) {
        result.pos = pos + 1
        result.str = unescapeAll(str.slice(start + 1, pos))
        result.ok = true
        return result
      }
      
      // 处理转义字符
      if (code === 0x5C /* \ */ && pos + 1 < max) {
        pos += 2
        continue
      }

      pos++
    }

    // 没有找到结束的 '>'
    return result
  }

  // 处理裸露的URL格式（不被尖括号包围）
  
  let level = 0  // 括号嵌套层级
  while (pos < max) {
    code = str.charCodeAt(pos)

    // 遇到空格，URL结束
    if (code === 0x20) { break }

    // 遇到ASCII控制字符，URL结束
    if (code < 0x20 || code === 0x7F) { break }

    // 处理转义字符
    if (code === 0x5C /* \ */ && pos + 1 < max) {
      // 如果转义的是空格，URL结束
      if (str.charCodeAt(pos + 1) === 0x20) { break }
      pos += 2
      continue
    }

    // 遇到开括号，增加嵌套层级
    if (code === 0x28 /* ( */) {
      level++
      // 防止过度嵌套（最多32层）
      if (level > 32) { return result }
    }

    // 遇到闭括号
    if (code === 0x29 /* ) */) {
      if (level === 0) { 
        // 如果没有对应的开括号，URL结束
        break 
      }
      level--
    }

    pos++
  }

  // 如果没有解析到任何字符，返回失败
  if (start === pos) { return result }
  
  // 如果括号不平衡，返回失败
  if (level !== 0) { return result }

  // 解析成功
  result.str = unescapeAll(str.slice(start, pos))
  result.pos = pos
  result.ok = true
  return result
}
