# 基于 SharedWorker 的前端项目跨窗口消息通信方案

## 现状
目前我所在团队的前端项目目前使用的双窗口消息通信方案是 eventBus + localStroage，eventBus 本身是用于做全局事件管理的，localStroage 用于同源策略下的数据存储共享，通过二者的结合可以做到夸窗口的消息通信，核心逻辑在于代码层面可以监听到 localStroage 的变化，只要使用 eventBus 触发事件后将事件信息存储到 localStroage 中，那各个监听了该事件的窗口都会做出响应。这种实现方式的问题在于：1. 实现逻辑是比较绕的，不够直接，也不是浏览器本身的通信方式，算是一种特殊实现；2. 进行跨窗口消息通信时，其实所有窗口都会监听到该事件，只有注册过该事件的才会响应而已，所以本质上没有一对一通信的能力，只能是一对多的消息通信，会造成资源浪费；3. 将全局事件管理和夸窗口通信功能糅合在了一起，容易出现理解不清晰、使用混乱的情况；4. 目前无法实现跨窗口的更加高级的功能需求。

## 新方案
浏览器本身提供了三种跨窗口通信方案，如下：
* [postMessage](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/postMessage)：使用简单，可跨域，可以实现消息的一对一通信，没有广播机制；
* [Broadcast Channel API](https://developer.mozilla.org/zh-CN/docs/Web/API/Broadcast_Channel_API)：使用简单，可以用于广播，没有单播能力；
* [SharedWorker](https://developer.mozilla.org/zh-CN/docs/Web/API/SharedWorker)：实现相对复杂，既可广播也可以单播，基于一个独立的线程实现，可扩展性也更强。

针对现有方案的现状和浏览器提供的三种通信 API 的能力综合来看，基于 SharedWorker 可以实现更完善的通信能力，新方案实现的核心功能如下：
1. 支持广播（所有窗口都可以接收到消息）和纯粹的单播（窗口A给窗口B发，窗口B给窗口A发）；
2. 支持消息队列，即使在窗口A给窗口B发消息时该窗口未打开或处于打开中也依旧可以发消息，待窗口B打开后会依次收到消息；
3. 支持消息回调，例如窗口A给窗口B发消息并携带 callBack，窗口B通过调用 callBack() 实现回调窗口A的功能，且回调支持任意入参。

核心代码实现包含两部分，一部分是公共 worker 的代码，用于实现连接处理和消息转发，相当于一个控制中心，这部分代码也同时实现了消息单播和广播、以及消息队列的处理。代码如下（worker.ts）：
```js
// 注：这个脚本需要通过在 Chrome 浏览器地址栏打开 chrome://inspect/#workers 进行调试

// 存储所有建立连接的 worker
const workers = {}
const handleMessage = (data) => {
  const { target, message } = data

  if (target) {
    // 消息单播
    workers[target] = workers[target] || {}
    if (workers[target].port) {
      // 目标窗口存在时直接发送消息
      workers[target].port.postMessage(message)
    } else {
      // 目标窗口不存在时先将消息存入消息队列
      workers[target].msgList?.push(data) || (workers[target].msgList = [data])
    }
    return
  }
  // 消息广播（暂未实现消息队列机制，目前实际场景还用不到）
  Object.values(workers).forEach((worker: any) => worker.port.postMessage(message))
}

(self as any).onconnect = function(e) {
  const port = e.ports[0] as any

  port.onmessage = function(event) {
    const { type, target } = event.data

    if (type === 'init') {
      workers[target] = workers[target] || {}
      workers[target].port = port

      // 窗口初始化后处理消息队列
      const { msgList } = workers[target] || {}
      // 若消息队列不为空则按消息到达时间的先后顺序依次发送出去
      while (msgList && msgList.length !== 0) {
        const msg = msgList.shift()
        handleMessage(msg)
      }
      return
    } else if (type === 'destory') {
      Reflect.deleteProperty(workers, target)
      return
    }
    handleMessage(event.data)
  }
}
```

另一部分则是与业务侧使用相关的，实现了窗口 worker 的初始化、销毁、消息发送、消息接收处理、消息回调处理（需要注意的是，由于函数本身是没办法进行跨窗口传输、拷贝的，所以消息回调的实现本质是通过先在发送消息方缓存回调，然后在接收消息方重写回调为一个携带了入参信息的特定消息，执行回调时会发送该消息，最后发送方收到该消息后就会执行缓存中的回调）的功能。代码如下（sharedWorker.ts）：
```js
interface SendMsg {
  type?: 'init' | 'destory', // 消息类型，init 表示初始化窗口标识，destory 表示销毁已有的窗口对象，为空时表示发送消息
  target?: string, // 消息接收对象，可以指定要将消息发送给哪个窗口，如果不指定则进行消息广播。例如窗口A定义为：windowA，窗口B定义为：windowB。
  message?: ReceiveMsg, // 消息内容
}

interface ReceiveMsg {
  type: string, // 消息内容的类型，用这个值区分具体要对消息做什么操作
  callBack?: (...args: any) => any, // 回调函数，入参可以有任意多个
  [key: string]: any, // 消息内容的额外自定义数据
}

// 使用示例
const setTheme = (theme, callBack) => {
  console.log(theme)
  callBack('我要传一段文字过去')
}

const sharedWorker = {
  worker: null as any, // 当前窗口的 worker
  curTarget: '', // 当前窗口的 target
  callBackMap: {}, // 回调函数集合

  // 初始化 worker
  init(target) {
    this.worker = new SharedWorker(new URL('./worker.ts', import.meta.url))
    this.curTarget = target
    this.worker.port.onmessage = event => {
      this.onMessage(event.data)
    }
    // 初始化窗口标识
    this.sendMessage({
      type: 'init',
      target,
    })

    return this
  },
  // 注销 worker
  destory(target) {
    // 销毁窗口标识
    this.sendMessage({
      type: 'destory',
      target,
    })

    return this
  },
  // 接收消息
  onMessage(message: ReceiveMsg) {
    let { originTarget, originType, type, hasCallBack, ...data } = message
    let callBack = (args) => args

    if (hasCallBack && type !== 'EXECUTE_CALLBACK') {
      // 重写 callBack
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      callBack = (...args) => {
        this.sendMessage.bind(this, {
          target: originTarget,
          message: {
            originType: type,
            type: 'EXECUTE_CALLBACK',
            ...args
          }
        })()
      }
    }

    // 注意！！！为了避免这个方法里面包含大量的业务逻辑代码，规定每条 case 只能包含一条语句，具体的业务逻辑处理需要交给独立的方法来实现。
    // 在跨窗口通信需要使用回调的情况下，请将 callBack 方法传入自己的业务方法里面调用，比如：setTheme(data.theme，callBack)，
    // 然后在 setTheme 内调用 callBack('str', 0, false, [], {}) 即可，入参根据回调定义的来传参。
    switch (type) {
      // 窗口A功能写在这下面：

      // 窗口B功能写在这下面：
      case 'SWITCH_THEME_COLOR': // 自定义类型的示例
        setTheme(data.theme，callBack)
        break
      // 公用功能写在这下面：
      case 'EXECUTE_CALLBACK':
        this.callBackMap[originType](...Object.values(data))
        break
      default:
        break
    }

    return this
  },
  sendMessage(data: SendMsg) {
    const { message } = data
    const { type, callBack, ...extra } = message || {}

    if (callBack) {
      this.callBackMap[type as string] = callBack.bind(null)
      Object.assign(data, {
        message: {
          type,
          hasCallBack: true,
          originTarget: this.curTarget,
          ...extra
        }
      })
    }

    this.worker.port.postMessage(data)
    return this
  }
}

export default sharedWorker
```

# 使用
1. 初始化：在合适的地方（比如项目主入口文件 App.vue 的 onMounted 里面）调用下面这个方法。
    ```js
    sharedWorker.init('windowA')
    ```
2. 销毁：往往在关闭窗口（比如监听 window 的 unload 方法）的时候需要调用下面的方法把该窗口对应的 worker 清理掉，以防出现重复的 worker 导致程序执行异常。
    ```js
    sharedWorker.destory('windowA')
    ```
3. 发消息：调用 sendMessage 方法即可，下面是一个完整的例子。
    ```js
    sharedWorker.sendMessage({
      target: 'windowB',
      message: {
        type: 'SWITCH_THEME_COLOR',
        theme: type,
        callBack: (...args) => {
          console.log(11111111, '我安安静静的输出一条log信息，后面是回调执行时传过来的参数：', ...args)
        }
      },
    })
    ```
4. 接收消息：接收的消息都统一在 onMessage 里面进行管理，针对每个 case 进行对应的业务逻辑处理即可。
  