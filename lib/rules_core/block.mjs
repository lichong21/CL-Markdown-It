/**
 * 块级解析核心规则
 * 
 * 根据解析模式决定是否进行块级解析：
 * - 如果是内联模式，创建一个 inline 类型的 token
 * - 如果是正常模式，调用块级解析器进行解析
 */
export default function block (state) {
  let token

  // 如果是内联模式，将整个输入内容作为一个内联 token 处理
  if (state.inlineMode) {
    token          = new state.Token('inline', '', 0)
    token.content  = state.src
    token.map      = [0, 1]  // 源码映射：从第0行到第1行
    token.children = []      // 子节点初始化为空数组
    state.tokens.push(token)
  } else {
    // 正常模式下，调用块级解析器进行解析
    state.md.block.parse(state.src, state.md, state.env, state.tokens)
  }
}
