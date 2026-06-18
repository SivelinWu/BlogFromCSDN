# [测试工具] 你真的会用Charles吗？测试人员必会的Charles 配置

> 原文: https://blog.csdn.net/weixin_42390585/article/details/162090378

> 原创内容，未获授权禁止转载、转发、抄袭。

Charles 很多人都会用，但不少人只停留在“能抓到包”。
真正调接口时，列表里经常是一堆静态资源、OPTIONS、CONNECT、埋点请求。HTTPS 可能还是乱码，手机代理也可能连不上。
这篇不讲复杂原理，只整理一套日常开发和测试够用的 Charles 配置。
重点解决几个问题：
  * HTTPS 看不到明文
  * 手机连代理后没网
  * 抓包列表太乱
  * 只想看业务接口
  * 想 Mock 异常数据
  * 想切换测试环境
  * 想模拟弱网和重放请求


### 配置前先说一句
Charles 配置不是越全越好。
SSL 解密、Map Remote、Rewrite、Repeat Advanced 都会改变请求或影响数据结果。日常调试建议只对测试环境、测试账号、明确业务域名开启，排查完及时关闭对应规则。
尤其是支付、下单、退款、发券这类接口，不要在生产环境随意重放或篡改。
### 1\. 先把基础代理配好
路径：
    
    Proxy -> Proxy Settings
    
Charles 默认代理端口一般是 `8888`。如果端口被占用，可以改成 `8889`、`8090` 这类未占用端口。
如果只是浏览器或手机抓包，一般配置 HTTP Proxy 就够了。部分客户端代理行为比较特殊时，再考虑透明代理或 SOCKS 相关配置，不建议一上来就把所有选项都打开。
另外可以开启系统代理联动，让 Charles 启动时自动接管本机浏览器代理，关闭时自动恢复。这样不用每次手动去系统设置里切代理。
### 2\. 手机抓包不要直接放开所有 IP
路径：
    
    Proxy -> Access Control Settings
    
手机抓包时，经常会遇到手机设置了电脑 IP 和端口，但就是连不上 Charles。
原因通常是 Charles 的访问控制没放行手机。
很多教程会让你直接加：
    
    0.0.0.0/0
    
这个能解决问题，但不建议长期这么配。
更稳的方式是只添加手机 IP，例如：
    
    192.168.1.23
    
或者只添加当前局域网网段：
    
    192.168.1.0/24
    
这样既能抓手机包，也不会把代理暴露给所有可达设备。
### 3\. HTTPS 乱码先处理证书
如果没配 SSL 证书，HTTPS 请求只能看到加密内容。
电脑端可以这样处理：
    
    Help -> SSL Proxying -> Install Charles Root Certificate
    
Mac 上需要到钥匙串里找到 Charles 证书，并设置为始终信任。
Windows 上需要导入到“受信任的根证书颁发机构”。
手机端一般访问：
    
    https://chls.pro/ssl
    
下载并安装证书。
iOS 还需要手动开启完整信任：
    
    设置 -> 通用 -> 关于本机 -> 证书信任设置
    
Android 要注意一点：Android 7 以后，很多 App 默认不信任用户安装的 CA 证书。如果是自己团队的 debug 包，可以通过 `network_security_config` 配置让 App 信任用户证书。生产包不建议这样做。
### 4\. SSL Proxying 不建议长期全局解密
路径：
    
    Proxy -> SSL Proxying Settings
    
开启：
    
    Enable SSL Proxying
    
如果为了快速验证，可以添加：
    
    Host: *
    Port: 443
    
这代表解密所有 HTTPS 域名。
但日常更推荐只添加业务域名，例如：
    
    Host: api.example.com
    Port: 443
    
全局解密虽然方便，但会把很多无关 HTTPS 流量也解开，列表更乱，也容易涉及隐私数据。
如果添加域名后旧连接仍看不到明文，可以重启 App、浏览器，或重新建立连接后再试。
### 5\. 从源头减少无用请求
路径：
    
    Proxy -> Recording Settings
    
这里建议优先做录制过滤，而不是等请求都进来了再筛。
可以在Exclude 里添加一些长期不关注的内容，例如：
    
    *.js
    *.css
    *.png
    *.jpg
    *.gif
    track.*
    
![在这里插入图片描述](/cdn/162090378/8434ece6c0ff4933b675ce76323c9fb6.png)  
![在这里插入图片描述](/cdn/162090378/e971544fe8cd484ab74eab11094b38d3.png)
不同 Charles 版本的配置界面可能不一样。有的版本不是直接粘完整 URL 规则，而是按 `Protocol`、`Host`、`Port`、`Path` 分开填写。
比如过滤 JS，可以理解为：
    
    Host: *
    Path: /*.js
    
过滤规则不是越多越好。
如果当前正在排查前端资源加载问题，就不要过滤 JS、CSS、图片。
核心原则是：只过滤你确定暂时不需要看的流量。
### 6\. 日常临时过滤这样用
Charles 底部 Filter 适合临时调试，如果想只看业务接口，可以点击 Filter 右侧的设置，勾选：
    
    Filter uses regex
    
![在这里插入图片描述](/cdn/162090378/77845a67b0f34b12862b83f9b116e234.png)
然后在 Filter 输入框里填：
    
    GET|POST|PUT|DELETE|PATCH
    
这样可以只展示常见业务请求方法，过滤掉 OPTIONS、CONNECT 这类无关请求。
注意，这种方式是按文本匹配过滤视图，不是删除请求记录。如果要从源头减少录制，还是应该用 `Recording Settings`。
如果只想看某个域名，最简单的是右键目标接口，选择：
    
    Focus
    
再勾选上方的 `Focused`。
这样只看当前业务域名，排查单个功能会清爽很多。
### 7\. Map Local：本地 Mock 返回
Map Local 适合模拟接口返回。
比如后端还没开发完，或者你想测空数据、异常状态、超长列表，可以准备一个本地 JSON 文件，然后把接口响应映射到这个文件。
操作方式：
    
    右键接口 -> Map Local
    
常见用法：
  * 空列表
  * 接口报错
  * 超长数据
  * 字段缺失
  * 状态异常
  * 金额边界


注意，Map Local 返回的是本地文件内容，不会执行服务端脚本。动态逻辑更适合用测试服务或 Map Remote。
### 8\. Map Remote：切换接口环境
Map Remote 适合把线上域名转到测试环境或预发环境。
路径：
    
    Tools -> Map Remote
    
示例：
    
    From: https://api.prod.example.com/*
    To:   https://api.test.example.com/*
    
这样客户端不用重新打包，也能把请求转到测试环境。
这个功能很适合排查：
  * 线上页面接测试接口
  * App 包不方便切环境
  * H5 页面需要临时验证测试服务


但要注意，Map Remote 会改变真实请求去向。只建议在测试账号、测试数据、明确授权的场景下使用，不要在真实支付、真实下单、真实退款链路上随意转发环境。
### 9\. Rewrite：批量改请求和响应
路径：
    
    Tools -> Rewrite
    
Rewrite 适合做规则化修改。
常见场景：
  * 给请求自动加 Header
  * 修改 Authorization 或设备信息
  * 替换响应里的某个字段
  * 把正常响应改成异常结构
  * 把接口返回改成空数据
  * 修改状态码测试前端容错


比如测试前端异常提示，不是把 `500` 改成 `200`，而是更常见地把正常响应改成：
    
    500
    403
    空数组
    字段缺失
    错误码
    超长文案
    
Rewrite 规则建议先小范围匹配，不要一开始就全局生效，否则很容易改到不该改的接口。
### 10\. Breakpoints：临时改一次请求或响应
Breakpoints 适合单次临时调试。
操作：
    
    Proxy -> Enable Breakpoints
    
然后选择某个接口，右击，选择break point  
![在这里插入图片描述](/cdn/162090378/7d85dcdcbdfe4c0d8824db9b7fe3055f.png)  
然后进入
    
    Proxy -> Breakpoints Settings
    
选择具体的拦截细节：  
![在这里插入图片描述](/cdn/162090378/23d56d855fba4d4bbebc24c2328f90d6.png)
它可以在请求发出前或响应返回前暂停，让你手动修改内容。
适合测试：
  * 修改请求参数
  * 修改 Header
  * 修改响应字段
  * 构造边界值
  * 临时验证前端展示逻辑


如果是一次性调试，用 Breakpoints。
如果是长期规则，用 Rewrite。
### 11\. Throttle：模拟弱网
路径：
    
    Proxy -> Throttle Settings
    
Throttle 可以限制带宽和增加延迟，用来模拟弱网。
常见测试点：
  * 页面加载是否有兜底
  * 接口超时是否提示
  * 请求失败是否重试
  * 按钮是否防重复提交
  * 弱网下订单状态是否一致


可以使用预设网络，也可以自定义带宽、延迟。
如果只想影响某些接口，建议配置范围，不要全局限速太久。
### 12\. Repeat：重放接口
Charles 里选中请求后，可以使用：
    
    Repeat
    Repeat Advanced
    
`Repeat` 适合单次重放，验证接口幂等、重复提交、状态变化。
`Repeat Advanced` 可以配置次数和并发，适合做轻量并发验证。
但它不是专业压测工具，不能替代 JMeter、k6、Locust 这类工具。
注意不要对生产接口随便做并发重放，尤其是支付、下单、退款、发券这类接口。
### 13\. OPTIONS 和 CONNECT 怎么看
很多人看到 OPTIONS、CONNECT 会疑惑。
`OPTIONS` 通常是浏览器跨域预检请求。不是所有请求都会有，主要出现在跨域非简单请求场景。大多数业务调试里可以先过滤掉，但如果你正在排查跨域问题，就要保留。
`CONNECT` 是 HTTPS 代理建立隧道时产生的请求。它不是业务接口，没有业务参数。日常调试接口时，一般可以过滤或不录制。
### 推荐默认配置
我建议日常这样配：
    
    1. 只信任必要设备，不长期使用 0.0.0.0/0
    2. SSL Proxying 只配置业务域名，不长期全局 *
    3. Recording 里过滤静态资源和埋点请求
    4. Filter 勾选 Filter uses regex，临时使用 GET|POST|PUT|DELETE|PATCH
    5. 用 Focus 聚焦当前业务域名
    6. Map Local 用来 Mock 返回
    7. Map Remote 用来切环境
    8. Rewrite 用来批量改请求和响应
    9. Breakpoints 用来单次临时篡改
    10. Throttle 用来测弱网和超时
    
### 总结
Charles 的价值不只是抓包。
更重要的是：
  * 把无效流量过滤掉
  * 把 HTTPS 明文看清楚
  * 把接口环境切方便
  * 把异常数据 Mock 出来
  * 把弱网和重放场景测起来


默认配置能抓包。
但配置好以后，才真正适合日常接口调试和问题排查。
