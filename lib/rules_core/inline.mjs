/**
 * 内联解析核心规则
 * 
 * 遍历所有 token，找到类型为 'inline' 的 token，
 * 并对其内容进行内联解析，将解析结果存储到 token 的 children 中
 */
export default function inline (state) {
  const tokens = state.tokens

  // 解析内联元素
  for (let i = 0, l = tokens.length; i < l; i++) {
    const tok = tokens[i]
    // 只处理 inline 类型的 token
    if (tok.type === 'inline') {
      // 调用内联解析器解析 token 内容，结果存储在 token 的 children 中
      state.md.inline.parse(tok.content, state.md, state.env, tok.children)
    }
  }
}
