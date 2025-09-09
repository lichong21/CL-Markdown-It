/**
 * 简单的排版替换规则
 * 
 * 执行以下替换：
 * - (c) (C) → ©
 * - (tm) (TM) → ™
 * - (r) (R) → ®
 * - +- → ±
 * - ... → … (同时 ?.... → ?.., !.... → !..)
 * - ???????? → ???, !!!!! → !!!, `,,` → `,`
 * - -- → &ndash;, --- → &mdash;
 */

// TODO:
// - 分数 1/2, 1/4, 3/4 -> ½, ¼, ¾
// - 乘法 2 x 4 -> 2 × 4

// 匹配需要替换的稀有字符组合
const RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/

// PhantomJS 的解决方案 - 需要不带 /g 标志的正则表达式，
// 否则根检查会在第二次时失败
const SCOPED_ABBR_TEST_RE = /\((c|tm|r)\)/i

// 匹配括号内的缩写
const SCOPED_ABBR_RE = /\((c|tm|r)\)/ig
const SCOPED_ABBR = {
  c: '©',    // 版权符号
  r: '®',    // 注册商标符号
  tm: '™'    // 商标符号
}

/**
 * 替换函数，将匹配的缩写转换为对应的符号
 */
function replaceFn (match, name) {
  return SCOPED_ABBR[name.toLowerCase()]
}

/**
 * 替换作用域缩写（版权、商标、注册商标符号）
 * 
 * @param {Array} inlineTokens - 内联 token 数组
 */
function replace_scoped (inlineTokens) {
  let inside_autolink = 0

  // 从后往前遍历，避免索引问题
  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i]

    // 只处理不在自动链接内的文本 token
    if (token.type === 'text' && !inside_autolink) {
      token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn)
    }

    // 跟踪自动链接状态
    if (token.type === 'link_open' && token.info === 'auto') {
      inside_autolink--
    }

    if (token.type === 'link_close' && token.info === 'auto') {
      inside_autolink++
    }
  }
}

/**
 * 替换稀有字符组合（省略号、破折号等）
 * 
 * @param {Array} inlineTokens - 内联 token 数组
 */
function replace_rare (inlineTokens) {
  let inside_autolink = 0

  // 从后往前遍历，避免索引问题
  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i]

    // 只处理不在自动链接内的文本 token
    if (token.type === 'text' && !inside_autolink) {
      if (RARE_RE.test(token.content)) {
        token.content = token.content
          .replace(/\+-/g, '±')  // 正负号
          // .., ..., ....... -> …
          // 但是 ?..... & !..... -> ?.. & !..
          .replace(/\.{2,}/g, '…').replace(/([?!])…/g, '$1..')
          .replace(/([?!]){4,}/g, '$1$1$1').replace(/,{2,}/g, ',')
          // em-dash (长破折号)
          .replace(/(^|[^-])---(?=[^-]|$)/mg, '$1\u2014')
          // en-dash (短破折号)
          .replace(/(^|\s)--(?=\s|$)/mg, '$1\u2013')
          .replace(/(^|[^-\s])--(?=[^-\s]|$)/mg, '$1\u2013')
      }
    }

    // 跟踪自动链接状态
    if (token.type === 'link_open' && token.info === 'auto') {
      inside_autolink--
    }

    if (token.type === 'link_close' && token.info === 'auto') {
      inside_autolink++
    }
  }
}

/**
 * 排版替换主函数
 * 
 * @param {Object} state - 解析状态对象
 */
export default function replace (state) {
  let blkIdx

  // 如果未启用排版选项，直接返回
  if (!state.md.options.typographer) { return }

  // 从后往前遍历所有 token
  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== 'inline') { continue }

    // 处理作用域缩写替换
    if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) {
      replace_scoped(state.tokens[blkIdx].children)
    }

    // 处理稀有字符替换
    if (RARE_RE.test(state.tokens[blkIdx].content)) {
      replace_rare(state.tokens[blkIdx].children)
    }
  }
}
