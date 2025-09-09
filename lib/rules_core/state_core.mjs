/**
 * 核心状态对象
 * 
 * 管理 markdown-it 解析过程中的状态信息，
 * 包括源码、环境变量、token 数组等
 */

import Token from '../token.mjs'

/**
 * StateCore 构造函数
 * 
 * @param {string} src - 输入的 markdown 源码
 * @param {Object} md - markdown-it 实例的引用
 * @param {Object} env - 环境变量对象
 */
function StateCore (src, md, env) {
  this.src = src           // 原始 markdown 源码
  this.env = env           // 环境变量对象，用于存储解析过程中的临时数据
  this.tokens = []         // 解析生成的 token 数组
  this.inlineMode = false  // 是否为内联模式
  this.md = md             // markdown-it 解析器实例的引用
}

// 重新导出 Token 类，供核心规则使用
StateCore.prototype.Token = Token

export default StateCore
