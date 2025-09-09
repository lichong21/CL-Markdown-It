/**
 * 文本连接规则
 * 
 * 将原始文本 token 与其他文本合并。
 * 这被设置为单独的规则，为插件提供在文本连接后、转义连接前
 * 运行文本替换的机会。
 * 
 * 例如，`\:)` 不应该被替换为表情符号。
 */

export default function text_join (state) {
  let curr, last
  const blockTokens = state.tokens
  const l = blockTokens.length

  for (let j = 0; j < l; j++) {
    // 只处理 inline 类型的 token
    if (blockTokens[j].type !== 'inline') continue

    const tokens = blockTokens[j].children
    const max = tokens.length

    // 第一步：将 text_special 类型转换为 text 类型
    for (curr = 0; curr < max; curr++) {
      if (tokens[curr].type === 'text_special') {
        tokens[curr].type = 'text'
      }
    }

    // 第二步：合并相邻的文本节点
    for (curr = last = 0; curr < max; curr++) {
      if (tokens[curr].type === 'text' &&
          curr + 1 < max &&
          tokens[curr + 1].type === 'text') {
        // 将两个相邻的文本节点合并
        tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content
      } else {
        // 将非文本节点或不需要合并的文本节点移动到正确位置
        if (curr !== last) { tokens[last] = tokens[curr] }

        last++
      }
    }

    // 调整数组长度，移除已合并的节点
    if (curr !== last) {
      tokens.length = last
    }
  }
}
