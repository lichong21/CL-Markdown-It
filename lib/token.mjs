/**
 * Token 类
 * 
 * 这是 markdown-it 的基础数据结构,用于表示解析后的标记
 * 每个 Token 对象代表文档中的一个语法元素(如段落、标题、链接等)
 * 
 * Token 在解析过程中的作用:
 * 1. Block 解析: 首先将文档分解成块级 token (如段落、标题、列表等)
 * 2. Inline 解析: 然后解析块级 token 内的内联内容,生成内联 token
 * 3. 渲染: 最后根据 token 树结构渲染出 HTML
 * 
 * Token 的类型主要分为:
 * - 开始标记 (nesting = 1): 如 paragraph_open
 * - 结束标记 (nesting = -1): 如 paragraph_close  
 * - 自闭合标记 (nesting = 0): 如 image、code、hr 等
 */

/**
 * 创建新的 Token 实例并填充传入的属性
 * @param {String} type - Token 类型,如 paragraph_open, link_close 等
 * @param {String} tag - HTML 标签名,如 p, a, img 等
 * @param {Number} nesting - 嵌套层级变化:
 *                          1 = 开始标签
 *                          0 = 自闭合标签
 *                         -1 = 结束标签
 */
function Token (type, tag, nesting) {
  /**
   * Token 的类型
   * @type {String}
   * 例如: "paragraph_open", "heading_close" 等
   */
  this.type     = type

  /**
   * HTML 标签名
   * @type {String}
   * 例如: "p", "h1" 等
   */
  this.tag      = tag

  /**
   * HTML 属性数组
   * @type {Array|null}
   * 格式: [ [属性名1, 属性值1], [属性名2, 属性值2] ]
   */
  this.attrs    = null

  /**
   * 源码映射信息
   * @type {Array|null}
   * 格式: [起始行号, 结束行号]
   */
  this.map      = null

  /**
   * 嵌套层级变化
   * @type {Number}
   * 取值:
   *  1: 开始标签
   *  0: 自闭合标签
   * -1: 结束标签
   */
  this.nesting  = nesting

  /**
   * 当前嵌套层级
   * @type {Number}
   * 与 state.level 保持一致
   */
  this.level    = 0

  /**
   * 子节点数组
   * @type {Array|null}
   * 存储内联标记和图片标记
   */
  this.children = null

  /**
   * 标记内容
   * @type {String}
   * 用于自闭合标签(如代码块、HTML、围栏等)的内容
   */
  this.content  = ''

  /**
   * 原始标记字符
   * @type {String}
   * 例如: 强调使用的 '*' 或 '_',围栏字符串等
   */
  this.markup   = ''

  /**
   * 附加信息
   * @type {String}
   * 用途:
   * - 围栏代码块的信息字符串
   * - 自动链接的 "auto" 值
   * - 有序列表项的标记字符串
   */
  this.info     = ''

  /**
   * 元数据
   * @type {Object|null}
   * 供插件存储任意数据
   */
  this.meta     = null

  /**
   * 是否为块级标记
   * @type {Boolean}
   * 用于渲染器计算换行
   */
  this.block    = false

  /**
   * 是否隐藏
   * @type {Boolean}
   * 如果为 true,渲染时会忽略此元素
   * 用于紧凑列表中隐藏段落
   */
  this.hidden   = false
}

/**
 * 查找属性索引
 * @param {String} name - 属性名
 * @returns {Number} 属性索引,未找到返回 -1
 */
Token.prototype.attrIndex = function attrIndex (name) {
  if (!this.attrs) { return -1 }

  const attrs = this.attrs

  for (let i = 0, len = attrs.length; i < len; i++) {
    if (attrs[i][0] === name) { return i }
  }
  return -1
}

/**
 * 添加属性
 * @param {Array} attrData - [属性名, 属性值] 数组
 */
Token.prototype.attrPush = function attrPush (attrData) {
  if (this.attrs) {
    this.attrs.push(attrData)
  } else {
    this.attrs = [attrData]
  }
}

/**
 * 设置属性
 * @param {String} name - 属性名
 * @param {String} value - 属性值
 * 如果属性已存在则覆盖,否则添加新属性
 */
Token.prototype.attrSet = function attrSet (name, value) {
  const idx = this.attrIndex(name)
  const attrData = [name, value]

  if (idx < 0) {
    this.attrPush(attrData)
  } else {
    this.attrs[idx] = attrData
  }
}

/**
 * 获取属性值
 * @param {String} name - 属性名
 * @returns {String|null} 属性值,不存在返回 null
 */
Token.prototype.attrGet = function attrGet (name) {
  const idx = this.attrIndex(name)
  let value = null
  if (idx >= 0) {
    value = this.attrs[idx][1]
  }
  return value
}

/**
 * 追加属性值
 * @param {String} name - 属性名
 * @param {String} value - 要追加的值
 * 通过空格连接追加值,如果属性不存在则创建
 * 常用于操作 token 的 class 属性
 */
Token.prototype.attrJoin = function attrJoin (name, value) {
  const idx = this.attrIndex(name)

  if (idx < 0) {
    this.attrPush([name, value])
  } else {
    this.attrs[idx][1] = this.attrs[idx][1] + ' ' + value
  }
}

export default Token
