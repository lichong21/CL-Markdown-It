/**
 * 链接自动识别规则
 * 
 * 将类似链接的文本替换为链接节点。
 * 目前受 `md.validateLink()` 限制，仅支持 http/https/ftp 协议
 */

import { arrayReplaceAt } from '../common/utils.mjs'

/**
 * 检查字符串是否为链接开始标签
 * @param {string} str - 要检查的字符串
 * @returns {boolean} 是否为链接开始标签
 */
function isLinkOpen (str) {
  return /^<a[>\s]/i.test(str)
}

/**
 * 检查字符串是否为链接结束标签
 * @param {string} str - 要检查的字符串
 * @returns {boolean} 是否为链接结束标签
 */
function isLinkClose (str) {
  return /^<\/a\s*>/i.test(str)
}

/**
 * 链接自动识别主函数
 * 
 * 扫描文本内容，识别类似链接的文本并将其转换为链接节点
 * 
 * @param {Object} state - 解析状态对象
 */
export default function linkify (state) {
  const blockTokens = state.tokens

  // 如果未启用链接自动识别功能，直接返回
  if (!state.md.options.linkify) { return }

  for (let j = 0, l = blockTokens.length; j < l; j++) {
    // 只处理内联 token，且需要通过预检测
    if (blockTokens[j].type !== 'inline' ||
        !state.md.linkify.pretest(blockTokens[j].content)) {
      continue
    }

    let tokens = blockTokens[j].children

    let htmlLinkLevel = 0

    // 从后往前扫描，这样在添加新标签时能保持位置
    // 在链接开始/结束匹配中使用反向逻辑
    for (let i = tokens.length - 1; i >= 0; i--) {
      const currentToken = tokens[i]

      // 跳过 markdown 链接的内容
      if (currentToken.type === 'link_close') {
        i--
        while (tokens[i].level !== currentToken.level && tokens[i].type !== 'link_open') {
          i--
        }
        continue
      }

      // 跳过 HTML 标签链接的内容
      if (currentToken.type === 'html_inline') {
        if (isLinkOpen(currentToken.content) && htmlLinkLevel > 0) {
          htmlLinkLevel--
        }
        if (isLinkClose(currentToken.content)) {
          htmlLinkLevel++
        }
      }
      if (htmlLinkLevel > 0) { continue }

      // 处理文本 token 中的链接
      if (currentToken.type === 'text' && state.md.linkify.test(currentToken.content)) {
        const text = currentToken.content
        let links = state.md.linkify.match(text)

        // 将字符串分割为节点
        const nodes = []
        let level = currentToken.level
        let lastPos = 0

        // 禁止字符串开头的转义序列，
        // 这避免了 http\://example.com/ 被链接化为
        // http:<a href="//example.com/">//example.com/</a>
        if (links.length > 0 &&
            links[0].index === 0 &&
            i > 0 &&
            tokens[i - 1].type === 'text_special') {
          links = links.slice(1)
        }

        // 处理每个识别到的链接
        for (let ln = 0; ln < links.length; ln++) {
          const url = links[ln].url
          const fullUrl = state.md.normalizeLink(url)
          if (!state.md.validateLink(fullUrl)) { continue }

          let urlText = links[ln].text

          // 链接识别器可能发送像 "example.com" 这样的原始主机名，
          // URL 以域名开始。在这些情况下，我们前置 http://，
          // 然后再移除它。
          if (!links[ln].schema) {
            urlText = state.md.normalizeLinkText('http://' + urlText).replace(/^http:\/\//, '')
          } else if (links[ln].schema === 'mailto:' && !/^mailto:/i.test(urlText)) {
            urlText = state.md.normalizeLinkText('mailto:' + urlText).replace(/^mailto:/, '')
          } else {
            urlText = state.md.normalizeLinkText(urlText)
          }

          const pos = links[ln].index

          // 添加链接前的文本
          if (pos > lastPos) {
            const token   = new state.Token('text', '', 0)
            token.content = text.slice(lastPos, pos)
            token.level   = level
            nodes.push(token)
          }

          // 创建链接开始 token
          const token_o   = new state.Token('link_open', 'a', 1)
          token_o.attrs   = [['href', fullUrl]]
          token_o.level   = level++
          token_o.markup  = 'linkify'
          token_o.info    = 'auto'
          nodes.push(token_o)

          // 创建链接文本 token
          const token_t   = new state.Token('text', '', 0)
          token_t.content = urlText
          token_t.level   = level
          nodes.push(token_t)

          // 创建链接结束 token
          const token_c   = new state.Token('link_close', 'a', -1)
          token_c.level   = --level
          token_c.markup  = 'linkify'
          token_c.info    = 'auto'
          nodes.push(token_c)

          lastPos = links[ln].lastIndex
        }
        
        // 添加链接后的剩余文本
        if (lastPos < text.length) {
          const token   = new state.Token('text', '', 0)
          token.content = text.slice(lastPos)
          token.level   = level
          nodes.push(token)
        }

        // 替换当前节点
        blockTokens[j].children = tokens = arrayReplaceAt(tokens, i, nodes)
      }
    }
  }
}
