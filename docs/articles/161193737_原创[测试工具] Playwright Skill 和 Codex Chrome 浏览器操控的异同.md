# 原创[测试工具] Playwright Skill 和 Codex Chrome 浏览器操控的异同

> 原文: https://blog.csdn.net/weixin_42390585/article/details/161193737

> 原创内容，未获授权禁止转载、转发、抄袭。

最近用 Codex 做浏览器测试时，经常会遇到一个选择：
到底用 **Playwright Skill** ，还是用 **Codex Chrome 浏览器操控** ？
两者都能让 AI 操作浏览器，但定位不一样。
我的理解是：
Playwright Skill 面向可复现的自动化流程，Codex Chrome 面向当前真实浏览器上下文。
* * *
### 一、先看结论

场景| 推荐  
---|---  
做稳定自动化流程| Playwright Skill  
获取页面 snapshot、截图、调试流程| Playwright Skill  
沉淀成 Playwright 脚本| Playwright Skill  
使用本机 Chrome 登录态| Codex Chrome  
接管当前已打开页面| Codex Chrome  
页面依赖 SSO、插件、已有 Cookie| Codex Chrome  
临时排查线上或后台页面| Codex Chrome  
CI、冒烟、批量回归| Playwright Skill  

一句话：
要可复现，用 Playwright Skill；要当前登录态，用 Codex Chrome。
* * *
### 二、两者核心区别

对比项| Playwright Skill| Codex Chrome  
---|---|---  
浏览器环境| 独立、可控| 用户当前 Chrome  
登录态| 通常需要单独处理| 可复用当前登录态  
已打开 Tab| 不依赖| 可以接管  
复现能力| 强| 依赖当前浏览器状态  
自动化沉淀| 更适合| 不适合长期脚本  
线上排查| 不方便| 更方便，但要谨慎  
安全风险| 相对可控| 更高  

不要理解成谁更高级。
更准确地说：
    
    Playwright Skill 管流程复现。
    Codex Chrome 管真实上下文。
    
* * *
### 三、什么时候用 Playwright Skill
适合这些场景：
  * 写自动化脚本
  * 跑冒烟流程
  * 获取页面 snapshot
  * 重新找 locator
  * 截图和调试流程
  * 后续接入 CI 或回归测试


比如登录自动化：
    
    使用 Playwright Skill 打开登录页并获取 snapshot。
    请列出账号输入框、密码输入框、登录按钮对应的元素。
    不要使用 XPath。
    
这类流程明确、需要反复执行的场景，优先用 Playwright Skill。
* * *
### 四、什么时候用 Codex Chrome
适合这些场景：
  * 当前 Chrome 已经登录
  * 页面依赖 SSO、MFA、浏览器插件
  * 想接管当前 Tab
  * 临时查看后台页面
  * 排查线上或测试环境偶发问题


比如查看已登录后台：
    
    请查看当前 Chrome 页面。
    
    要求：
    1. 不要点击提交、保存、删除、审批按钮
    2. 只观察页面结构和当前状态
    3. 输出页面标题、主要模块、异常提示
    
这类依赖真实浏览器状态的场景，用 Codex Chrome 更省事。
* * *
### 五、同一个场景怎么选
以优惠券领取页面为例：
    
    用户进入活动页，点击“立即领取”。
    领取成功后提示“领取成功”，券包中能看到该优惠券。
    重复领取提示“已领取”。
    
如果目标是：
    
    我要把这个流程沉淀成自动化测试。
    
选 Playwright Skill。
流程：
    
    打开测试环境活动页
    获取 snapshot
    点击“立即领取”
    检查页面提示
    截图
    整理 locator
    写成 Playwright 脚本
    
如果目标是：
    
    我当前 Chrome 里已经打开了后台页面，想判断页面当前状态。
    
选 Codex Chrome。
流程：
    
    接管当前已登录页面
    查看按钮状态
    判断是“立即领取”“已领取”还是“已领完”
    不直接点击危险按钮
    输出页面状态和排查建议
    
核心差别：
    
    Playwright Skill 看流程能不能稳定复现。
    Codex Chrome 看当前真实页面到底是什么状态。
    
* * *
### 六、安全风险要注意
Codex Chrome 操控的是真实 Chrome，可能带着你的真实登录态。
所以一定要限制操作：
    
    不要点击提交、保存、删除、支付、审批类按钮。
    如果需要执行有影响的操作，必须先询问我确认。
    
简单判断：

操作| 建议  
---|---  
查看页面| 可以  
截图分析| 可以  
读取页面状态| 可以  
填写测试表单| 看环境  
保存配置| 谨慎  
删除数据| 不建议  
支付| 不建议  
审批| 不建议  
修改生产配置| 不建议  

Playwright Skill 也不是绝对安全。  
如果打开生产地址并点击按钮，一样会产生真实影响。
* * *
### 七、推荐组合用法
实际工作里，两者可以组合：
    
    Codex Chrome 先看真实页面
    ↓
    确认页面状态、按钮文案、异常提示
    ↓
    Playwright Skill 在测试环境复现流程
    ↓
    整理成可维护的自动化脚本
    
比如：
  1. 用 Chrome 看后台真实页面，确认按钮叫“立即领取”
  2. 确认弹窗文案和异常提示
  3. 用 Playwright Skill 在测试环境重新走一遍
  4. 整理 locator 和断言
  5. 写进自动化工程


这比单独用一个工具更稳。
* * *
### 八、几个避坑点
#### 1\. 不要用 Chrome 操控做长期自动化
Chrome 操控依赖当前浏览器状态。
今天你登录了，明天登录态可能过期。  
今天页面开着，明天 Tab 可能关了。
长期回归还是交给 Playwright。
#### 2\. 不要用 Playwright Skill 硬跑复杂登录
如果系统依赖 SSO、MFA、VPN、浏览器插件，临时排查用 Chrome 更省事。
要长期自动化，再单独设计登录态方案。
#### 3\. 不要让 Chrome 随便点真实按钮
Chrome 操控是真实点击。  
删除、审批、支付、保存配置都要谨慎。
#### 4\. 不要把工具当测试设计
两者都能帮你看页面、点流程、找元素、截图、生成脚本初稿。  
但业务风险仍然要测试人员判断，比如幂等、越权、库存扣减、金额一致性。
* * *
### 九、常用提示词
#### Playwright Skill
    
    使用 Playwright Skill 打开下面页面并获取 snapshot。
    
    要求：
    1. 不要直接生成脚本
    2. 先列出页面主要元素
    3. 给出推荐 locator
    4. 如果元素 ref 可能失效，请提示重新 snapshot
    5. 不要使用 XPath
    
    页面：
    https://test.example.com/activity/coupon
    
#### Codex Chrome
    
    请使用 Codex Chrome 浏览器操控查看当前页面。
    
    要求：
    1. 不要点击提交、保存、删除、支付、审批类按钮
    2. 只观察页面结构和当前状态
    3. 输出页面标题、主要模块、关键按钮、异常提示
    4. 如果需要执行有影响的操作，请先询问我确认
    
#### 组合使用
    
    先使用 Codex Chrome 观察当前已登录页面，确认页面结构和按钮文案。
    不要执行有影响的操作。
    
    然后基于观察结果，给出一版适合用 Playwright Skill 在测试环境复现的自动化流程。
    
* * *
### 总结
Playwright Skill 和 Codex Chrome 浏览器操控都能让 AI 操作浏览器，但定位不同。
我的选择原则是：
    
    要可复现，用 Playwright Skill。
    要当前登录态，用 Codex Chrome。
    
    要沉淀脚本，用 Playwright Skill。
    要临时排查，用 Codex Chrome。
    
一句话总结：
Chrome 看真实状态，Playwright 沉淀自动化。
