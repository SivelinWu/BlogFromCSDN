# [自动化测试] Playwright MCP实战：让AI直接操作浏览器做测试

> 原文: https://blog.csdn.net/weixin_42390585/article/details/161119512

> 原创内容，未获授权禁止转载、转发、抄袭。
> 本文写于 2026-05-15，Playwright MCP 还在快速迭代，具体命令和配置以后可能会变化，建议以官方文档为准。

![在这里插入图片描述](/cdn/161119512/67344ff23b9f45f8afb4cff34c450272.png)
最近我在折腾 AI 测试工具时，发现 Playwright MCP 这个东西挺值得测试同学关注。
以前我们让 AI 写 UI 自动化脚本，大概是这样：
把页面描述、DOM、截图、需求丢给 AI，然后让它猜页面怎么点、按钮叫什么、断言怎么写。
结果经常会出现几个问题：
  * AI 猜了一个不存在的选择器
  * 页面实际文案和它想的不一样
  * XPath 写得又长又脆
  * 脚本看起来能跑，但一执行就挂
  * 它根本没看过真实页面，只是在脑补


Playwright MCP 的思路不一样。
它相当于给 AI 接了一个真实浏览器，让 AI 能够：
  * 打开页面
  * 读取页面结构
  * 点击按钮
  * 输入内容
  * 查看跳转结果
  * 截图
  * 看网络请求
  * 再根据真实页面生成 Playwright 脚本


这篇就用一个实际测试场景，记录一下怎么用 Playwright MCP 做测试。
* * *
### 一、Playwright MCP 是什么
简单说，Playwright MCP 是一个 MCP Server。
MCP 可以理解成一套协议，让 AI 工具可以调用外部能力。  
Playwright MCP 提供的外部能力就是：**操作浏览器** 。
它不是让 AI 看一张截图瞎猜，而是让 AI 通过 Playwright 拿到页面的可访问性快照，也就是页面上有哪些按钮、输入框、链接、文本。
比如一个页面可能会被它读取成类似这样：
    
    - heading "优惠券活动" [level=1]
    - button "立即领取" [ref=e12]
    - text "满 100 减 20"
    - link "我的券包" [ref=e18]
    
AI 看到这个结构后，就可以用 `ref=e12` 去点击“立即领取”按钮。
这比让 AI 猜 CSS 选择器靠谱很多。
我自己的理解是：
Playwright MCP 让 AI 从“写脚本的人”，变成了“能先操作页面再写脚本的人”。
* * *
### 二、先安装配置
我这里以 Codex 为例。
官方推荐的标准配置大概是：
    
    {
      "mcpServers": {
        "playwright": {
          "command": "npx",
          "args": ["@playwright/mcp@latest"]
        }
      }
    }
    
如果是 Codex CLI，可以执行：
    
    codex mcp add playwright npx "@playwright/mcp@latest"
    
也可以手动改配置文件：
    
    [mcp_servers.playwright]
    command = "npx"
    args = ["@playwright/mcp@latest"]
    
如果你用 Cursor，可以在：
    
    Cursor Settings → MCP → Add new MCP Server
    
里配置：
    
    npx @playwright/mcp@latest
    
如果是 Claude Code，可以用：
    
    claude mcp add playwright npx @playwright/mcp@latest
    
建议本机准备好 Node.js 环境。官方 Getting Started 当前写的是 Node.js 20 或更新版本。
配置完成后，新开一个会话，让 AI 能识别到 Playwright MCP 工具。
* * *
### 三、我建议的配置方式
默认配置就能跑，但如果是测试场景，我更建议加上 `testing` 和 `storage` 能力：
    
    {
      "mcpServers": {
        "playwright": {
          "command": "npx",
          "args": ["@playwright/mcp@latest", "--caps=testing,storage"]
        }
      }
    }
    
原因很简单：
  * `testing`：方便做元素可见性验证、生成 locator
  * `storage`：方便保存登录态，避免每次都重新登录


如果你要排查失败，可以再加 `devtools`：
    
    {
      "mcpServers": {
        "playwright": {
          "command": "npx",
          "args": ["@playwright/mcp@latest", "--caps=testing,storage,devtools"]
        }
      }
    }
    
如果你只是先体验，不要一上来就把所有能力都打开。  
工具越多，AI 选择越多，有时候反而会绕。
我的建议是：

场景| 推荐配置  
---|---  
初次体验| `@playwright/mcp@latest`  
写 UI 自动化| `--caps=testing,storage`  
看接口和数据| `--caps=network,storage`  
排查失败| `--caps=devtools`  
页面是 canvas 或强视觉场景| `--caps=vision`  

大多数 Web 测试，不需要一开始就开 vision。
* * *
### 四、实战场景：优惠券领取页面
还是用一个脱敏后的场景。
需求：
用户进入优惠券活动页，点击“立即领取”，领取成功后页面提示“领取成功”，并且在“我的券包”里可以看到该优惠券。
如果已经领取过，再次点击应该提示“已领取”。
以前写这个自动化，我一般要自己打开页面、看 DOM、找选择器，然后写 Playwright。
现在可以让 AI 先操作页面。
* * *
### 五、第一步：让 AI 打开页面并观察
提示词可以这样写：
    
    使用 Playwright MCP 打开下面页面，不要生成脚本，先观察页面结构。
    
    页面地址：
    https://test.example.com/activity/coupon
    
    请输出：
    1. 页面标题
    2. 主要按钮和输入项
    3. 领取优惠券相关元素
    4. 你建议后续自动化使用的 locator
    
如果 MCP 正常，AI 会调用类似这些工具：
    
    browser_navigate
    browser_snapshot
    
它拿到页面快照后，可能会看到：
    
    - heading "优惠券活动" [level=1]
    - text "满 100 减 20"
    - button "立即领取" [ref=e23]
    - link "我的券包" [ref=e31]
    
这一步很关键。
因为它不是凭空猜，而是真的看到了页面结构。
* * *
### 六、第二步：让 AI 真实点击页面
接下来让它执行领取操作：
    
    点击“立即领取”按钮，观察页面变化。
    
    要求：
    1. 不要生成代码
    2. 先完成页面操作
    3. 输出点击后的页面提示
    4. 如果有网络请求，也请记录关键接口
    
这时 AI 会使用 MCP 点击按钮：
    
    browser_click
    browser_snapshot
    
如果页面提示成功，它可能会返回：
    
    页面出现提示：“领取成功”
    当前页面仍在优惠券活动页
    页面上出现“已领取”状态
    
如果开启了 network 能力，还可以让它看接口：
    
    请查看刚才点击领取时产生的网络请求，找出领取接口、请求方法、返回码和响应内容。
    
理想输出类似：
    
    POST /api/coupon/receive
    status: 200
    response: {"code":"SUCCESS","message":"领取成功"}
    
注意：真实项目里接口地址要以实际抓到的为准，不要让 AI 自己编。
* * *
### 七、第三步：让 AI 生成测试点
页面操作完成后，再让它生成测试点会更靠谱。
提示词：
    
    基于你刚才实际观察到的页面结构和领取流程，生成优惠券领取功能测试点。
    
    要求：
    1. 按主流程、异常场景、边界场景、数据一致性分类
    2. 每条测试点包含：场景、操作、预期结果、验证方式
    3. 验证方式要区分页面验证、接口验证、数据状态验证
    4. 不要编造页面上不存在的按钮和字段
    
输出可以整理成：

分类| 场景| 操作| 预期结果| 验证方式  
---|---|---|---|---  
主流程| 正常领取| 点击立即领取| 提示领取成功| 页面提示 + 券包查询  
异常| 重复领取| 再次点击领取| 提示已领取| 页面提示 + 接口返回码  
边界| 库存不足| 库存为 0 时领取| 提示已领完| 页面提示 + 库存不变  
一致性| 券包同步| 领取后进入我的券包| 能看到该优惠券| 页面 + 接口  
安全| 绕过前端| 直接请求领取接口| 后端仍校验资格| 接口验证  

这里比纯需求生成测试点更好，因为它已经知道真实页面有什么元素。
* * *
### 八、第四步：生成 Playwright 脚本
最后再让它生成脚本。
提示词：
    
    基于刚才实际操作页面得到的信息，生成 Playwright 自动化脚本。
    
    要求：
    1. 使用 @playwright/test
    2. 优先使用 getByRole、getByText、getByTestId
    3. 不要使用 XPath
    4. TEST_BASE_URL 从环境变量读取
    5. 不要写死真实账号、密码、token、cookie
    6. 领取成功后进入“我的券包”做二次断言
    7. 输出完整代码
    
示例脚本：
    
    import { test, expect } from '@playwright/test';
    
    const baseUrl = process.env.TEST_BASE_URL;
    
    test('用户成功领取优惠券后，券包中可以看到该券', async ({ page }) => {
      await page.goto(`${baseUrl}/activity/coupon`);
    
      await expect(page.getByRole('heading', { name: '优惠券活动' })).toBeVisible();
      await expect(page.getByText('满 100 减 20')).toBeVisible();
    
      await page.getByRole('button', { name: '立即领取' }).click();
    
      await expect(page.getByText('领取成功')).toBeVisible();
    
      await page.getByRole('link', { name: '我的券包' }).click();
    
      await expect(page.getByText('满 100 减 20')).toBeVisible();
    });
    
这段代码只是示例，真实项目里还要继续补：
  * 登录态处理
  * 测试数据准备
  * 接口断言
  * 重复领取场景
  * 数据清理


但比直接让 AI 凭空生成脚本，已经靠谱很多。
* * *
### 九、我更推荐的脚本生成方式
如果是正式自动化，我不会只让它写 UI 断言。
我会继续补一句：
    
    请在上面的脚本基础上增强：
    1. 领取成功后调用券包接口做二次断言
    2. 如果接口地址不确定，请不要编造，标记为 TODO
    3. 测试前置数据需要说明，不要假设线上已有固定优惠券
    
理想代码会变成：
    
    import { test, expect } from '@playwright/test';
    
    const baseUrl = process.env.TEST_BASE_URL;
    
    test('用户成功领取优惠券后，券包中可以查询到该券', async ({ page, request }) => {
      await page.goto(`${baseUrl}/activity/coupon`);
    
      await page.getByRole('button', { name: '立即领取' }).click();
    
      await expect(page.getByText('领取成功')).toBeVisible();
    
      // TODO: 替换为项目真实券包接口
      const response = await request.get(`${baseUrl}/api/user/coupons`);
    
      expect(response.status()).toBe(200);
    
      const data = await response.json();
    
      expect(
        data.list.some(item => item.couponName === '满 100 减 20')
      ).toBeTruthy();
    });
    
这里我特意要求它不要编造接口。
如果不知道接口，就写 TODO。  
这比自作聪明写一个不存在的接口要好。
* * *
### 十、Playwright MCP 最适合哪些测试场景
我用下来觉得，它特别适合这些场景：
#### 1\. 给陌生页面生成自动化脚本
以前接一个新页面，要先看 DOM、找按钮、试选择器。
现在可以让 AI 先打开页面走一遍，再基于真实页面生成脚本初稿。
#### 2\. 冒烟测试
比如：
    
    打开系统首页，完成登录，进入订单列表，搜索订单号，打开订单详情，确认页面能正常展示。
    
这种路径明确的冒烟流程，很适合用 MCP 辅助。
#### 3\. 后台管理系统
后台页面控件多，表格、弹窗、下拉、搜索、分页很多。
Playwright MCP 能先读取页面结构，再定位元素，比纯靠截图或描述更稳。
#### 4\. 自动化脚本维护
页面改版后，原脚本定位失效。
可以让 AI 打开新页面，重新观察元素，再建议新的 locator。
#### 5\. 失败复现
失败日志里说某个按钮找不到，可以让 AI 直接打开页面看：
    
    打开这个页面，检查是否存在“提交订单”按钮。如果不存在，请找出页面上实际可点击的提交按钮名称。
    
这个比人工翻 DOM 快。
* * *
### 十一、它不适合什么场景
Playwright MCP 也不是万能的。
#### 1\. 不适合完全替代测试设计
它能操作页面，但不代表它懂业务风险。
比如优惠券是否要防重复领取、库存是否要扣减、券包是否要同步，这些还是测试人员来判断。
#### 2\. 不适合直接操作生产环境
MCP 是真的会点页面、填表单、提交请求的。
不要让它直接在生产环境操作订单、支付、审批、删除等功能。
建议只用于：
  * 本地环境
  * 测试环境
  * 沙箱环境
  * 脱敏演示环境


#### 3\. 不适合缺少可访问性信息的页面
Playwright MCP 默认依赖 accessibility snapshot。
如果页面按钮没有文本、没有 aria-label、没有合理语义，它看到的结构可能不完整。
这种情况下要么让前端补可访问性信息，要么考虑截图/vision 模式。
#### 4\. 不适合无脑生成大批量脚本
它能帮你生成初稿，但脚本长期维护还是要靠工程化：
  * Page Object
  * 测试数据管理
  * 接口断言
  * CI 集成
  * 报告分析
  * 失败重试策略


* * *
### 十二、几个实用提示词
#### 1\. 观察页面结构
    
    使用 Playwright MCP 打开页面并观察结构，不要生成代码。
    
    请输出：
    1. 页面标题
    2. 主要按钮、输入框、链接
    3. 关键业务元素
    4. 建议使用的 Playwright locator
    5. 不确定的信息
    
#### 2\. 走一遍业务流程
    
    请使用 Playwright MCP 在页面上完成一次优惠券领取流程。
    
    要求：
    1. 每一步操作前先说明你看到了什么
    2. 操作后重新观察页面状态
    3. 记录关键页面提示
    4. 不要操作删除、支付、审批等危险动作
    
#### 3\. 生成自动化脚本
    
    基于刚才实际操作页面得到的信息，生成 Playwright 脚本。
    
    要求：
    1. 使用 @playwright/test
    2. 优先使用 getByRole、getByText、getByTestId
    3. 不要使用 XPath
    4. 环境地址从 TEST_BASE_URL 读取
    5. 不写死账号、密码、token、cookie
    6. 核心业务结果必须补接口或数据断言
    7. 不知道的接口不要编造，标记 TODO
    
#### 4\. 检查脚本稳定性
    
    请 review 上面的 Playwright 脚本是否稳定。
    
    重点检查：
    1. 定位是否脆弱
    2. 是否只断言页面文案
    3. 是否依赖固定测试数据
    4. 是否缺少等待或状态判断
    5. 是否适合接入 CI
    6. 是否存在敏感信息
    
#### 5\. 排查失败
    
    使用 Playwright MCP 打开失败页面，结合当前页面结构和失败日志分析原因。
    
    请输出：
    1. 失败现象
    2. 页面当前状态
    3. 最可能原因
    4. 是脚本问题、数据问题、环境问题还是产品问题
    5. 建议修复方案
    
* * *
### 十三、我的使用建议
如果你是第一次用 Playwright MCP，我建议按这个顺序来：
  1. 先用公开 demo 页面试一下，比如 TodoMVC
  2. 再用公司测试环境的只读页面试
  3. 确认它能正确识别按钮、输入框、表格
  4. 再让它生成简单脚本
  5. 最后再接入真实自动化工程


不要一上来就让它：
    
    帮我把整个系统自动化测试写完
    
这种需求太大，输出一定会虚。
正确姿势是拆小：
    
    先观察页面
    
    
    再走一个流程
    
    
    再生成一条脚本
    
    
    再 review 脚本稳定性
    
    
    最后再扩展成测试套件
    
* * *
### 总结
Playwright MCP 对测试人员最大的价值，不是“AI 会写脚本”这件事。
而是它让 AI 能先看真实页面、操作真实浏览器，再基于实际状态生成测试建议和脚本。
这比纯靠提示词猜页面靠谱得多。
我的结论是：
  1. Playwright MCP 很适合生成 UI 自动化脚本初稿
  2. 它特别适合冒烟测试、后台系统、陌生页面和失败复现
  3. 默认 snapshot 模式比截图坐标更稳定
  4. 生成脚本后仍然要补测试数据、接口断言和工程化封装
  5. 不要让它直接操作生产环境或危险动作
  6. 不知道的接口宁可写 TODO，也不要让 AI 编


一句话总结：
Playwright MCP 不是替测试人员设计测试，而是让 AI 终于能先“看页面、点页面”，再帮你写测试。
这一步，对 UI 自动化来说还是挺有价值的。
* * *
