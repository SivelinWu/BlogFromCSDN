# [测试工具] Playwright 新出的 Test Agents，我实测后发现：真能提效，但是...

> 原文: https://blog.csdn.net/weixin_42390585/article/details/161287056

> 原创内容，未获授权禁止转载、转发、抄袭。

最近看了 Playwright 官方的 Test Agents 文档，也顺手做了一轮本地实践。
先说结论：**这套东西不是“AI 帮你随便写几条用例”，而是把自动化测试拆成了计划、生成、修复三个环节。方向是对的，但落地时一定要 review。**
官方文档地址：<https://playwright.dev/docs/test-agents>
### 三个 Agent 分别干什么
Playwright Test Agents 里默认有三个角色：

Agent| 作用| 产物  
---|---|---  
`planner`| 探索页面，生成测试计划| `specs/*.md`  
`generator`| 根据测试计划生成 Playwright 用例| `tests/*.spec.ts`  
`healer`| 分析失败用例，尝试修复选择器、等待、断言等问题| 修复后的测试脚本  

我理解下来，它真正有价值的地方不是“少写几行代码”，而是把测试建设变成了一个更容易审核的链路：
    
    测试目标 -> 测试计划 -> 自动化用例 -> 执行失败 -> 修复回归
    
### 实践环境
我本地用了一个很小的优惠券下单页面，覆盖这些点：
  * 默认金额展示
  * 有效优惠券
  * 无效优惠券
  * 切换商品和数量后重新计算
  * 提交订单展示最终金额
  * 旧选择器失败后的修复


环境大概是：
    
    Node.js: v22.17.1
    Playwright: 1.60.0
    浏览器: Chrome
    
测试页面长这样：  
![在这里插入图片描述](/cdn/161287056/0e80f45d163040df90fcff8a04dcfe1a.png)
### 第一步：初始化 Test Agents
执行命令：
    
    npx playwright init-agents --loop=claude --prompts
    
输出里可以看到它生成了三个 agent 定义文件：  
![在这里插入图片描述](/cdn/161287056/023eb07552f2424da1a5739f0fd12405.png)
生成后的核心文件大概是这些：  
![在这里插入图片描述](/cdn/161287056/63d43a1898cb48c290887b2fd1607f1b.png)
这里有个点要注意：`init-agents` 不是直接帮你跑测试，它是给 Claude Code、VS Code、OpenCode 这类宿主生成 Agent 定义和 MCP 配置。
目前我实测 `init-agents --help` 里没有 `codex` 选项，可选的是：
    
    claude, copilot, opencode, vscode, vscode-legacy
    
所以在 Codex 里不能原样读取 `.claude/agents/*.md` 或 `.github/agents/*.agent.md`。如果要在 Codex 里复用，需要迁移成 Codex 的 `.codex/agents/*.toml`，同时把 Playwright MCP 配到 `.codex/config.toml`。
### 第二步：Planner 先产出测试计划
我没有直接让它生成代码，而是先准备测试计划：
    
    为优惠券下单模块生成测试计划，重点覆盖金额计算、有效优惠券、无效优惠券、商品切换、订单提交反馈。
    
最后整理出来的计划放在：
    
    specs/order-coupon.md
    
这一步很有必要。测试计划先落地，后面生成用例才不会跑偏。
我比较建议计划里至少写清楚：
  * 前置入口，比如 `tests/seed.spec.ts`
  * 每个场景的操作步骤
  * 每个场景的明确断言
  * 哪些是正向，哪些是异常场景


### 第三步：Generator 生成用例，但不能不看
根据测试计划生成了 Playwright 用例：
    
    tests/order-coupon.spec.ts
    
第一轮跑的时候，我遇到一个很典型的问题：
    
    getByLabel('商品') resolved to 2 elements
    
原因是页面上既有“商品信息”区域，又有“商品”下拉框，`getByLabel('商品')` 命中了多个元素。
修复方式也很简单：
    
    await page.getByLabel('商品', { exact: true }).selectOption('course');
    
这个例子说明：**Generator 可以提速，但选择器和断言一定要人工 review。**
### 第四步：Healer 更适合修选择器类问题
我故意准备了一条旧脚本：
    
    await page.getByRole('button', { name: '使用优惠券' }).click();
    
但页面真实按钮已经是：
    
    应用优惠券
    
执行后失败：  
![在这里插入图片描述](/cdn/161287056/fffbac3dad3247aabf845e3aa44f3cbf.png)
Playwright 的失败上下文里能看到当前页面快照，按钮实际是“应用优惠券”。这种问题就很适合交给 Healer 处理。
修复后代码变成：
    
    await page.getByRole('button', { name: '应用优惠券' }).click();
    
最后全量回归：  
![在这里插入图片描述](/cdn/161287056/cda24d983e714b80bf9fae141546a5ae.png)
结果：
    
    7 passed
    
### 如果想在 Codex 里用，怎么处理？
这里要单独说一下。
Playwright 官方现在没有：
    
    npx playwright init-agents --loop=codex
    
但 Codex 本身支持自定义 subagents 和 MCP，所以可以换一种方式接入：
    
    [mcp_servers."playwright-test"]
    command = "npx"
    args = ["playwright", "run-test-mcp-server"]
    startup_timeout_sec = 20
    tool_timeout_sec = 120
    
然后把 Playwright 生成的三个角色迁移成 Codex subagent：
    
    .codex/agents/playwright-test-planner.toml
    .codex/agents/playwright-test-generator.toml
    .codex/agents/playwright-test-healer.toml
    
在 Codex 里调用时，提示词可以这样写：
    
    请使用 playwright_test_planner 这个 subagent，
    基于 tests/seed.spec.ts，
    为优惠券下单模块生成测试计划，
    输出到 specs/order-coupon.md。
    
这条路目前更像是“适配使用”，不是 Playwright 官方原生支持 Codex，期待后续对codex更好的支持吧。
### 我的结论
这套 Test Agents 值得测试同学关注，尤其适合做模块级自动化覆盖。
但不要把它当成“全自动测试工程师”。它更像一个分工明确的助手：
  * `planner` 帮你把测试范围拉出来
  * `generator` 帮你把计划翻译成脚本
  * `healer` 帮你处理一部分失败用例


真正需要测试人员把关的地方还是这些：
  * 场景有没有漏
  * 断言是否有效
  * 选择器是否稳定
  * 失败修复有没有把真实缺陷掩盖掉
  * 生成的用例是否适合进 CI


我个人会这样用：
    
    MCP：调试单条流程
    Test Agents：建设模块级回归集
    Playwright Test：执行和接入 CI
    Codex：做测试计划评审、脚本修改和失败分析
    
一句话：**Playwright Test Agents 能降低自动化建设的体力活，但不能省掉测试设计的判断。**
