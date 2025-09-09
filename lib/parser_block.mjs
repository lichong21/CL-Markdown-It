/** internal
 * class ParserBlock
 *
 * 块级标记器（Block-level tokenizer）
 * 负责解析Markdown文档中的块级元素，如段落、列表、代码块、引用等
 **/

// 导入规则管理器，用于管理和执行解析规则
import Ruler from './ruler.mjs'
// 导入块级状态类，用于维护解析过程中的状态信息
import StateBlock from './rules_block/state_block.mjs'

// 导入各种块级解析规则
import r_table from './rules_block/table.mjs'           // 表格解析规则
import r_code from './rules_block/code.mjs'             // 代码块解析规则
import r_fence from './rules_block/fence.mjs'           // 围栏代码块解析规则
import r_blockquote from './rules_block/blockquote.mjs' // 引用块解析规则
import r_hr from './rules_block/hr.mjs'                 // 水平分割线解析规则
import r_list from './rules_block/list.mjs'             // 列表解析规则
import r_reference from './rules_block/reference.mjs'   // 引用定义解析规则
import r_html_block from './rules_block/html_block.mjs' // HTML块解析规则
import r_heading from './rules_block/heading.mjs'       // 标题解析规则
import r_lheading from './rules_block/lheading.mjs'     // Setext风格标题解析规则
import r_paragraph from './rules_block/paragraph.mjs'   // 段落解析规则

// 块级解析规则数组，按优先级顺序排列
// 数组格式：[规则名称, 规则函数, 可被此规则终止的规则列表]
// 优先级从高到低：表格 > 代码块 > 围栏代码块 > 引用 > 水平线 > 列表 > 引用定义 > HTML块 > 标题 > Setext标题 > 段落
const _rules = [
  // 前两个参数：规则名称和规则函数。第三个参数：可以被当前规则终止的其他规则列表
  ['table',      r_table,      ['paragraph', 'reference']],                      // 表格（可终止段落和引用定义）
  ['code',       r_code],                                                        // 缩进代码块
  ['fence',      r_fence,      ['paragraph', 'reference', 'blockquote', 'list']], // 围栏代码块
  ['blockquote', r_blockquote, ['paragraph', 'reference', 'blockquote', 'list']], // 引用块
  ['hr',         r_hr,         ['paragraph', 'reference', 'blockquote', 'list']], // 水平分割线
  ['list',       r_list,       ['paragraph', 'reference', 'blockquote']],         // 列表
  ['reference',  r_reference],                                                   // 引用定义
  ['html_block', r_html_block, ['paragraph', 'reference', 'blockquote']],        // HTML块
  ['heading',    r_heading,    ['paragraph', 'reference', 'blockquote']],        // ATX风格标题
  ['lheading',   r_lheading],                                                    // Setext风格标题
  ['paragraph',  r_paragraph]                                                    // 段落（优先级最低，兜底规则）
]

/**
 * ParserBlock 构造函数
 * 创建一个新的块级解析器实例，初始化规则管理器并注册所有块级解析规则
 **/
function ParserBlock () {
  /**
   * ParserBlock#ruler -> Ruler
   *
   * 规则管理器实例，用于管理块级解析规则的配置
   * 负责规则的注册、启用/禁用、优先级管理等
   **/
  this.ruler = new Ruler()

  // 遍历所有预定义的块级解析规则，将它们注册到规则管理器中
  for (let i = 0; i < _rules.length; i++) {
    // 注册规则：规则名称、规则函数、配置选项（包含可替代的规则列表）
    this.ruler.push(_rules[i][0], _rules[i][1], { alt: (_rules[i][2] || []).slice() })
  }
}

/**
 * 为指定的输入范围生成标记（tokens）
 * 
 * @param {StateBlock} state - 块级解析状态对象
 * @param {number} startLine - 开始行号
 * @param {number} endLine - 结束行号
 */
ParserBlock.prototype.tokenize = function (state, startLine, endLine) {
  // 获取所有启用的块级解析规则
  const rules = this.ruler.getRules('')
  const len = rules.length
  // 获取最大嵌套深度限制，防止无限递归
  const maxNesting = state.md.options.maxNesting
  let line = startLine
  let hasEmptyLines = false  // 标记是否遇到空行，用于确定tight模式

  // 逐行处理输入文本
  while (line < endLine) {
    // 跳过空行并更新当前行号
    state.line = line = state.skipEmptyLines(line)
    if (line >= endLine) { break }

    // 嵌套调用的终止条件
    // 当前主要用于引用块和列表的嵌套处理
    // 如果当前行的缩进小于块缩进，说明嵌套结束
    if (state.sCount[line] < state.blkIndent) { break }

    // 如果嵌套层级超过限制，跳到末尾
    // 这不是正常情况，我们不需要关心内容
    if (state.level >= maxNesting) {
      state.line = endLine
      break
    }

    // 尝试所有可能的解析规则
    // 成功的规则应该：
    // - 更新 `state.line`（推进行号）
    // - 更新 `state.tokens`（添加新的标记）
    // - 返回 true
    const prevLine = state.line
    let ok = false

    // 按优先级顺序尝试每个规则
    for (let i = 0; i < len; i++) {
      ok = rules[i](state, line, endLine, false)
      if (ok) {
        // 确保规则确实推进了行号，防止无限循环
        if (prevLine >= state.line) {
          throw new Error("block rule didn't increment state.line")
        }
        break
      }
    }

    // 如果没有规则匹配，这只能发生在用户禁用段落规则的情况下
    if (!ok) throw new Error('none of the block rules matched')

    // 根据之前是否有空行来设置tight模式
    // tight模式影响列表等元素的渲染方式
    // 注意：最新的空行不应该计算在内
    state.tight = !hasEmptyLines

    // 段落可能会在嵌套列表中"吃掉"一个换行符
    if (state.isEmpty(state.line - 1)) {
      hasEmptyLines = true
    }

    line = state.line

    // 如果当前行是空行，标记hasEmptyLines并跳过
    if (line < endLine && state.isEmpty(line)) {
      hasEmptyLines = true
      line++
      state.line = line
    }
  }
}

/**
 * ParserBlock.parse(src, md, env, outTokens)
 * 
 * 解析输入字符串并将块级标记推入输出数组
 * 
 * @param {string} src - 要解析的Markdown源码字符串
 * @param {MarkdownIt} md - MarkdownIt主实例，包含配置和选项
 * @param {Object} env - 环境对象，用于在解析过程中存储临时数据
 * @param {Array} outTokens - 输出标记数组，解析生成的标记将被添加到此数组中
 **/
ParserBlock.prototype.parse = function (src, md, env, outTokens) {
  // 如果源码为空，直接返回
  if (!src) { return }

  // 创建块级解析状态对象，包含源码、MarkdownIt实例、环境和输出标记数组
  const state = new this.State(src, md, env, outTokens)

  // 开始标记化过程，从第一行到最后一行
  this.tokenize(state, state.line, state.lineMax)
}

// 将StateBlock类赋值给State属性，供外部访问
ParserBlock.prototype.State = StateBlock

export default ParserBlock
