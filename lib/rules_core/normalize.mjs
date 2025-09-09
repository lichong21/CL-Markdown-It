/**
 * 输入字符串标准化
 * 
 * 对输入的原始文本进行标准化处理：
 * 1. 统一换行符为 \n
 * 2. 替换 NULL 字符为替换字符
 * 
 * 参考：https://spec.commonmark.org/0.29/#line-ending
 */

// 匹配所有类型的换行符：\r\n, \r, \n
const NEWLINES_RE  = /\r\n?|\n/g
// 匹配 NULL 字符
const NULL_RE      = /\0/g

export default function normalize (state) {
  let str

  // 标准化换行符，统一转换为 \n
  str = state.src.replace(NEWLINES_RE, '\n')

  // 替换 NULL 字符为 Unicode 替换字符 (U+FFFD)
  str = str.replace(NULL_RE, '\uFFFD')

  state.src = str
}
