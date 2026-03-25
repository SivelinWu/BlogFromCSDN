# [测试技术] AI驱动零代码UI自动化测试-Midscene.js实操

> 原文: https://blog.csdn.net/weixin_42390585/article/details/158495878

> *原创内容，未获授权禁止转载、转发、抄袭。
### 一、什么是Midscene.js
UI自动化领域长期受困于“定位元素-编写指令-调试适配”的繁琐流程，CSS选择器、XPath定位易因页面微调失效，维护成本高。Midscene.js以“Joyful Automation by AI”为核心，是AI视觉语言模型驱动的全平台UI自动化SDK，核心优势是让开发者用自然语言就能操控界面。
Midscene.js核心是“视觉驱动全平台自动化工具”，不依赖DOM解析，通过截图识别UI元素、完成交互。覆盖Web、Android、iOS及自定义界面，彻底解决传统自动化跨平台适配难、定位不稳定的痛点。
<https://midscenejs.com/zh/introduction.html>
### 二、功能特性
#### 1、用自然语言编写自动化脚本
  * 描述你的目标和步骤，Midscene 会为你规划和操作用户界面。
  * 使用 JavaScript SDK 或 YAML 格式编写自动化脚本。


#### 2、Web & Mobile App & 任意界面
  * 网页自动化：可以与 Puppeteer 集成，与 Playwright 集成或使用桥接模式来控制桌面浏览器。
  * Android 自动化：使用 JavaScript SDK 配合 adb 来控制本地 Android 设备。
  * iOS 自动化：使用 JavaScript SDK 配合 WebDriverAgent 来控制本地 iOS 设备与模拟器。
  * 任意界面自动化：使用 JavaScript SDK 来控制你自己的界面。


#### 3、面向开发者
  * 三种类型的 API:
    * 交互 API: 与用户界面交互。
    * 数据提取 API: 从用户界面和 DOM 中提取数据。
    * 实用 API: 实用函数，如 `aiAssert()` （断言）, `aiLocate()` （定位）, `aiWaitFor()` （等待）。
  * MCP: Midscene 提供 MCP 服务，将 Midscene Agent 的原子操作暴露为 MCP 工具，上层 Agent 可以用自然语言检查和操作界面。
  * 使用缓存，提高执行效率: 使用缓存能力重放脚本，提高执行效率。
  * 调试体验: Midscene.js 提供可视化回放报告、内置 Playground 和 Chrome 插件，帮助开发者更高效地定位与排障。


### 三、安装&使用
##### 1、Chrome插件
想通过Midscene.js Chrome插件快速体验AI测试的话，我们需要先前往Chrome扩展商店安装 Midscene扩展。
![](https://i-blog.csdnimg.cn/direct/0aa820a4786a42f1a7b6dec6b83491c0.png)
插件安装完毕后记得在扩展管理中开启。
![](https://i-blog.csdnimg.cn/direct/9ff094f5b45a45af80316953684de2cd.png)
然后点击浏览器中插件图标就可以看到弹出一个Midscene.js的侧边栏
![](https://i-blog.csdnimg.cn/direct/b6f76698958e4b7ab7961c623ab93670.png)
但此时还不能直接使用，还需要对使用的AI大模型进行配置，点击左上角的设置图标
![](https://i-blog.csdnimg.cn/direct/d47ab45faf29479f8aa453c134aa2856.png)
配置其他大模型请参考：[常见模型配置](https://midscenejs.com/zh/model-common-config.html "常见模型配置")
配置完成后，你可以立即开始体验 Midscene了！
它提供了多个关键操作 Tab：
  * Act: 与网页进行交互，这就是自动规划（Auto Planning），对应于 `aiAct` 方法。比如


    
    在搜索框中输入 Midscene，执行搜索，跳转到第一条结果
    
    填写完整的注册表单，注意主要让所有字段通过校验
  * Query: 从界面中提取 JSON 结构的数据，对应于 `aiQuery` 方法。


类似的方法还有 `aiBoolean()`, `aiNumber()`, `aiString()`，用于直接提取布尔值、数字和字符串。
    
    提取页面中的用户 ID，返回 { id: string } 结构的 JSON 数据
  * Assert: 理解页面，进行断言，如果不满足则抛出错误，对应于 `aiAssert` 方法。


    
    页面上存在一个登录按钮，它的下方有一个用户协议的链接
  * Tap: 在某个元素上点击，这就是即时操作（Instant Action），对应于 `aiTap` 方法。


    
    点击登录按钮
下面以打开百度进行搜索为例：
![](https://i-blog.csdnimg.cn/direct/6c6b29cd220f4309b90f6e288e0e0241.png)
![](https://i-blog.csdnimg.cn/direct/34100b0c92e14d21a1fe4d52bbdf82da.png)
![](https://i-blog.csdnimg.cn/direct/c94e21fd8fbe4105824c1f27b9d7ee2f.png)
LLM会根据我们的语义拆分任务，然后通过视觉模型识别网页进行操作。**全程无需写一行代码。**
##### 2、YAML 脚本运行器
Midscene 定义了一种 YAML 格式的脚本，方便开发者快速编写自动化脚本，并提供了对应的命令行工具来快速执行这些脚本。
首先安装@midscene/cli
    
    npm i -g @midscene/cli
其次，创建.env文件，进行配置
    
    MIDSCENE_MODEL_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
    # 替换成自己的API KEY
    MIDSCENE_MODEL_API_KEY="sk-abcdefghijklmnopqrstuvwxyz"
    MIDSCENE_MODEL_NAME="qwen3-vl-plus"
    MIDSCENE_MODEL_FAMILY="qwen3-vl"
然后，创建myFirstTest.yaml文件
    
    web:
      url: https://www.bing.com
    
    tasks:
      - name: 搜索天气
        flow:
          - ai: 搜索 "今日天气"
          - sleep: 3000
          - aiAssert: 结果显示天气信息
最后，通过一条命令来执行它
    
    midscene ./myFirstTest.yaml
命令行会输出执行进度，并在完成后生成可视化报告。整个运行过程大幅简化了开发者做环境配置的复杂度。
如下是执行窗口：
![](https://i-blog.csdnimg.cn/direct/5037749a1f7a4e0ab0376ebb7037f4de.png)
如下是报告视图：
![](https://i-blog.csdnimg.cn/direct/57bcbb0efcb145abb370340b56c95c93.png)
### 四、更多进阶用法
另外Midscene.js还支持参数化、集成到Playwright、集成到Puppeteer、桥接到Chrome、Android 自动化、iOS 自动化等丰富功能，详细内容请查看：<https://midscenejs.com/zh/android-introduction.html>
### 五、总结
##### 1、使用场景
Midscene.js的低门槛、全平台特性，使其适用人群与场景广泛，个人开发者与企业团队均可受益：
  1. 测试工程师：适配UI自动化测试，尤其跨平台、动态页面测试，提升脚本稳定性与开发效率，减少重复劳动；
  2. 前端开发者：用于页面交互、动态页面爬取、业务流程自动化，节省开发测试时间；
  3. 非技术人员：通过Chrome扩展等零代码方式，无需编程即可完成简单自动化操作，验证业务流程；
  4. 企业团队：可搭建统一跨平台自动化体系，降低团队学习与维护成本，适配多端协同业务场景。


其已落地GitHub表单注册、多端订单操作、Web数据提取等真实场景，适配性与实用性已得到验证。
##### 2、问题和短板
  1. AI依赖度高，受模型性能影响大，token消耗大
Midscene.js核心依赖视觉语言模型完成元素识别与指令解析，模型的性能直接决定操作准确性。若使用免费或轻量模型，在复杂界面（如元素密集、样式相似、存在遮挡）中，可能出现定位偏差、指令误解的情况；若选用高精度模型（如GPT-4o），则会增加AI调用成本，尤其批量执行脚本时，成本优势不明显。
  2. 执行速度略逊于传统自动化工具
相较于传统基于DOM定位的自动化工具（如Selenium），Midscene.js的纯视觉定位流程更复杂——需先截图、再由AI识别、最后执行操作，每一步都存在一定耗时。在简单界面、高频重复操作场景中，执行速度差距不明显，但在复杂流程、大量元素交互场景中，速度劣势会有所凸显。
  3. 复杂场景适配不足
对于部分特殊场景，Midscene.js的适配能力仍有提升空间。例如，处理动态变化极快的界面（如实时刷新的数据流页面）时，AI识别可能跟不上元素变化节奏；面对无明显视觉特征的界面（如纯文本、无图标按钮的极简界面），定位准确率会下降；此外，对原生应用的深度交互（如手机权限弹窗、系统级操作）的支持不够完善。
  4. 开源生态尚不成熟


相较于Selenium、Playwright等成熟工具，Midscene.js发布时间较短，开源社区规模较小，可用的第三方插件、教程资源、问题解决方案相对有限。若遇到特殊需求或bug，开发者可能需要自行调试源码，对技术能力有一定要求，新手排查问题的难度较高。
总体而言，Midscene.js的优势适合解决传统自动化的核心痛点，但需正视其局限，根据场景选择——简单场景、跨平台需求、低代码需求优先考虑，复杂高频场景则需权衡速度与成本后决策。
