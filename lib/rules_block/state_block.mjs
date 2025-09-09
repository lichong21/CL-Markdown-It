// 块级解析器状态类
// 用于管理块级元素解析过程中的状态信息和辅助方法

import Token from '../token.mjs'
import { isSpace } from '../common/utils.mjs'

// StateBlock 构造函数
// 初始化块级解析器的状态对象
function StateBlock (src, md, env, tokens) {
  this.src = src  // 源代码字符串

  // 解析器实例的链接
  this.md     = md

  this.env = env  // 环境变量（用于存储引用等）

  //
  // 内部状态变量
  //

  this.tokens = tokens  // token 数组

  this.bMarks = []  // 行开始偏移量，用于快速跳转
  this.eMarks = []  // 行结束偏移量，用于快速跳转
  this.tShift = []  // 第一个非空格字符的偏移量（制表符未展开）
  this.sCount = []  // 每行的缩进量（制表符已展开）

  // 每行开始（bMarks）和该行实际开始之间的虚拟空格数量（制表符已展开）
  //
  // 它存在只是作为一个补丁，因为块引用会覆盖 bMarks
  // 在这个过程中丢失信息。
  //
  // 它只在展开制表符时使用，你可以把它想象成
  // 初始制表符长度，例如 bsCount=21 应用于字符串 `\t123`
  // 意味着第一个制表符应该展开为 4-21%4 === 3 个空格。
  //
  this.bsCount = []

  // 块解析器变量

  // 必需的块内容缩进（例如，如果我们在
  // 列表内部，它将定位在列表标记之后）
  this.blkIndent  = 0
  this.line       = 0 // src 中的行索引
  this.lineMax    = 0 // 行数
  this.tight      = false  // 列表的紧密/松散模式
  this.ddIndent   = -1 // 当前 dd 块的缩进（如果没有则为 -1）
  this.listIndent = -1 // 当前列表块的缩进（如果没有则为 -1）

  // 可以是 'blockquote'、'list'、'root'、'paragraph' 或 'reference'
  // 在列表中用于确定它们是否中断段落
  this.parentType = 'root'

  this.level = 0  // 嵌套级别

  // 创建缓存
  // 生成行标记。
  const s = this.src

  // 扫描源代码，建立行标记数组
  for (let start = 0, pos = 0, indent = 0, offset = 0, len = s.length, indent_found = false; pos < len; pos++) {
    const ch = s.charCodeAt(pos)

    if (!indent_found) {
      if (isSpace(ch)) {
        indent++

        if (ch === 0x09) {
          // 制表符按4的倍数对齐
          offset += 4 - offset % 4
        } else {
          offset++
        }
        continue
      } else {
        indent_found = true
      }
    }

    // 遇到换行符或文件结束时，记录行信息
    if (ch === 0x0A || pos === len - 1) {
      if (ch !== 0x0A) { pos++ }  // 确保包含最后一个字符
      this.bMarks.push(start)     // 行开始位置
      this.eMarks.push(pos)       // 行结束位置
      this.tShift.push(indent)    // 第一个非空格字符的位置
      this.sCount.push(offset)    // 缩进量
      this.bsCount.push(0)        // 虚拟空格数

      // 重置状态为下一行
      indent_found = false
      indent = 0
      offset = 0
      start = pos + 1
    }
  }

  // 推送虚假条目以简化缓存边界检查
  this.bMarks.push(s.length)
  this.eMarks.push(s.length)
  this.tShift.push(0)
  this.sCount.push(0)
  this.bsCount.push(0)

  this.lineMax = this.bMarks.length - 1 // 不计算最后的虚假行
}

// 向 token 流中推送新 token
//
StateBlock.prototype.push = function (type, tag, nesting) {
  const token = new Token(type, tag, nesting)
  token.block = true  // 标记为块级 token

  if (nesting < 0) this.level-- // 闭合标签
  token.level = this.level      // 设置嵌套级别
  if (nesting > 0) this.level++ // 开放标签

  this.tokens.push(token)
  return token
}

// 检查指定行是否为空行
StateBlock.prototype.isEmpty = function isEmpty (line) {
  return this.bMarks[line] + this.tShift[line] >= this.eMarks[line]
}

// 从指定行开始跳过空行
StateBlock.prototype.skipEmptyLines = function skipEmptyLines (from) {
  for (let max = this.lineMax; from < max; from++) {
    if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) {
      break
    }
  }
  return from
}

// 从给定位置开始跳过空格字符
StateBlock.prototype.skipSpaces = function skipSpaces (pos) {
  for (let max = this.src.length; pos < max; pos++) {
    const ch = this.src.charCodeAt(pos)
    if (!isSpace(ch)) { break }
  }
  return pos
}

// 从给定位置开始反向跳过空格字符
StateBlock.prototype.skipSpacesBack = function skipSpacesBack (pos, min) {
  if (pos <= min) { return pos }

  while (pos > min) {
    if (!isSpace(this.src.charCodeAt(--pos))) { return pos + 1 }
  }
  return pos
}

// 从给定位置开始跳过指定字符
StateBlock.prototype.skipChars = function skipChars (pos, code) {
  for (let max = this.src.length; pos < max; pos++) {
    if (this.src.charCodeAt(pos) !== code) { break }
  }
  return pos
}

// 从给定位置 - 1 开始反向跳过指定字符
StateBlock.prototype.skipCharsBack = function skipCharsBack (pos, code, min) {
  if (pos <= min) { return pos }

  while (pos > min) {
    if (code !== this.src.charCodeAt(--pos)) { return pos + 1 }
  }
  return pos
}

// 从源代码中切取指定行范围的内容
StateBlock.prototype.getLines = function getLines (begin, end, indent, keepLastLF) {
  if (begin >= end) {
    return ''
  }

  const queue = new Array(end - begin)

  // 处理每一行
  for (let i = 0, line = begin; line < end; line++, i++) {
    let lineIndent = 0
    const lineStart = this.bMarks[line]
    let first = lineStart
    let last

    if (line + 1 < end || keepLastLF) {
      // 不需要边界检查，因为我们在尾部有虚假条目
      last = this.eMarks[line] + 1
    } else {
      last = this.eMarks[line]
    }

    // 处理行缩进
    while (first < last && lineIndent < indent) {
      const ch = this.src.charCodeAt(first)

      if (isSpace(ch)) {
        if (ch === 0x09) {
          lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4
        } else {
          lineIndent++
        }
      } else if (first - lineStart < this.tShift[line]) {
        // 修补的 tShift 将字符掩码为看起来像空格（块引用、列表标记）
        lineIndent++
      } else {
        break
      }

      first++
    }

    if (lineIndent > indent) {
      // 部分展开代码块中的制表符，例如 '\t\tfoobar'
      // 当 indent=2 时变成 '  \tfoobar'
      queue[i] = new Array(lineIndent - indent + 1).join(' ') + this.src.slice(first, last)
    } else {
      queue[i] = this.src.slice(first, last)
    }
  }

  return queue.join('')
}

// 重新导出 Token 类以在块规则中使用
StateBlock.prototype.Token = Token

export default StateBlock
