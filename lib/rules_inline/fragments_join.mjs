/**
 * 强调和删除线后处理后的 token 清理器
 * 
 * 这个模块负责：
 * 1. 合并相邻的文本节点为一个
 * 2. 重新计算所有 token 的层级
 * 
 * 这是必要的，因为最初强调分隔符标记（*、_、~）
 * 被视为独立的文本 token。然后强调规则要么
 * 将它们保留为文本（需要与相邻文本合并），要么将它们
 * 转换为开启/关闭标签（这会搞乱内部层级）。
 * 
 * @module fragments_join
 */

/**
 * 片段连接器主函数
 * 
 * @param {StateInline} state - 内联解析状态对象
 */
export default function fragments_join (state) {
  let curr, last
  let level = 0
  const tokens = state.tokens
  const max = state.tokens.length

  for (curr = last = 0; curr < max; curr++) {
    // 在强调/删除线将一些文本节点转换为开启/关闭标签后重新计算层级
    if (tokens[curr].nesting < 0) level-- // 关闭标签
    tokens[curr].level = level
    if (tokens[curr].nesting > 0) level++ // 开启标签

    if (tokens[curr].type === 'text' &&
        curr + 1 < max &&
        tokens[curr + 1].type === 'text') {
      // 合并两个相邻的文本节点
      tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content
    } else {
      if (curr !== last) { tokens[last] = tokens[curr] }

      last++
    }
  }

  // 如果有 token 被合并，调整数组长度
  if (curr !== last) {
    tokens.length = last
  }
}
