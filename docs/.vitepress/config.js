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
    logo: '/assets/logo.jpg',
    sidebar: [
      {
        text: '杂谈',
        items: [
          { text: '英雄联盟语录', link: '/others/英雄联盟语录' },
        ]
      },
      {
        text: '前端',
        items: [
          { text: 'nrm安装过程遇到的问题及解决方案', link: '/front-end/nrm安装过程遇到的问题及解决方案' },
          { text: 'Git实用命令指南', link: '/front-end/Git实用命令指南' },
          { text: '基于SharedWorker的前端项目跨窗口消息通信方案', link: '/front-end/基于SharedWorker的前端项目跨窗口消息通信方案' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/gonghongchen/' }
    ]
  },
  head: [
    [
      'link',
      { rel: 'icon', href: '/assets/logo.jpg' }
    ],
  ]
})
