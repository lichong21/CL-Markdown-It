/**
 * 辅助函数模块 - 批量导出工具
 * 
 * 这个模块是一个快捷方式，用于批量导出链接解析相关的辅助函数。
 * 包含了解析链接标签、目标地址和标题的核心功能。
 */

// 导入各个链接解析辅助函数
import parseLinkLabel from './parse_link_label.mjs'
import parseLinkDestination from './parse_link_destination.mjs'
import parseLinkTitle from './parse_link_title.mjs'

// 统一导出所有辅助函数
export {
  parseLinkLabel,        // 解析链接标签 [text]
  parseLinkDestination,  // 解析链接目标地址 <url> 或 url
  parseLinkTitle         // 解析链接标题 "title" 或 'title' 或 (title)
}
