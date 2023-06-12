import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "H&C",
  description: "会记录一些值得记录的技术文章、生活分享",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '主页', link: '/' },
    ],

    sidebar: [
      {
        text: '杂谈',
        items: [
          { text: '英雄联盟语录', link: '/英雄联盟语录' },
        ]
      },
      {
        text: '前端技术',
        items: [
          { text: 'nrm安装过程遇到的问题及解决方案', link: '/nrm安装过程遇到的问题及解决方案' },
          { text: '新系统主题切换功能的总结', link: '/新系统主题切换功能的总结' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/gonghongchen/' }
    ]
  }
})
