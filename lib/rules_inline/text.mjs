/**
 * 处理纯文本的内联规则
 * 
 * 这个模块负责跳过文本字符，将它们放置到待处理缓冲区中并增加当前位置。
 * 它是所有内联规则中的最后一个，用于处理不被其他规则识别的普通文本。
 * 
 * 特点：
 * - 跳过纯文本直到遇到终止字符
 * - 保留字符：'{}$%@~+=:' 为扩展预留
 * - 识别所有 Markdown 特殊标点符号作为终止字符
 * 
 * @module text
 */

/**
 * 检查字符是否为终止字符
 * 
 * 终止字符包括：
 * - 换行符
 * - 所有 Markdown 特殊标点符号
 * 
 * 注意：不要与"Markdown ASCII 标点符号"混淆
 * 参考：http://spec.commonmark.org/0.15/#ascii-punctuation-character
 * 
 * @param {number} ch - 字符的 Unicode 码点
 * @returns {boolean} 是否为终止字符
 */
function isTerminatorChar (ch) {
  switch (ch) {
    case 0x0A/* \n */:   // 换行符
    case 0x21/* ! */:    // 感叹号
    case 0x23/* # */:    // 井号
    case 0x24/* $ */:    // 美元符号
    case 0x25/* % */:    // 百分号
    case 0x26/* & */:    // 和号
    case 0x2A/* * */:    // 星号
    case 0x2B/* + */:    // 加号
    case 0x2D/* - */:    // 减号
    case 0x3A/* : */:    // 冒号
    case 0x3C/* < */:    // 小于号
    case 0x3D/* = */:    // 等号
    case 0x3E/* > */:    // 大于号
    case 0x40/* @ */:    // 艾特符号
    case 0x5B/* [ */:    // 左方括号
    case 0x5C/* \ */:    // 反斜杠
    case 0x5D/* ] */:    // 右方括号
    case 0x5E/* ^ */:    // 脱字符
    case 0x5F/* _ */:    // 下划线
    case 0x60/* ` */:    // 反引号
    case 0x7B/* { */:    // 左大括号
    case 0x7D/* } */:    // 右大括号
    case 0x7E/* ~ */:    // 波浪号
      return true
    default:
      return false
  }
}

/**
 * 文本处理器主函数
 * 
 * @param {StateInline} state - 内联解析状态对象
 * @param {boolean} silent - 是否为静默模式（仅检查不生成 token）
 * @returns {boolean} 是否成功处理文本
 */
export default function text (state, silent) {
  let pos = state.pos

  // 扫描直到遇到终止字符
  while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) {
    pos++
  }

  // 没有找到任何文本
  if (pos === state.pos) { return false }

  // 将找到的文本添加到待处理缓冲区
  if (!silent) { state.pending += state.src.slice(state.pos, pos) }

  state.pos = pos

  return true
}

// 备选实现，用于内存优化
//
// 性能损失 10%，但允许扩展终止符列表，如果将其放置在
// `ParserInline` 属性中。可能会在某个时候切换到它，
// 因为需要这种灵活性。

/*
var TERMINATOR_RE = /[\n!#$%&*+\-:<=>@[\\\]^_`{}~]/;

module.exports = function text(state, silent) {
  var pos = state.pos,
      idx = state.src.slice(pos).search(TERMINATOR_RE);

  // 第一个字符就是终止符 -> 空文本
  if (idx === 0) { return false; }

  // 没有终止符 -> 文本到字符串结尾
  if (idx < 0) {
    if (!silent) { state.pending += state.src.slice(pos); }
    state.pos = state.src.length;
    return true;
  }

  if (!silent) { state.pending += state.src.slice(pos, pos + idx); }

  state.pos += idx;

  return true;
}; */
