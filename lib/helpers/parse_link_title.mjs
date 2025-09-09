/**
 * 解析链接标题
 * 
 * 解析 Markdown 链接中的标题部分，支持以下格式：
 * - "标题" (双引号)
 * - '标题' (单引号) 
 * - (标题) (圆括号)
 * 
 * 功能特点：
 * - 支持跨行解析（在引用链接中）
 * - 正确处理转义字符
 * - 支持继续之前的解析状态
 */

import { unescapeAll } from '../common/utils.mjs'

/**
 * 在指定范围内解析链接标题
 * 
 * @param {string} str - 要解析的字符串
 * @param {number} start - 开始位置
 * @param {number} max - 结束位置
 * @param {Object} prev_state - 前一次解析的状态（可选，用于跨行解析）
 * @returns {Object} 解析结果，包含：
 *   - ok: 是否解析成功
 *   - can_continue: 是否可以在下一行继续
 *   - pos: 结束位置
 *   - str: 解析出的标题文本
 *   - marker: 期望的结束标记字符码
 */
export default function parseLinkTitle (str, start, max, prev_state) {
  let code
  let pos = start

  // 解析状态对象
  const state = {
    // 如果为 true，表示这是一个有效的链接标题
    ok: false,
    // 如果为 true，表示这个链接可以在下一行继续解析
    can_continue: false,
    // 如果解析成功，这是结束标记后第一个字符的位置
    pos: 0,
    // 如果解析成功，这是未转义的标题文本
    str: '',
    // 期望的结束标记字符码
    marker: 0
  }

  if (prev_state) {
    // 这是在下一行继续之前的 parseLinkTitle 调用的延续
    // 仅在引用链接中使用
    state.str = prev_state.str
    state.marker = prev_state.marker
  } else {
    // 如果已经到达字符串末尾，返回初始状态
    if (pos >= max) { return state }

    // 检查开始标记是否为有效的引号或括号
    let marker = str.charCodeAt(pos)
    if (marker !== 0x22 /* " */ && marker !== 0x27 /* ' */ && marker !== 0x28 /* ( */) { 
      return state 
    }

    // 跳过开始标记
    start++
    pos++

    // 如果开始标记是 "("，将其转换为结束标记 ")"
    if (marker === 0x28) { marker = 0x29 }

    state.marker = marker
  }

  // 遍历字符串直到找到结束标记或到达末尾
  while (pos < max) {
    code = str.charCodeAt(pos)
    
    // 找到匹配的结束标记
    if (code === state.marker) {
      state.pos = pos + 1
      state.str += unescapeAll(str.slice(start, pos))
      state.ok = true
      return state
    } else if (code === 0x28 /* ( */ && state.marker === 0x29 /* ) */) {
      // 在括号标题中遇到了嵌套的开括号，这是无效的
      return state
    } else if (code === 0x5C /* \ */ && pos + 1 < max) {
      // 遇到转义字符，跳过下一个字符
      pos++
    }

    pos++
  }

  // 没有找到结束标记，但这个链接标题可能在下一行继续（用于引用链接）
  state.can_continue = true
  state.str += unescapeAll(str.slice(start, pos))
  return state
}
