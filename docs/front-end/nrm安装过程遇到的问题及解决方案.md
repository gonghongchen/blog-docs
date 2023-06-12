# nrm 安装过程遇到的问题及解决方案

* 直接使用 `npm install nrm -g` 安装后，使用 `nrm` 命令报下面这样的错：
  ```sh
  /Users/gonghongchen/npm_global/lib/node_modules/nrm/cli.js:9
  const open = require('open');
              ^
  Error [ERR_REQUIRE_ESM]: require() of ES Module……
  ```
  这个错误是 `open` 版本过高使用了 ES Module 规范的语法导致的，所以安装命令改成下面这个即可：
  ```sh
  npm install nrm open@8.4.2 -g
  ```

* 安装 `nrm` 后，使用 `nrm list` 不会用 `*` 号标识出当前使用的源，使用 `nrm current` 也不会输出当前使用的源信息？

  解决方案是：
  1. 找到 `nrm` 的安装目录，全局安装的话可以使用命令 `npm root -g` 查看 `npm` 的安装路径，比如我的就是：`/Users/gonghongchen/npm_global/lib/node_modules`
  2. 然后进入到 `npm` 的安装路径后，就可以看到所有全局安装的包了，然后再进入 `nrm` 目录下，可以看到有个 `cli.js` 文件
  3. 通过 `vim cli.js` 命令编辑文件，输入 `i` 指令进入编辑模式，找到 `onList` 方法，改一下这句代码：
      ```js
      var prefix = item[FIELD_IS_CURRENT] && equalsIgnoreCase(item.registry, cur) ? '* ' : '  ';
      // 把 && 改为 ||：
      var prefix = item[FIELD_IS_CURRENT] || equalsIgnoreCase(item.registry, cur) ? '* ' : '  ';
      ```
      然后就一切OK了。需要注意的是，随着代码版本的变更，可能上面这句代码也会有更改，如果你的版本里面找不到一模一样的这句代码，那就找找类似的代码语句，然后按照这个思路改一下即可。