/**
 * 强调类标记的平衡配对处理器
 * 
 * 这个模块负责为每个开始的强调类标记（如 *、_、~）找到匹配的结束标记。
 * 它实现了 CommonMark 规范中的强调处理算法，包括复杂的配对规则和优化。
 * 
 * 主要功能：
 * - 处理强调标记的开启和关闭配对
 * - 实现"三的规则"（rule of 3）
 * - 优化算法确保线性时间复杂度
 * 
 * @module balance_pairs
 */

/**
 * 处理分隔符列表，为开始标记找到匹配的结束标记
 * 
 * @param {Array} delimiters - 分隔符对象数组
 */
function processDelimiters (delimiters) {
  const openersBottom = {}  // 缓存各种标记的最小开始位置，用于优化
  const max = delimiters.length

  if (!max) return

  // headerIdx 是当前分隔符序列的第一个分隔符索引（闭合符所在的序列）
  let headerIdx = 0
  let lastTokenIdx = -2 // 需要一个小于 -1 的值
  const jumps = []      // 跳跃数组，用于优化扫描

  for (let closerIdx = 0; closerIdx < max; closerIdx++) {
    const closer = delimiters[closerIdx]

    jumps.push(0)

    // 标记属于同一个分隔符序列的条件：
    //  - 它们有相邻的 token
    //  - 并且标记相同
    //
    if (delimiters[headerIdx].marker !== closer.marker || lastTokenIdx !== closer.token - 1) {
      headerIdx = closerIdx
    }

    lastTokenIdx = closer.token

    // length 只用于强调特定的"三的规则"
    // 如果未定义（在删除线或第三方插件中），
    // 我们可以默认为 0 来禁用这些检查
    //
    closer.length = closer.length || 0

    if (!closer.close) continue

    // 之前计算的下界（之前的失败记录）
    // 针对每个标记、每个分隔符长度模3的结果，
    // 以及这个闭合符是否也可以是开启符
    // 参考：https://github.com/commonmark/cmark/commit/34250e12ccebdc6372b8b49c44fab57c72443460
    /* eslint-disable-next-line no-prototype-builtins */
    if (!openersBottom.hasOwnProperty(closer.marker)) {
      openersBottom[closer.marker] = [-1, -1, -1, -1, -1, -1]
    }

    const minOpenerIdx = openersBottom[closer.marker][(closer.open ? 3 : 0) + (closer.length % 3)]

    let openerIdx = headerIdx - jumps[headerIdx] - 1

    let newMinOpenerIdx = openerIdx

    for (; openerIdx > minOpenerIdx; openerIdx -= jumps[openerIdx] + 1) {
      const opener = delimiters[openerIdx]

      if (opener.marker !== closer.marker) continue

      if (opener.open && opener.end < 0) {
        let isOddMatch = false

        // 来自规范的规则：
        //
        // 如果其中一个分隔符既可以开启又可以关闭强调，那么
        // 包含开启和关闭分隔符的分隔符序列长度之和
        // 不能是3的倍数，除非两个长度都是3的倍数。
        // 这是"三的规则"，防止 ***foo*** 被解析为 * + **foo** + *
        //
        if (opener.close || closer.open) {
          if ((opener.length + closer.length) % 3 === 0) {
            if (opener.length % 3 !== 0 || closer.length % 3 !== 0) {
              isOddMatch = true
            }
          }
        }

        if (!isOddMatch) {
          // 如果前一个分隔符不能作为开启符，我们可以安全地跳过
          // 在未来检查中的整个序列。这是确保算法具有线性复杂度所必需的
          // （参见 *_*_*_*_*_... 这种病理情况）。
          //
          const lastJump = openerIdx > 0 && !delimiters[openerIdx - 1].open
            ? jumps[openerIdx - 1] + 1
            : 0

          jumps[closerIdx] = closerIdx - openerIdx + lastJump
          jumps[openerIdx] = lastJump

          closer.open  = false  // 这个闭合符不再能作为开启符
          opener.end   = closerIdx  // 标记开启符的匹配闭合符位置
          opener.close = false  // 这个开启符不再能作为闭合符
          newMinOpenerIdx = -1
          // 将下一个 token 视为序列的开始，
          // 这优化了 **<...>**a**<...>** 这种病理情况的跳跃
          lastTokenIdx = -2
          break
        }
      }
    }

    if (newMinOpenerIdx !== -1) {
      // 如果这个分隔符序列的匹配失败了，我们想要为
      // 未来的查找设置下界。这是确保算法具有线性
      // 复杂度所必需的。
      //
      // 详细信息请参见：
      // https://github.com/commonmark/cmark/issues/178#issuecomment-270417442
      //
      openersBottom[closer.marker][(closer.open ? 3 : 0) + ((closer.length || 0) % 3)] = newMinOpenerIdx
    }
  }
}

/**
 * 链接配对的主函数，处理状态中的所有分隔符
 * 
 * @param {StateInline} state - 内联解析状态对象
 */
export default function link_pairs (state) {
  const tokens_meta = state.tokens_meta
  const max = state.tokens_meta.length

  // 处理主分隔符列表
  processDelimiters(state.delimiters)

  // 处理每个 token 的元数据中的分隔符
  for (let curr = 0; curr < max; curr++) {
    if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
      processDelimiters(tokens_meta[curr].delimiters)
    }
  }
}
