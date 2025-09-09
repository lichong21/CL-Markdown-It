/**
 * MarkdownIt 类
 * 
 * 这是 markdown-it 的主解析器/渲染器类
 * 负责将 Markdown 文本解析为 HTML
 * 提供了配置、解析和渲染的主要接口
 */

import * as utils from './common/utils.mjs'
import * as helpers from './helpers/index.mjs'
import Renderer from './renderer.mjs'
import ParserCore from './parser_core.mjs'
import ParserBlock from './parser_block.mjs'
import ParserInline from './parser_inline.mjs'
import LinkifyIt from '../node_modules/linkify-it/build/index.cjs.js'
import * as mdurl from '../node_modules/mdurl/index.mjs'
import punycode from '../node_modules/punycode/punycode.js'

import cfg_default from './presets/default.mjs'
import cfg_zero from './presets/zero.mjs'
import cfg_commonmark from './presets/commonmark.mjs'

/**
 * 预设配置对象
 * - default: 默认配置,类似 GFM (GitHub Flavored Markdown)
 * - zero: 零配置,禁用所有规则,用于手动配置简单模式
 * - commonmark: CommonMark 严格模式,符合 CommonMark 规范
 */
const config = {
  default: cfg_default,
  zero: cfg_zero,
  commonmark: cfg_commonmark
}

/**
 * 链接验证相关的正则表达式
 * BAD_PROTO_RE: 匹配危险的协议前缀,用于安全过滤
 * GOOD_DATA_RE: 匹配安全的 data URI 图片类型,允许这些类型通过验证
 */
const BAD_PROTO_RE = /^(vbscript|javascript|file|data):/
const GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/

/**
 * 验证链接是否安全
 * @param {String} url - 要验证的 URL
 * @returns {Boolean} 链接是否安全
 * 
 * 默认禁用 javascript:、vbscript:、file: 协议
 * 以及大多数 data: 协议(除了部分图片类型)
 * 这是防止 XSS 攻击的安全措施
 */
function validateLink (url) {
  const str = url.trim().toLowerCase()
  return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) : true
}

/**
 * 需要重新编码主机名的协议列表
 * 用于确定哪些 URL 协议需要进行 Punycode 编码
 */
const RECODE_HOSTNAME_FOR = ['http:', 'https:', 'mailto:']

/**
 * 规范化链接 URL
 * @param {String} url - 原始 URL
 * @returns {String} 规范化后的 URL
 * 
 * 主要功能:
 * 1. 解析 URL 结构
 * 2. 对特定协议的主机名进行 Punycode 编码(国际化域名处理)
 * 3. 重新格式化和编码 URL
 */
function normalizeLink (url) {
  const parsed = mdurl.parse(url, true)

  if (parsed.hostname) {
    // 对特定协议的主机名进行 Punycode 编码
    // 如 http://host/, https://host/, mailto:user@host, //host/
    //
    // 不编码未知协议,因为可能会错误编码不应该编码的内容
    // 例如 skype:name 会被错误地当作 skype:host
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
      try {
        parsed.hostname = punycode.toASCII(parsed.hostname)
      } catch (er) { /**/ }
    }
  }

  return mdurl.encode(mdurl.format(parsed))
}

/**
 * 规范化链接文本
 * @param {String} url - 原始 URL
 * @returns {String} 用于显示的规范化文本
 * 
 * 与 normalizeLink 相反,这个函数用于显示:
 * 1. 解析 URL
 * 2. 对特定协议的主机名进行 Punycode 解码(便于阅读)
 * 3. 重新格式化和解码 URL 用于显示
 */
function normalizeLinkText (url) {
  const parsed = mdurl.parse(url, true)

  if (parsed.hostname) {
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
      try {
        parsed.hostname = punycode.toUnicode(parsed.hostname)
      } catch (er) { /**/ }
    }
  }

  // 添加 '%' 到排除列表,解决 #720 问题
  return mdurl.decode(mdurl.format(parsed), mdurl.decode.defaultChars + '%')
}

/**
 * MarkdownIt 构造函数
 * @param {String} presetName - 可选,预设名称: 'commonmark'/'zero'/'default'
 * @param {Object} options - 解析器选项,覆盖预设选项
 * @returns {MarkdownIt} 解析器实例
 * 
 * 主要功能:
 * 1. 初始化解析器实例
 * 2. 设置预设配置
 * 3. 应用自定义选项
 * 4. 初始化各个解析器组件
 */
function MarkdownIt (presetName, options) {
  // 支持不使用 new 关键字创建实例
  if (!(this instanceof MarkdownIt)) {
    return new MarkdownIt(presetName, options)
  }

  // 处理参数,支持只传入 options 的情况
  if (!options) {
    if (!utils.isString(presetName)) {
      options = presetName || {}
      presetName = 'default'
    }
  }

  // 获取预设配置
  this.inline = new ParserInline()
  this.block = new ParserBlock()
  this.core = new ParserCore()
  this.renderer = new Renderer()
  
  // 初始化实例
  this.linkify = new LinkifyIt()
  this.validateLink = validateLink
  this.normalizeLink = normalizeLink
  this.normalizeLinkText = normalizeLinkText

  // 设置默认选项
  this.options = {}
  this.configure(presetName)

  // 应用自定义选项
  if (options) { this.set(options) }
}

/**
 * 解析 Markdown 文本为 tokens 数组
 * @param {String} src - 源 Markdown 文本
 * @param {Object} env - 环境对象,用于在规则间传递数据
 * @returns {Array} tokens - 解析后的标记数组
 * 
 * 这是核心解析方法,将输入文本解析为 tokens。
 * 通常不需要直接调用此方法,除非你在开发自定义渲染器。
 */
MarkdownIt.prototype.parse = function (src, env) {
  if (typeof src !== 'string') {
    throw new Error('Input data should be a String')
  }

  // 创建环境对象
  const state = new this.core.State(src, this, env)

  // 执行核心处理流程
  this.core.process(state)

  return state.tokens
}

/**
 * 渲染 Markdown 为 HTML
 * @param {String} src - 源 Markdown 文本
 * @param {Object} env - 环境对象,默认为 {}
 * @returns {String} 渲染后的 HTML
 * 
 * 这是最常用的方法,完成从 Markdown 到 HTML 的转换。
 * 内部流程:
 * 1. 调用 parse() 解析文本为 tokens
 * 2. 调用 renderer.render() 将 tokens 渲染为 HTML
 */
MarkdownIt.prototype.render = function (src, env) {
  env = env || {}
  console.log('MarkdownIt.prototype.render')
  return this.renderer.render(this.parse(src, env), this.options, env)
}

/**
 * 解析内联 Markdown 文本
 * @param {String} src - 源 Markdown 文本
 * @param {Object} env - 环境对象
 * @returns {Array} tokens - 解析后的内联标记数组
 * 
 * 与 parse() 类似,但跳过所有块级规则。
 * 返回的 tokens 数组中只包含一个带有内联 tokens 的 inline 元素。
 */
MarkdownIt.prototype.parseInline = function (src, env) {
  const state = new this.core.State(src, this, env)

  state.inlineMode = true
  this.core.process(state)

  return state.tokens
}

/**
 * 渲染内联 Markdown 为 HTML
 * @param {String} src - 源 Markdown 文本
 * @param {Object} env - 环境对象,默认为 {}
 * @returns {String} 渲染后的 HTML
 * 
 * 与 render() 类似,但用于单个段落内容。
 * 结果不会被包裹在 <p> 标签中。
 */
MarkdownIt.prototype.renderInline = function (src, env) {
  env = env || {}

  return this.renderer.render(this.parseInline(src, env), this.options, env)
}

/**
 * 设置解析器选项
 * @param {Object} options - 选项对象
 * @returns {MarkdownIt} 实例自身,支持链式调用
 * 
 * 用于在构造函数调用后修改选项。
 * 注意: 为获得最佳性能,建议不要频繁修改实例选项。
 * 如果需要多个配置,最好创建多个实例。
 */
MarkdownIt.prototype.set = function (options) {
  utils.assign(this.options, options)
  return this
}

/**
 * 配置预设
 * @param {String|Object} presets - 预设名称或预设配置对象
 * @returns {MarkdownIt} 实例自身,支持链式调用
 * 
 * 批量加载选项和组件设置。
 * 建议使用预设而不是直接加载配置,这样可以获得更好的版本兼容性。
 */
MarkdownIt.prototype.configure = function (presets) {
  const self = this

  // 处理字符串预设名称
  if (utils.isString(presets)) {
    const presetName = presets
    presets = config[presetName]
    if (!presets) { throw new Error('Wrong `markdown-it` preset "' + presetName + '", check name') }
  }

  if (!presets) { throw new Error('Wrong `markdown-it` preset, can\'t be empty') }

  // 应用选项
  if (presets.options) { self.set(presets.options) }

  // 应用组件规则
  if (presets.components) {
    Object.keys(presets.components).forEach(function (name) {
      if (presets.components[name].rules) {
        self[name].ruler.enableOnly(presets.components[name].rules)
      }
      if (presets.components[name].rules2) {
        self[name].ruler2.enableOnly(presets.components[name].rules2)
      }
    })
  }
  return this
}

/**
 * 启用规则
 * @param {String|Array} list - 要启用的规则名称或名称列表
 * @param {Boolean} ignoreInvalid - 是否忽略无效规则名称
 * @returns {MarkdownIt} 实例自身,支持链式调用
 * 
 * 自动在 core、block、inline 解析器中查找并启用指定规则。
 * 如果规则未找到且 ignoreInvalid 为 false,则抛出异常。
 */
MarkdownIt.prototype.enable = function (list, ignoreInvalid) {
  let result = []

  if (!Array.isArray(list)) { list = [list] }

  // 在所有规则链中查找并启用规则
  ['core', 'block', 'inline'].forEach(function (chain) {
    result = result.concat(this[chain].ruler.enable(list, true))
  }, this)

  // 在 inline.ruler2 中启用规则
  result = result.concat(this.inline.ruler2.enable(list, true))

  // 检查是否有未找到的规则
  const missed = list.filter(function (name) { return result.indexOf(name) < 0 })

  if (missed.length && !ignoreInvalid) {
    throw new Error('MarkdownIt. Failed to enable unknown rule(s): ' + missed)
  }

  return this
}

/**
 * 禁用规则
 * @param {String|Array} list - 要禁用的规则名称或名称列表
 * @param {Boolean} ignoreInvalid - 是否忽略无效规则名称
 * @returns {MarkdownIt} 实例自身,支持链式调用
 * 
 * 与 enable() 功能相同,但是禁用而不是启用指定规则。
 */
MarkdownIt.prototype.disable = function (list, ignoreInvalid) {
  let result = []

  if (!Array.isArray(list)) { list = [list] }

  // 在所有规则链中查找并禁用规则
  ['core', 'block', 'inline'].forEach(function (chain) {
    result = result.concat(this[chain].ruler.disable(list, true))
  }, this)

  // 在 inline.ruler2 中禁用规则
  result = result.concat(this.inline.ruler2.disable(list, true))

  // 检查是否有未找到的规则
  const missed = list.filter(function (name) { return result.indexOf(name) < 0 })

  if (missed.length && !ignoreInvalid) {
    throw new Error('MarkdownIt. Failed to disable unknown rule(s): ' + missed)
  }
  return this
}

/**
 * 加载插件
 * @param {Function} plugin - 插件函数
 * @param {...*} params - 传递给插件的参数
 * @returns {MarkdownIt} 实例自身,支持链式调用
 * 
 * 将指定插件加载到当前解析器实例。
 * 这是一个语法糖,等同于调用 plugin(md, params)。
 * 
 * 插件可以:
 * - 添加新的语法规则
 * - 修改现有规则
 * - 添加新的渲染规则
 * - 修改解析器选项
 */
MarkdownIt.prototype.use = function (plugin /*, params, ... */) {
  const args = [this].concat(Array.prototype.slice.call(arguments, 1))
  plugin.apply(plugin, args)
  return this
}

export default MarkdownIt
