// 用于匹配HTML元素的正则表达式

// HTML属性名：字母、下划线或冒号开头，后跟字母、数字、冒号、点或连字符
const attr_name     = '[a-zA-Z_:][a-zA-Z0-9:._-]*'

// 属性值的三种形式
const unquoted      = '[^"\'=<>`\\x00-\\x20]+' // 无引号属性值：不包含引号、等号、尖括号、反引号和控制字符
const single_quoted = "'[^']*'"                 // 单引号属性值
const double_quoted = '"[^"]*"'                 // 双引号属性值

// 属性值模式：匹配上述三种形式中的任意一种
const attr_value  = '(?:' + unquoted + '|' + single_quoted + '|' + double_quoted + ')'

// HTML属性模式：空白字符 + 属性名 + 可选的（空白 + 等号 + 空白 + 属性值）
const attribute   = '(?:\\s+' + attr_name + '(?:\\s*=\\s*' + attr_value + ')?)'

// HTML开放标签：<标签名 + 可选属性 + 可选的自闭合斜杠 + >
const open_tag    = '<[A-Za-z][A-Za-z0-9\\-]*' + attribute + '*\\s*\\/?>'

// HTML关闭标签：</标签名>
const close_tag   = '<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>'
// HTML注释：<!-- 内容 --> 或者 <!-->
const comment     = '<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->'
// XML处理指令：<?xml version="1.0"?> 等
const processing  = '<[?][\\s\\S]*?[?]>'
// HTML声明：<!DOCTYPE html> 等
const declaration = '<![A-Za-z][^>]*>'
// CDATA区块：<![CDATA[ 内容 ]]>
const cdata       = '<!\\[CDATA\\[[\\s\\S]*?\\]\\]>'

// 完整的HTML标签正则表达式：匹配所有类型的HTML标签和结构
const HTML_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + '|' + comment +
                        '|' + processing + '|' + declaration + '|' + cdata + ')')
// 仅匹配开放和关闭标签的正则表达式（不包括注释、处理指令等）
const HTML_OPEN_CLOSE_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + ')')

export { HTML_TAG_RE, HTML_OPEN_CLOSE_TAG_RE }
