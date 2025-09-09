/**
 * Core 类
 *
 * 顶层规则执行器，负责协调块级和内联解析器，并执行中间转换。
 * 在 markdown-it 的解析流程中，Core 处于核心位置，
 * 控制整个解析过程的主要步骤和顺序。
 */

import Ruler from './ruler.mjs'
import StateCore from './rules_core/state_core.mjs'

// 导入核心规则处理函数
import r_normalize from './rules_core/normalize.mjs'  // 规范化输入文本
import r_block from './rules_core/block.mjs'          // 处理块级元素
import r_inline from './rules_core/inline.mjs'        // 处理内联元素
import r_linkify from './rules_core/linkify.mjs'      // 自动链接转换
import r_replacements from './rules_core/replacements.mjs'  // 排版替换
import r_smartquotes from './rules_core/smartquotes.mjs'    // 智能引号
import r_text_join from './rules_core/text_join.mjs'        // 文本合并

/**
 * 核心规则列表
 * 按照执行顺序排列，每个规则由名称和处理函数组成
 * 这些规则将按顺序应用于输入文本
 */
const _rules = [
  // 规范化：处理换行符、制表符等，使输入文本标准化
  ['normalize',      r_normalize],
  
  // 块级解析：将文本分解为段落、标题、列表等块级元素
  ['block',          r_block],
  
  // 内联解析：处理块内的强调、链接等内联元素
  ['inline',         r_inline],
  
  // 自动链接：将类似 URL 的文本转换为链接（需启用 linkify 选项）
  ['linkify',        r_linkify],
  
  // 排版替换：处理破折号、省略号等排版增强（需启用 typographer 选项）
  ['replacements',   r_replacements],
  
  // 智能引号：将直引号转换为弯引号（需启用 typographer 选项）
  ['smartquotes',    r_smartquotes],
  
  // 文本合并：查找并合并特殊文本标记（如转义序列）
  // 将它们与其余文本合并，优化最终输出
  ['text_join',      r_text_join]
]

/**
 * Core 构造函数
 * 初始化核心解析器，注册所有核心规则
 */
function Core () {
  /**
   * 规则管理器实例
   * 用于管理和执行核心规则链
   */
  this.ruler = new Ruler()

  // 注册所有核心规则
  for (let i = 0; i < _rules.length; i++) {
    this.ruler.push(_rules[i][0], _rules[i][1])
  }
}

/**
 * 处理状态对象
 * @param {StateCore} state - 核心状态对象，包含解析上下文和标记流
 * 
 * 按顺序执行所有启用的核心规则，完成整个解析过程
 * 这是 markdown-it 解析流程的主要控制点
 */
Core.prototype.process = function (state) {
  // 获取所有启用的规则
  const rules = this.ruler.getRules('')

  // 按顺序执行每个规则
  for (let i = 0, l = rules.length; i < l; i++) {
    rules[i](state)
  }
}

/**
 * 状态类引用
 * 允许外部访问 StateCore 类，用于创建新的状态对象
 */
Core.prototype.State = StateCore

export default Core
