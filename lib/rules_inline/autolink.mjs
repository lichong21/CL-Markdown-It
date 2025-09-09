/**
 * 处理自动链接 '<protocol:...>' 的内联规则
 * 
 * 这个模块负责识别和解析 HTML 式的自动链接，支持两种类型：
 * 1. 协议链接：<http://example.com>、<ftp://example.com>
 * 2. 电子邮件链接：<user@example.com>
 * 
 * @module autolink
 */

/* eslint max-len:0 */
/**
 * 电子邮件地址的正则表达式
 * 符合 RFC 5322 规范，用于验证邮件地址的有效性
 */
const EMAIL_RE    = /^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/

/* eslint-disable-next-line no-control-regex */
/**
 * 自动链接协议的正则表达式
 * 检查协议名称（如 http、https、ftp 等）和 URL 内容
 * 协议名：字母开头，后跟字母、数字、+、-、. 字符
 * URL 内容：不能包含 <、>、控制字符或空格
 */
const AUTOLINK_RE = /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/

/**
 * 自动链接解析器主函数
 * 
 * @param {StateInline} state - 内联解析状态对象
 * @param {boolean} silent - 是否为静默模式（仅检查不生成 token）
 * @returns {boolean} 是否成功解析自动链接
 */
export default function autolink (state, silent) {
  let pos = state.pos

  // 检查是否以 '<' 开始，不是则不是自动链接
  if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false }

  const start = state.pos
  const max = state.posMax

  // 寻找匹配的 '>' 字符，同时验证内容
  for (;;) {
    if (++pos >= max) return false // 到达行尾仍未找到 '>'

    const ch = state.src.charCodeAt(pos)

    if (ch === 0x3C /* < */) return false // 遇到嵌套的 '<'，无效
    if (ch === 0x3E /* > */) break // 找到结束的 '>'
  }

  // 提取 < 和 > 之间的内容作为 URL
  const url = state.src.slice(start + 1, pos)

  // 首先检查是否为协议链接（如 http://、https://、ftp:// 等）
  if (AUTOLINK_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(url)
    if (!state.md.validateLink(fullUrl)) { return false }

    if (!silent) {
      // 创建链接开始标签
      const token_o   = state.push('link_open', 'a', 1)
      token_o.attrs   = [['href', fullUrl]]
      token_o.markup  = 'autolink'
      token_o.info    = 'auto'

      // 创建链接文本内容
      const token_t   = state.push('text', '', 0)
      token_t.content = state.md.normalizeLinkText(url)

      // 创建链接结束标签
      const token_c   = state.push('link_close', 'a', -1)
      token_c.markup  = 'autolink'
      token_c.info    = 'auto'
    }

    // 更新位置（URL 长度 + '<' + '>'）
    state.pos += url.length + 2
    return true
  }

  // 如果不是协议链接，检查是否为邮件地址
  if (EMAIL_RE.test(url)) {
    const fullUrl = state.md.normalizeLink('mailto:' + url)
    if (!state.md.validateLink(fullUrl)) { return false }

    if (!silent) {
      // 创建邮件链接开始标签
      const token_o   = state.push('link_open', 'a', 1)
      token_o.attrs   = [['href', fullUrl]]
      token_o.markup  = 'autolink'
      token_o.info    = 'auto'

      // 创建邮件地址文本内容
      const token_t   = state.push('text', '', 0)
      token_t.content = state.md.normalizeLinkText(url)

      // 创建邮件链接结束标签
      const token_c   = state.push('link_close', 'a', -1)
      token_c.markup  = 'autolink'
      token_c.info    = 'auto'
    }

    // 更新位置（URL 长度 + '<' + '>'）
    state.pos += url.length + 2
    return true
  }

  // 既不是有效的协议链接也不是邮件地址
  return false
}
