/**
 * 处理强调标记 *this* 和 _that_ 的内联规则
 * 
 * 这个模块负责处理 Markdown 中的强调（emphasis）和加强（strong）语法：
 * - 单个 * 或 _ 用于斜体强调：*italic* 或 _italic_
 * - 双个 ** 或 __ 用于粗体加强：**bold** 或 __bold__
 * 
 * 实现了两阶段处理：
 * 1. tokenize: 扫描和标记强调分隔符
 * 2. postProcess: 将配对的分隔符转换为强调标签
 * 
 * @module emphasis
 */

/**
 * 强调标记的词法分析阶段
 * 将每个标记作为单独的文本 token 插入，并添加到分隔符列表中
 * 
 * @param {StateInline} state - 内联解析状态对象
 * @param {boolean} silent - 是否为静默模式（仅检查不生成 token）
 * @returns {boolean} 是否成功解析强调标记
 */
function emphasis_tokenize (state, silent) {
  const start = state.pos
  const marker = state.src.charCodeAt(start)

  if (silent) { return false }

  // 只处理 _ 和 * 字符
  if (marker !== 0x5F /* _ */ && marker !== 0x2A /* * */) { return false }

  // 扫描分隔符，* 可以分割单词，_ 不能
  const scanned = state.scanDelims(state.pos, marker === 0x2A)

  // 为每个标记字符创建一个文本 token
  for (let i = 0; i < scanned.length; i++) {
    const token = state.push('text', '', 0)
    token.content = String.fromCharCode(marker)

    // 将分隔符信息添加到分隔符列表中
    state.delimiters.push({
      // 开始标记的字符代码（数字）
      //
      marker,

      // 这个分隔符序列的总长度
      //
      length: scanned.length,

      // 这个分隔符对应的 token 位置
      //
      token: state.tokens.length - 1,

      // 如果这个分隔符匹配为有效的开启符，`end` 将等于
      // 其位置，否则为 `-1`
      //
      end: -1,

      // 确定这个分隔符是否可以开启或关闭强调的布尔标志
      //
      open: scanned.can_open,
      close: scanned.can_close
    })
  }

  state.pos += scanned.length

  return true
}

/**
 * 后处理阶段：将配对的分隔符转换为强调标签
 * 
 * @param {StateInline} state - 内联解析状态对象
 * @param {Array} delimiters - 分隔符数组
 */
function postProcess (state, delimiters) {
  const max = delimiters.length

  // 从后往前处理，这样可以处理嵌套的强调
  for (let i = max - 1; i >= 0; i--) {
    const startDelim = delimiters[i]

    // 只处理强调标记 _ 和 *
    if (startDelim.marker !== 0x5F/* _ */ && startDelim.marker !== 0x2A/* * */) {
      continue
    }

    // 只处理开启标记（已经找到配对的）
    if (startDelim.end === -1) {
      continue
    }

    const endDelim = delimiters[startDelim.end]

    // 如果前一个分隔符具有相同的标记并且与这个相邻，
    // 将它们合并为一个加强分隔符。
    //
    // `<em><em>whatever</em></em>` -> `<strong>whatever</strong>`
    //
    const isStrong = i > 0 &&
               delimiters[i - 1].end === startDelim.end + 1 &&
               // 检查前两个标记匹配且相邻
               delimiters[i - 1].marker === startDelim.marker &&
               delimiters[i - 1].token === startDelim.token - 1 &&
               // 检查后两个标记相邻（我们可以安全地假设它们匹配）
               delimiters[startDelim.end + 1].token === endDelim.token + 1

    const ch = String.fromCharCode(startDelim.marker)

    // 修改开始 token
    const token_o   = state.tokens[startDelim.token]
    token_o.type    = isStrong ? 'strong_open' : 'em_open'
    token_o.tag     = isStrong ? 'strong' : 'em'
    token_o.nesting = 1
    token_o.markup  = isStrong ? ch + ch : ch
    token_o.content = ''

    // 修改结束 token
    const token_c   = state.tokens[endDelim.token]
    token_c.type    = isStrong ? 'strong_close' : 'em_close'
    token_c.tag     = isStrong ? 'strong' : 'em'
    token_c.nesting = -1
    token_c.markup  = isStrong ? ch + ch : ch
    token_c.content = ''

    if (isStrong) {
      // 如果是加强标记，清空相邻的标记内容
      state.tokens[delimiters[i - 1].token].content = ''
      state.tokens[delimiters[startDelim.end + 1].token].content = ''
      i-- // 跳过已处理的分隔符
    }
  }
}

/**
 * 遍历分隔符列表并将文本 token 替换为标签
 * 
 * @param {StateInline} state - 内联解析状态对象
 */
function emphasis_post_process (state) {
  const tokens_meta = state.tokens_meta
  const max = state.tokens_meta.length

  // 处理主分隔符列表
  postProcess(state, state.delimiters)

  // 处理每个 token 元数据中的分隔符
  for (let curr = 0; curr < max; curr++) {
    if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
      postProcess(state, tokens_meta[curr].delimiters)
    }
  }
}

/**
 * 强调处理器的导出对象
 * 包含词法分析和后处理两个阶段的函数
 */
export default {
  tokenize: emphasis_tokenize,
  postProcess: emphasis_post_process
}
