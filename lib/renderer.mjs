/**
 * Renderer 类
 * 
 * 负责将解析后的 token 流生成 HTML。
 * 每个实例都有独立的规则副本,可以方便地重写这些规则。
 * 通过插件可以添加新的规则来支持新的 token 类型。
 */

import { assign, unescapeAll, escapeHtml } from './common/utils.mjs'

/**
 * 默认渲染规则集
 */
const default_rules = {}

/**
 * 内联代码渲染规则
 * 将 `code` 包裹的内容渲染为 <code> 标签
 */
default_rules.code_inline = function (tokens, idx, options, env, slf) {
  const token = tokens[idx]

  return  '<code' + slf.renderAttrs(token) + '>' +
          escapeHtml(token.content) +
          '</code>'
}

/**
 * 代码块渲染规则
 * 将缩进代码块渲染为 <pre><code> 标签
 */
default_rules.code_block = function (tokens, idx, options, env, slf) {
  const token = tokens[idx]

  return  '<pre' + slf.renderAttrs(token) + '><code>' +
          escapeHtml(tokens[idx].content) +
          '</code></pre>\n'
}

/**
 * 围栏代码块渲染规则
 * 处理 ``` 标记的代码块,支持语言标记和代码高亮
 */
default_rules.fence = function (tokens, idx, options, env, slf) {
  const token = tokens[idx]
  const info = token.info ? unescapeAll(token.info).trim() : ''
  let langName = ''
  let langAttrs = ''

  if (info) {
    // 解析语言标记和额外属性
    const arr = info.split(/(\s+)/g)
    langName = arr[0]
    langAttrs = arr.slice(2).join('')
  }

  // 处理代码高亮
  let highlighted
  if (options.highlight) {
    highlighted = options.highlight(token.content, langName, langAttrs) || escapeHtml(token.content)
  } else {
    highlighted = escapeHtml(token.content)
  }

  // 如果高亮结果已经包含 <pre>,直接返回
  if (highlighted.indexOf('<pre') === 0) {
    return highlighted + '\n'
  }

  // 如果指定了语言,添加语言类名
  if (info) {
    const i = token.attrIndex('class')
    const tmpAttrs = token.attrs ? token.attrs.slice() : []

    if (i < 0) {
      tmpAttrs.push(['class', options.langPrefix + langName])
    } else {
      tmpAttrs[i] = tmpAttrs[i].slice()
      tmpAttrs[i][1] += ' ' + options.langPrefix + langName
    }

    // 创建临时 token 用于渲染属性
    const tmpToken = {
      attrs: tmpAttrs
    }

    return `<pre><code${slf.renderAttrs(tmpToken)}>${highlighted}</code></pre>\n`
  }

  return `<pre><code${slf.renderAttrs(token)}>${highlighted}</code></pre>\n`
}

/**
 * 图片渲染规则
 * 处理图片的 alt 属性,确保其位置正确
 */
default_rules.image = function (tokens, idx, options, env, slf) {
  const token = tokens[idx]

  // "alt" attr MUST be set, even if empty. Because it's mandatory and
  // should be placed on proper position for tests.
  //
  // Replace content with actual value

  token.attrs[token.attrIndex('alt')][1] =
    slf.renderInlineAsText(token.children, options, env)

  return slf.renderToken(tokens, idx, options)
}

/**
 * 硬换行渲染规则
 * 处理行尾两个空格的换行
 */
default_rules.hardbreak = function (tokens, idx, options /*, env */) {
  return options.xhtmlOut ? '<br />\n' : '<br>\n'
}

/**
 * 软换行渲染规则
 * 处理普通的换行符
 */
default_rules.softbreak = function (tokens, idx, options /*, env */) {
  return options.breaks ? (options.xhtmlOut ? '<br />\n' : '<br>\n') : '\n'
}

/**
 * 文本渲染规则
 * 处理普通文本内容
 */
default_rules.text = function (tokens, idx /*, options, env */) {
  return escapeHtml(tokens[idx].content)
}

/**
 * HTML 块级元素渲染规则
 */
default_rules.html_block = function (tokens, idx /*, options, env */) {
  return tokens[idx].content
}

/**
 * HTML 内联元素渲染规则
 */
default_rules.html_inline = function (tokens, idx /*, options, env */) {
  return tokens[idx].content
}

/**
 * Renderer 构造函数
 * 创建新的渲染器实例并使用默认规则填充 rules 属性
 */
function Renderer () {
  /**
   * 渲染规则对象
   * 包含各种 token 类型的渲染函数
   * 可以通过修改这些规则来自定义输出格式
   */
  this.rules = assign({}, default_rules)
}

/**
 * 渲染 token 的属性
 * @param {Token} token - 要渲染属性的 token
 * @returns {String} 渲染后的属性字符串
 */
Renderer.prototype.renderAttrs = function renderAttrs (token) {
  let i, l, result

  if (!token.attrs) { return '' }

  result = ''

  for (i = 0, l = token.attrs.length; i < l; i++) {
    result += ' ' + escapeHtml(token.attrs[i][0]) + '="' + escapeHtml(token.attrs[i][1]) + '"'
  }

  return result
}

/**
 * 渲染单个 token
 * @param {Array} tokens - token 列表
 * @param {Number} idx - 当前 token 索引
 * @param {Object} options - 渲染选项
 * @returns {String} 渲染后的 HTML
 */
Renderer.prototype.renderToken = function renderToken (tokens, idx, options) {
  const token = tokens[idx]
  let result = ''

  // Tight list paragraphs
  if (token.hidden) {
    return ''
  }

  // Insert a newline between hidden paragraph and subsequent opening
  // block-level tag.
  //
  // For example, here we should insert a newline before blockquote:
  //  - a
  //    >
  //
  if (token.block && token.nesting !== -1 && idx && tokens[idx - 1].hidden) {
    result += '\n'
  }

  // Add token name, e.g. `<img`
  result += (token.nesting === -1 ? '</' : '<') + token.tag

  // Encode attributes, e.g. `<img src="foo"`
  result += this.renderAttrs(token)

  // Add a slash for self-closing tags, e.g. `<img src="foo" /`
  if (token.nesting === 0 && options.xhtmlOut) {
    result += ' /'
  }

  // Check if we need to add a newline after this tag
  let needLf = false
  if (token.block) {
    needLf = true

    if (token.nesting === 1) {
      if (idx + 1 < tokens.length) {
        const nextToken = tokens[idx + 1]

        if (nextToken.type === 'inline' || nextToken.hidden) {
          // Block-level tag containing an inline tag.
          //
          needLf = false
        } else if (nextToken.nesting === -1 && nextToken.tag === token.tag) {
          // Opening tag + closing tag of the same type. E.g. `<li></li>`.
          //
          needLf = false
        }
      }
    }
  }

  result += needLf ? '>\n' : '>'

  return result
}

/**
 * 渲染内联 token 列表
 * @param {Array} tokens - 内联 token 列表
 * @param {Object} options - 渲染选项
 * @param {Object} env - 环境对象
 * @returns {String} 渲染后的 HTML
 */
Renderer.prototype.renderInline = function (tokens, options, env) {
  let result = ''
  const rules = this.rules

  for (let i = 0, len = tokens.length; i < len; i++) {
    const type = tokens[i].type

    if (typeof rules[type] !== 'undefined') {
      result += rules[type](tokens, i, options, env, this)
    } else {
      result += this.renderToken(tokens, i, options)
    }
  }

  return result
}

/**
 * 将内联 token 渲染为纯文本
 * 这是一个特殊的方法,用于图片的 alt 属性
 * 符合 CommonMark 规范要求
 */
Renderer.prototype.renderInlineAsText = function (tokens, options, env) {
  let result = ''

  for (let i = 0, len = tokens.length; i < len; i++) {
    switch (tokens[i].type) {
      case 'text':
        result += tokens[i].content
        break
      case 'image':
        result += this.renderInlineAsText(tokens[i].children, options, env)
        break
      case 'html_inline':
      case 'html_block':
        result += tokens[i].content
        break
      case 'softbreak':
      case 'hardbreak':
        result += '\n'
        break
      default:
        // all other tokens are skipped
    }
  }

  return result
}

/**
 * 渲染 token 流
 * @param {Array} tokens - token 列表
 * @param {Object} options - 渲染选项
 * @param {Object} env - 环境对象
 * @returns {String} 渲染后的 HTML
 * 
 * 这是渲染器的主要方法,通常不需要直接调用
 */
Renderer.prototype.render = function (tokens, options, env) {
  let result = ''
  const rules = this.rules

  for (let i = 0, len = tokens.length; i < len; i++) {
    const type = tokens[i].type
    console.log('Renderer.prototype.render', tokens[i])
    if (type === 'inline') {
      result += this.renderInline(tokens[i].children, options, env)
    } else if (typeof rules[type] !== 'undefined') {
      result += rules[type](tokens, i, options, env, this)
    } else {
      result += this.renderToken(tokens, i, options, env)
    }
  }

  return result
}

export default Renderer
