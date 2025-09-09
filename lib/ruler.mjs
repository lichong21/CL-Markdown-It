/**
 * Ruler 类
 * 
 * 这是一个辅助类,被 MarkdownIt 的 core、block 和 inline 解析器使用
 * 用于管理解析规则函数序列,主要功能:
 * - 保持规则按定义顺序执行
 * - 为每个规则分配名称
 * - 启用/禁用规则
 * - 添加/替换规则
 * - 允许将规则分配到额外的命名链中
 * - 缓存活动规则列表
 */
function Ruler () {
  // 已添加规则的列表,每个元素的结构:
  // {
  //   name: 规则名称,
  //   enabled: 是否启用,
  //   fn: 规则处理函数,
  //   alt: [备选链名称数组]
  // }
  this.__rules__ = []

  // 规则链的缓存
  // 第一层 - 链名称,'' 表示默认链
  // 第二层 - 用于快速按字符码过滤的数字锚点
  this.__cache__ = null
}

// 内部辅助方法,不应直接使用

/**
 * 通过名称查找规则索引
 */
Ruler.prototype.__find__ = function (name) {
  for (let i = 0; i < this.__rules__.length; i++) {
    if (this.__rules__[i].name === name) {
      return i
    }
  }
  return -1
}

/**
 * 构建规则查找缓存
 */
Ruler.prototype.__compile__ = function () {
  const self = this
  const chains = [''] // 包含默认链

  // 收集唯一的链名称
  self.__rules__.forEach(function (rule) {
    if (!rule.enabled) { return }

    rule.alt.forEach(function (altName) {
      if (chains.indexOf(altName) < 0) {
        chains.push(altName)
      }
    })
  })

  self.__cache__ = {}

  // 为每个链构建启用规则的列表
  chains.forEach(function (chain) {
    self.__cache__[chain] = []
    self.__rules__.forEach(function (rule) {
      if (!rule.enabled) { return }
      if (chain && rule.alt.indexOf(chain) < 0) { return }
      self.__cache__[chain].push(rule.fn)
    })
  })
}

/**
 * 替换指定名称的规则
 * @param {String} name - 要替换的规则名称
 * @param {Function} fn - 新的规则函数
 * @param {Object} options - 规则选项(可选)
 *   - alt: 备选链名称数组
 */
Ruler.prototype.at = function (name, fn, options) {
  const index = this.__find__(name)
  const opt = options || {}

  if (index === -1) { throw new Error('Parser rule not found: ' + name) }

  this.__rules__[index].fn = fn
  this.__rules__[index].alt = opt.alt || []
  this.__cache__ = null
}

/**
 * 在指定规则之前添加新规则
 * @param {String} beforeName - 目标规则名称
 * @param {String} ruleName - 新规则名称
 * @param {Function} fn - 规则函数
 * @param {Object} options - 规则选项(可选)
 */
Ruler.prototype.before = function (beforeName, ruleName, fn, options) {
  const index = this.__find__(beforeName)
  const opt = options || {}

  if (index === -1) { throw new Error('Parser rule not found: ' + beforeName) }

  this.__rules__.splice(index, 0, {
    name: ruleName,
    enabled: true,
    fn,
    alt: opt.alt || []
  })

  this.__cache__ = null
}

/**
 * 在指定规则之后添加新规则
 * @param {String} afterName - 目标规则名称
 * @param {String} ruleName - 新规则名称
 * @param {Function} fn - 规则函数
 * @param {Object} options - 规则选项(可选) 
 */
Ruler.prototype.after = function (afterName, ruleName, fn, options) {
  const index = this.__find__(afterName)
  const opt = options || {}

  if (index === -1) { throw new Error('Parser rule not found: ' + afterName) }

  this.__rules__.splice(index + 1, 0, {
    name: ruleName,
    enabled: true,
    fn,
    alt: opt.alt || []
  })

  this.__cache__ = null
}

/**
 * 在规则链末尾添加新规则
 * @param {String} ruleName - 规则名称
 * @param {Function} fn - 规则函数
 * @param {Object} options - 规则选项(可选)
 */
Ruler.prototype.push = function (ruleName, fn, options) {
  const opt = options || {}

  this.__rules__.push({
    name: ruleName,
    enabled: true,
    fn,
    alt: opt.alt || []
  })

  this.__cache__ = null
}

/**
 * 启用指定名称的规则
 * @param {String|Array} list - 要启用的规则名称列表
 * @param {Boolean} ignoreInvalid - 是否忽略无效规则名称
 * @returns {Array} 成功启用的规则名称列表
 */
Ruler.prototype.enable = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [list] }

  const result = []

  list.forEach(function (name) {
    const idx = this.__find__(name)

    if (idx < 0) {
      if (ignoreInvalid) { return }
      throw new Error('Rules manager: invalid rule name ' + name)
    }
    this.__rules__[idx].enabled = true
    result.push(name)
  }, this)

  this.__cache__ = null
  return result
}

/**
 * 仅启用指定规则,禁用其他所有规则
 * @param {String|Array} list - 要启用的规则名称列表(白名单)
 * @param {Boolean} ignoreInvalid - 是否忽略无效规则名称
 */
Ruler.prototype.enableOnly = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [list] }

  this.__rules__.forEach(function (rule) { rule.enabled = false })

  this.enable(list, ignoreInvalid)
}

/**
 * 禁用指定名称的规则
 * @param {String|Array} list - 要禁用的规则名称列表
 * @param {Boolean} ignoreInvalid - 是否忽略无效规则名称
 * @returns {Array} 成功禁用的规则名称列表
 */
Ruler.prototype.disable = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [list] }

  const result = []

  list.forEach(function (name) {
    const idx = this.__find__(name)

    if (idx < 0) {
      if (ignoreInvalid) { return }
      throw new Error('Rules manager: invalid rule name ' + name)
    }
    this.__rules__[idx].enabled = false
    result.push(name)
  }, this)

  this.__cache__ = null
  return result
}

/**
 * 获取指定链中的活动规则函数列表
 * @param {String} chainName - 链名称,默认为空字符串
 * @returns {Array} 活动规则函数列表
 */
Ruler.prototype.getRules = function (chainName) {
  if (this.__cache__ === null) {
    this.__compile__()
  }

  // 即使链为空也返回数组
  return this.__cache__[chainName] || []
}

export default Ruler
