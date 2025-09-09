/**
 * 处理转义字符和硬换行的内联规则
 * 
 * 这个模块负责处理：
 * 1. 转义字符：\* \[ \] 等，将特殊字符转义为普通字符
 * 2. 硬换行：行尾的 \ 后跟换行符，创建 <br> 标签
 * 
 * 支持的转义字符包括 Markdown 的所有标点符号
 * 
 * @module escape
 */

import { isSpace } from '../common/utils.mjs'

/**
 * 可以被转义的字符查找表
 * 包含所有 Markdown 特殊标点符号
 */
const ESCAPED = []

// 初始化查找表
for (let i = 0; i < 256; i++) { ESCAPED.push(0) }

// 标记所有可转义的字符
'\\!"#$%&\'()*+,./:;<=>?@[]^_`{|}~-'
  .split('').forEach(function (ch) { ESCAPED[ch.charCodeAt(0)] = 1 })

/**
 * 转义字符解析器主函数
 * 
 * @param {StateInline} state - 内联解析状态对象
 * @param {boolean} silent - 是否为静默模式（仅检查不生成 token）
 * @returns {boolean} 是否成功解析转义字符
 */
export default function escape (state, silent) {
  let pos = state.pos
  const max = state.posMax

  // 必须以反斜杠开始
  if (state.src.charCodeAt(pos) !== 0x5C/* \ */) return false
  pos++

  // 反斜杠在行尾的情况
  if (pos >= max) return false

  let ch1 = state.src.charCodeAt(pos)

  if (ch1 === 0x0A) {
    // 反斜杠 + 换行符 = 硬换行
    if (!silent) {
      state.push('hardbreak', 'br', 0)
    }

    pos++
    // 跳过下一行开头的空白字符
    while (pos < max) {
      ch1 = state.src.charCodeAt(pos)
      if (!isSpace(ch1)) break
      pos++
    }

    state.pos = pos
    return true
  }

  let escapedStr = state.src[pos]

  // 处理 Unicode 代理对（surrogate pairs）
  if (ch1 >= 0xD800 && ch1 <= 0xDBFF && pos + 1 < max) {
    const ch2 = state.src.charCodeAt(pos + 1)

    if (ch2 >= 0xDC00 && ch2 <= 0xDFFF) {
      escapedStr += state.src[pos + 1]
      pos++
    }
  }

  const origStr = '\\' + escapedStr

  if (!silent) {
    const token = state.push('text_special', '', 0)

    // 检查是否为可转义字符
    if (ch1 < 256 && ESCAPED[ch1] !== 0) {
      token.content = escapedStr  // 转义成功，只保留字符本身
    } else {
      token.content = origStr     // 不是可转义字符，保留原样
    }

    token.markup = origStr
    token.info   = 'escape'
  }

  state.pos = pos + 1
  return true
}
