/**
 * 智能引号转换规则
 * 
 * 将直引号转换为排版引号（弯引号）
 */

import { isWhiteSpace, isPunctChar, isMdAsciiPunct } from '../common/utils.mjs'

// 匹配引号的正则表达式
const QUOTE_TEST_RE = /['"]/
const QUOTE_RE = /['"]/g
const APOSTROPHE = '\u2019' /* 省略号字符 ' */

/**
 * 在指定位置替换字符
 * 
 * @param {string} str - 原字符串
 * @param {number} index - 要替换的位置索引
 * @param {string} ch - 新字符
 * @returns {string} 替换后的字符串
 */
function replaceAt (str, index, ch) {
  return str.slice(0, index) + ch + str.slice(index + 1)
}

/**
 * 处理内联 token 中的引号转换
 * 
 * @param {Array} tokens - 内联 token 数组
 * @param {Object} state - 解析状态对象
 */
function process_inlines (tokens, state) {
  let j

  // 用于匹配开始和结束引号的栈
  const stack = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    const thisLevel = tokens[i].level

    // 清理栈中层级更高的项目
    for (j = stack.length - 1; j >= 0; j--) {
      if (stack[j].level <= thisLevel) { break }
    }
    stack.length = j + 1

    // 只处理文本 token
    if (token.type !== 'text') { continue }

    let text = token.content
    let pos = 0
    let max = text.length

    /* eslint no-labels:0,block-scoped-var:0 */
    OUTER:
    while (pos < max) {
      QUOTE_RE.lastIndex = pos
      const t = QUOTE_RE.exec(text)
      if (!t) { break }

      let canOpen = true   // 是否可以作为开始引号
      let canClose = true  // 是否可以作为结束引号
      pos = t.index + 1
      const isSingle = (t[0] === "'")  // 是否为单引号

      // 查找前一个字符，
      // 如果是行首则默认为空格
      let lastChar = 0x20

      if (t.index - 1 >= 0) {
        lastChar = text.charCodeAt(t.index - 1)
      } else {
        // 查找前面的 token 中的最后一个字符
        for (j = i - 1; j >= 0; j--) {
          if (tokens[j].type === 'softbreak' || tokens[j].type === 'hardbreak') break // lastChar 默认为 0x20
          if (!tokens[j].content) continue // 应该跳过除 'text', 'html_inline' 或 'code_inline' 之外的所有 token

          lastChar = tokens[j].content.charCodeAt(tokens[j].content.length - 1)
          break
        }
      }

      // 查找下一个字符，
      // 如果是行尾则默认为空格
      let nextChar = 0x20

      if (pos < max) {
        nextChar = text.charCodeAt(pos)
      } else {
        // 查找后面的 token 中的第一个字符
        for (j = i + 1; j < tokens.length; j++) {
          if (tokens[j].type === 'softbreak' || tokens[j].type === 'hardbreak') break // nextChar 默认为 0x20
          if (!tokens[j].content) continue // 应该跳过除 'text', 'html_inline' 或 'code_inline' 之外的所有 token

          nextChar = tokens[j].content.charCodeAt(0)
          break
        }
      }

      // 判断前后字符的类型
      const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar))
      const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar))

      const isLastWhiteSpace = isWhiteSpace(lastChar)
      const isNextWhiteSpace = isWhiteSpace(nextChar)

      // 确定是否可以作为开始引号
      if (isNextWhiteSpace) {
        canOpen = false
      } else if (isNextPunctChar) {
        if (!(isLastWhiteSpace || isLastPunctChar)) {
          canOpen = false
        }
      }

      // 确定是否可以作为结束引号
      if (isLastWhiteSpace) {
        canClose = false
      } else if (isLastPunctChar) {
        if (!(isNextWhiteSpace || isNextPunctChar)) {
          canClose = false
        }
      }

      // 特殊情况：处理英寸符号
      if (nextChar === 0x22 /* " */ && t[0] === '"') {
        if (lastChar >= 0x30 /* 0 */ && lastChar <= 0x39 /* 9 */) {
          // 特殊情况：1"" - 将第一个引号当作英寸符号
          canClose = canOpen = false
        }
      }

      if (canOpen && canClose) {
        // 在标点符号序列中间替换引号，但不在单词中间，即：
        //
        // 1. foo " bar " baz - 不替换
        // 2. foo-"-bar-"-baz - 替换
        // 3. foo"bar"baz     - 不替换
        canOpen = isLastPunctChar
        canClose = isNextPunctChar
      }

      if (!canOpen && !canClose) {
        // 在单词中间，处理省略号
        if (isSingle) {
          token.content = replaceAt(token.content, t.index, APOSTROPHE)
        }
        continue
      }

      if (canClose) {
        // 这可能是一个结束引号，回退栈以获得匹配
        for (j = stack.length - 1; j >= 0; j--) {
          let item = stack[j]
          if (stack[j].level < thisLevel) { break }
          if (item.single === isSingle && stack[j].level === thisLevel) {
            item = stack[j]

            let openQuote
            let closeQuote
            // 根据引号类型选择相应的开始和结束引号
            if (isSingle) {
              openQuote = state.md.options.quotes[2]   // 单引号开始
              closeQuote = state.md.options.quotes[3]  // 单引号结束
            } else {
              openQuote = state.md.options.quotes[0]   // 双引号开始
              closeQuote = state.md.options.quotes[1]  // 双引号结束
            }

            // 先替换 token.content，再替换 tokens[item.token].content，
            // 因为如果它们指向同一个 token，当引号长度 != 1 时，
            // replaceAt 可能会搞乱索引
            token.content = replaceAt(token.content, t.index, closeQuote)
            tokens[item.token].content = replaceAt(
              tokens[item.token].content, item.pos, openQuote)

            pos += closeQuote.length - 1
            if (item.token === i) { pos += openQuote.length - 1 }

            text = token.content
            max = text.length

            stack.length = j
            continue OUTER
          }
        }
      }

      if (canOpen) {
        // 将开始引号推入栈中
        stack.push({
          token: i,
          pos: t.index,
          single: isSingle,
          level: thisLevel
        })
      } else if (canClose && isSingle) {
        // 单独的单引号，转换为省略号
        token.content = replaceAt(token.content, t.index, APOSTROPHE)
      }
    }
  }
}

/**
 * 智能引号转换主函数
 * 
 * 将直引号转换为排版引号（弯引号）
 * 
 * @param {Object} state - 解析状态对象
 */
export default function smartquotes (state) {
  /* eslint max-depth:0 */
  // 如果未启用排版选项，直接返回
  if (!state.md.options.typographer) { return }

  // 从后往前遍历所有 token
  for (let blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    // 只处理包含引号的内联 token
    if (state.tokens[blkIdx].type !== 'inline' ||
        !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) {
      continue
    }

    // 处理该 token 的子节点
    process_inlines(state.tokens[blkIdx].children, state)
  }
}
