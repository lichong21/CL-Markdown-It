// markdown-it default options

export default {
  options: {
    // 是否允许在 Markdown 中使用 HTML 标签
    // true: 保留 HTML 标签并渲染
    // false: 将 HTML 标签转义为文本
    html: false,

    // 是否使用 XHTML 风格的自闭合标签
    // true: 使用 <br /> 格式
    // false: 使用 <br> 格式
    xhtmlOut: false,

    // 是否将段落中的换行符转换为 <br> 标签
    // true: 类似 GitHub 风格，软换行变成 <br>
    // false: 遵循标准 Markdown，忽略单个换行
    breaks: false,

    // 代码块语言标识的 CSS 类名前缀
    // 例如：```js 会生成 <pre><code class="language-js">
    langPrefix: 'language-',

    // 是否自动将类似 URL 的文本转换为链接
    // true: 自动检测并转换 URL 为链接
    // false: 保持原样，不自动转换
    linkify: false,

    // 是否启用排版增强功能
    // true: 启用智能引号、破折号等替换
    // false: 保持原始字符不变
    typographer: false,

    // 智能引号替换对，当 typographer 启用时生效
    // 可以是字符串或数组，用于不同语言的引号样式
    // 默认值是英文引号："" 和 ''
    quotes: '\u201c\u201d\u2018\u2019', /* ""'' */

    // 代码高亮函数
    // 接收三个参数：代码内容、语言标识、语言属性
    // 返回 HTML 字符串或空字符串
    // 如果返回值以 <pre 开头，内部包装器会被跳过
    highlight: null,

    // 内部保护机制，递归嵌套限制
    // 防止过度嵌套导致的栈溢出
    maxNesting: 100
  },

  components: {
    core: {},
    block: {},
    inline: {}
  }
}
