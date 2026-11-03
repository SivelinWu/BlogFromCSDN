# [AI测试] 试用 TesterArmy e2e：让 AI 操作页面，把结果交给断言

> 原文: https://blog.csdn.net/weixin_42390585/article/details/169846828

> 原创内容，未获授权禁止转载、转发、抄袭。

最近，TesterArmy 的 e2e 在 AI 自动化测试领域受到不少关注。用自然语言描述目标，让 AI 找控件、完成操作，确实让人想试试。对于平时要维护回归脚本的测试人员，更实际的问题是：接进现有项目后，哪些代码能少写，哪些检查仍然得自己把住？
这里的 **e2e** 是框架名，具体指 TesterArmy 开源的 TypeScript 测试框架。它把常规定位、断言和 Agent 操作放在同一条用例里：定位明确的输入框可以直接填，操作路径变化较多的流程可以交给 `agent.act()`。Web 引擎基于 Playwright，移动端通过 agent-device 驱动，两者共享一套测试 API，但页面定位仍要适配各端。
我用一个简化购物车做了实验：商品总价 198 元，优惠码抵扣 40 元，再故意把应付金额改成 159 元，看看测试能否发现。下面记录已跑过的定位与断言，并结合源码讨论操作回放机制。AI 部分给出接入写法，尚未调用真实模型执行，成功率和费用仍需另行验证。
### 先把一条能判断对错的用例跑起来
入门可以在项目目录执行：
    
    npx e2e init
    
选择 Web 引擎，并确认安装向导生成的依赖。只跑普通定位和断言时，模型选 None 就可以，没必要为了打开一个页面先折腾模型接入。示例核验使用 `e2e@0.22.0`、`@e2e-dev/web@0.15.4` 和 Node.js 24.22.1；团队接入时应提交依赖锁文件，避免本地和 CI 各装一套依赖。
在生成的 `e2e.config.ts` 中，把 Web target 的 `app.url` 改为已启动站点的地址，再确认测试数据。我的本地页面约定如下，接入实际项目时需要替换成对应页面、数据准备方式和定位：

项目| 示例约定  
---|---  
入口| `/cart`  
商品| 单价 99 元，数量 2，无运费和其他优惠  
有效优惠码| `SAVE40`，抵扣 40 元，不重复叠加  
无效优惠码| `INVALID`，应拒绝使用，金额不变  
初始状态| 每条用例开始时尚未应用优惠，应付 198 元  
操作定位| 输入框标签“优惠码”，按钮“应用优惠”  
结果定位| 金额 `data-testid="payable"`，成功与错误提示分别为唯一的 `status`、`alert` 元素  
状态保存| 用 localStorage 保留优惠状态，重新打开页面仍能读取  

这是验证测试写法的 UI 示例，没有订单接口和数据库。真实电商回归还要准备独立账号、购物车和优惠券，并校验服务端结算结果，不能拿前端显示代替整条交易链路。
在 `tests/coupon.e2e.ts` 中，先写一条不依赖 AI 的用例：
    
    import { test } from '@e2e-dev/web';
    import { expect } from 'e2e';
    
    test('优惠码抵扣40元，重新打开页面后金额保留', async ({ app, screen }) => {
      await app.open('/cart');
      await expect(screen.getByTestId('payable')).toHaveText('¥198.00');
    
      await screen.getByLabel('优惠码').fill('SAVE40');
      await screen.getByRole('button', '应用优惠').tap();
    
      await expect(screen.getByRole('status')).toHaveText('已优惠 ¥40.00');
      await expect(screen.getByTestId('payable')).toHaveText('¥158.00');
    
      await app.open('/cart');
      await expect(screen.getByTestId('payable')).toHaveText('¥158.00');
    });
    
这条用例检查了初始金额、优惠结果和重新进入后的状态。198 减 40 等于 158，这个预期由测试规则给出，不让模型从页面上“读一个看起来合理的金额”作为答案。
    
    npx e2e run tests/coupon.e2e.ts --trace
    
另外补了无效码和重复应用两条用例，本地执行结果为 `3 passed`。默认本地 Web 模式下，每次测试尝试使用新的浏览器上下文，因此上条用例的 localStorage 不会串到下一条；但服务器上的购物车、库存和优惠券不会跟着清空，项目里的测试数据仍要自己隔离。
### 接入 AI 时，只替换需要它的那一段
有了确定性基线，再决定哪段操作值得交给 AI。比如真实页面需要展开优惠面板、找到兑换入口、填写优惠码，而入口布局经常调整，可以把这段作为一个有边界的目标。
以 Vercel AI Gateway 为例，安装 `ai`，在运行测试的终端或 CI 中设置 `AI_GATEWAY_API_KEY`，并把账户可用、支持工具调用与图片输入的模型标识放入 `E2E_MODEL_ID`。e2e 不会自动读取 `.env` 文件，仅把变量写进文件还不够，需要导出到进程环境，或在配置中显式加载。在配置文件中创建模型对象，再把下面的 `aiAgents` 赋给配置的 `agents` 属性：
    
    import { gateway } from 'ai';
    
    const modelId = process.env.E2E_MODEL_ID;
    if (!modelId) throw new Error('请设置 E2E_MODEL_ID');
    
    const aiAgents = {
      default: { model: gateway(modelId) },
    };
    
这是配置片段，在 `export default` 的对象中加入 `agents: aiAgents`，原有 `targets` 等配置保留。框架还提供其他供应商、订阅授权和本地模型接入方式，按官方文档选择即可。编辑器里能使用 AI，不意味着测试进程已经拿到了模型配置和授权。
下面是前一条用例的混合写法：
    
    import { test } from '@e2e-dev/web';
    import { expect } from 'e2e';
    
    test('通过优惠入口使用指定优惠码', async ({ app, agent, screen }) => {
      await app.open('/cart');
      await expect(screen.getByTestId('payable')).toHaveText('¥198.00');
    
      await agent.act(
        '在当前购物车使用优惠码 {code}。不要更换优惠码、修改商品数量或提交订单。',
        { params: { code: 'SAVE40' } },
      );
    
      await expect(screen.getByTestId('payable')).toHaveText('¥158.00');
      await expect(screen.getByRole('status')).toHaveText('已优惠 ¥40.00');
      await app.open('/cart');
      await expect(screen.getByTestId('payable')).toHaveText('¥158.00');
    });
    
在这个只有一个输入框、一个按钮的小页面里，直接定位更省事。混合写法是为了展示接入位置，并不能证明这两步换成 AI 就更划算。是否保留 Agent，要看真实页面的维护成本和试跑结果。
指令也别一口气写成“登录、选商品、领券、下单并确认一切正常”。把操作拆在业务检查点之间，失败位置会清楚得多。提示词写了“不修改数量”，也应在真实项目里补上商品明细和数量断言；涉及下单、扣款的操作，则限定在隔离测试环境中，不能指望事后断言阻止已经发生的交易。
### 负向用例保留精确操作
测试无效优惠码时，如果告诉 AI“帮我成功使用优惠”，它可能尝试换一个码，或者寻找其他优惠入口。这种行为对完成任务有帮助，却改变了测试条件。
输入哪个值、点击几次，本来就是用例的一部分。这样的步骤直接写死更清楚：
    
    test('无效优惠码不改变应付金额', async ({ app, screen }) => {
      await app.open('/cart');
      await screen.getByLabel('优惠码').fill('INVALID');
      await screen.getByRole('button', '应用优惠').tap();
    
      await expect(screen.getByRole('alert')).toHaveText('优惠码无效');
      await expect(screen.getByTestId('payable')).toHaveText('¥198.00');
    });
    
这段追加在 `tests/coupon.e2e.ts` 中，共用导入。金额没有减少，和“弹出了错误提示”同样重要。真实系统还应确认没有生成优惠占用记录或错误核销记录；页面断言无法证明这些后台副作用没有发生。
重复应用则检查同一优惠是否被扣了两次，同样追加到这个文件：
    
    test('重复应用同一优惠码不叠加抵扣', async ({ app, screen }) => {
      await app.open('/cart');
      await screen.getByLabel('优惠码').fill('SAVE40');
      await screen.getByRole('button', '应用优惠').tap();
      await expect(screen.getByTestId('payable')).toHaveText('¥158.00');
      await screen.getByRole('button', '应用优惠').tap();
      await expect(screen.getByTestId('payable')).toHaveText('¥158.00');
    });
    
另一个需要区分的 API 是 `agent.assert()`：它判断当前观察到的状态，不会一直等待条件成立。异步结果可以用 `agent.waitFor()` 等待语义条件；像金额、订单号这种能够精确定位的内容，优先使用带自动重试的定位器断言，没必要再绕一圈让模型判断。
### 故意算错一元钱，看看测试会不会失败
我在本地示例页面加了一个故障分支：访问 `/cart?broken=1` 后，应用优惠码仍显示“已优惠 ¥40.00”，但应付金额变成 `¥159.00`。这个参数是示例页面自己实现的，不是框架开关。把正常用例复制为单独的反例，将入口替换为该地址，应付金额仍期待 `¥158.00`，运行后成功提示的断言通过，金额断言失败。
报告中的实际报错如下：
    
    ASSERTION_FAILED: expect.toHaveText failed
    locator: getByTestId("payable")
    expected: text "¥158.00"
    observed: text "¥159.00" (match count 1)
    
验证项| 本地结果  
---|---  
正常抵扣，重新进入仍为 158 元| 通过  
无效码，仍为 198 元| 通过  
重复应用，不叠加抵扣| 通过  
提示正常但金额改为 159 元| 按预期失败  

给自己的用例准备一个明确错误的结果，比反复跑正确页面更能发现断言遗漏。如果金额错了仍然全绿，就应该先补测试，再考虑让 Agent 接管操作。
失败后先查看报告中的失败步骤、期望值和实际值，再看页面证据。默认生成 `.e2e/report.json`，开启 trace 后可查看 `.e2e/results/` 下各用例目录里的 `trace.md`。涉及模型操作时再加 `--ai-trace` 查看调用记录，区分模型服务不可用、操作走错和业务结果错误，不要见到红色就一律增加重试。
### 把首次执行和缓存回放分开看
e2e 的操作缓存值得单独看一看：符合条件的 `agent.act()` 记录可以在后续运行时直接回放，命中的操作步骤不再调用模型。读源码时，我重点看了 `agent/act.ts`、`agent/step-cache.ts` 和 `cache/context.ts`，这里有几个容易理解过头的地方。
`act` 结束不等于记录立即被确认。在读写缓存模式下，框架会在本次测试尝试结束时，根据后续通过的验证步骤处理记录。定位器断言属于可识别的验证，普通值的 `expect(value)`、`agent.extract()` 或测试整体通过本身不承担这个作用。失败的测试也可能保留此前已被验证的操作记录。
不过，框架无法判断断言是否覆盖了业务要害。如果只验证“出现了成功提示”，操作记录可能已经被确认，金额仍然可能有错。因此缓存可用和业务正确，必须分别看。
回放也有范围：使用内置 Agent 时，`agent.assert()`、`agent.waitFor()`、`agent.extract()` 仍会实时调用模型。页面变化导致回放不再适用时，普通模式下 Agent 可以从当前页面接手；它不会自动把整个业务现场恢复到最开始。订单、支付等不可重复操作，更需要明确的幂等和隔离策略。
真正试跑时，建议把下面几组结果分开记录。这是评估方案，不是本次已经测出的性能结论：

运行方式| 观察什么  
---|---  
关闭缓存，关闭重试| Agent 首次完成目标的成功率、耗时和模型用量  
有有效记录后重复运行| 回放是否命中、还剩哪些模型调用  
改按钮名称或入口布局后再跑| 回放如何失效，Agent 是否走了允许的路径  
注入错误金额后运行| 最终业务断言是否稳定失败  

将前面的混合用例单独存为 `tests/coupon-ai.e2e.ts`。接好模型、准备独立数据后，在本地默认读写缓存模式下分三步试跑，报告分目录保存：
    
    # 不使用缓存，观察每次实时执行
    npx e2e run tests/coupon-ai.e2e.ts --no-cache --repeat-each 5 --retries 0 --workers 1 --ai-trace --output .e2e-cold
    
    # 开启缓存，完成一轮操作与校验，检查记录是否保存
    npx e2e run tests/coupon-ai.e2e.ts --retries 0 --workers 1 --output .e2e-record
    
    # 保持用例、指令、参数和缓存目录不变，观察回放
    npx e2e run tests/coupon-ai.e2e.ts --repeat-each 5 --retries 0 --workers 1 --ai-trace --output .e2e-replay
    
`--no-cache` 同时关闭读取和写入，第一组跑完并不会生成回放记录。第二组要检查报告中的 `step.cache.write` 是否为 `saved` 或 `kept`，第三组再看回放命中情况，不能仅凭执行变快就认定命中。默认缓存位于 `.e2e/cache/`，与这里的三个报告目录分开；CI 未显式配置缓存时默认只读，需要提前准备记录。
重复 5 次只是小样本试跑，不能据此宣称框架已经稳定。`--strict-cache` 也不是通用的“禁止调用模型”开关：已有记录失效会失败，但缺少记录的步骤仍可能实时执行。
### 我会怎样放进现有回归
先挑一个入口有变化、业务结果又能精确核对的流程试用，例如从活动页找到指定商品并加入购物车。保留商品、数量、价格等断言，对照原有脚本记录首次通过率、失败排查时间和维护改动，再决定是否扩大范围。已经稳定的两三步定位，没有必要为了用 AI 全部重写。
还要防止 Agent 把路径问题绕过去。如果要求测试“活动页的购买按钮”，就应明确点击并验证这个入口；让 Agent 从搜索页买到同一商品，只能说明另一条路径可用。自动适应页面变化有价值，但它不能替你决定哪些变化可以接受。
让 AI 辅助生成用例或修改失败脚本时，我会重点审查预期值和断言的变化。定位失效可以修，金额预期却不能因为页面显示错了就跟着改；否则报告变绿了，缺陷还留在原地。
模型接入方面，用测试账号和合成业务数据起步，密钥放环境变量或 CI 的密钥配置。页面文本和截图可能发给模型，缓存记录也可能包含普通输入值；共享报告或提交缓存前，检查其中是否有业务数据。
### 总结
我会保留已有回归里的业务断言，先用 e2e 改造一段确实难维护的页面操作。试跑时既看正确流程能否完成，也给它一个算错金额的页面，确认用例确实会报错。等首次执行、缓存回放和失败排查都有了记录，再决定是否扩大使用范围，这比一次性重写整套脚本更容易判断收益。
