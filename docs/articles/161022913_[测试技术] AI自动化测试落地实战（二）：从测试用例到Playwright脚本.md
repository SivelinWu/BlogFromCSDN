# [测试技术] AI自动化测试落地实战（二）：从测试用例到Playwright脚本

> 原文: https://blog.csdn.net/weixin_42390585/article/details/161022913

> 原创内容，未获授权禁止转载、转发、抄袭。

上一篇讲了 AI 如何辅助需求拆解和用例设计。
这一篇继续往下走：**怎么把测试用例变成真正能跑、能维护、能接入 CI 的自动化脚本。**
很多同学用 AI 生成脚本时，最常见的问题是：
脚本看起来能跑，但跑几次就不稳定；  
本机能跑，换个环境就失败；  
页面提示成功了，但数据到底对不对没人知道。
所以这一篇不只讲“生成脚本”，重点讲 **脚本怎么写得更像一个可靠的测试资产。**
* * *
### 一、AI 生成脚本只是初稿
以订单提交流程为例，AI 很容易生成下面这种 Playwright 脚本。
    
    import { test, expect } from '@playwright/test';
    
    test('订单提交成功 - 正常库存和有效地址', async ({ page }) => {
      await page.goto('https://your-test-env.example.com');
    
      await page.getByRole('textbox', { name: '账号' }).fill('test_user');
      await page.getByRole('textbox', { name: '密码' }).fill('123456');
      await page.getByRole('button', { name: '登录' }).click();
    
      await page.getByText('测试商品').click();
      await page.getByRole('button', { name: '加入购物车' }).click();
      await page.getByRole('button', { name: '去结算' }).click();
    
      await page.getByText('默认收货地址').click();
      await page.getByRole('button', { name: '提交订单' }).click();
    
      await expect(page.getByText('订单提交成功')).toBeVisible();
      await expect(page.getByText('待支付')).toBeVisible();
    });
    
这段代码作为初稿没问题，但还不能直接当稳定自动化资产。
它至少有几个问题：

问题| 影响  
---|---  
测试环境写死| 换环境就要改代码  
账号密码写死| 不安全，也不方便维护  
商品数据依赖页面已有数据| 数据变了脚本就失败  
只断言页面文案| 业务数据不一定正确  
没有清理测试数据| 多次执行可能互相影响  

* * *
### 二、把环境变量抽出来
测试脚本不要写死环境地址、账号、密码。
建议改成：
    
    const baseUrl = process.env.TEST_BASE_URL;
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;
    
使用时：
    
    await page.goto(baseUrl);
    
    await page.getByRole('textbox', { name: '账号' }).fill(username);
    await page.getByRole('textbox', { name: '密码' }).fill(password);
    
这样做的好处是：
  1. 测试环境可以随时切换
  2. 敏感信息不写进代码
  3. 方便接入 CI/CD
  4. 多套环境可以复用同一套脚本


* * *
### 三、准备稳定的测试数据
很多自动化失败，不是脚本写得差，而是测试数据太乱。
订单提交流程至少需要：

数据类型| 示例  
---|---  
正常用户| 可登录、有默认地址  
异常用户| 禁用、未认证、权限不足  
正常商品| 有库存、可购买  
异常商品| 库存不足、下架、限购  
优惠券| 有效、过期、已使用、不满足门槛  
地址数据| 默认地址、空地址、无效地址  

更推荐的方式是：  
![在这里插入图片描述](/cdn/161022913/79d4ccfdd5b046c39192aee7663fc294.png)
* * *
### 四、断言不要只看页面提示
UI 提示“提交成功”，不代表业务真的成功。
订单类场景至少要补三类断言：

断言类型| 示例  
---|---  
页面断言| 页面出现“订单提交成功”  
接口断言| 查询订单接口返回状态为待支付  
数据断言| 库存扣减正确，订单金额正确  

示例：
    
    const response = await page.request.get(`${baseUrl}/api/order/latest`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    expect(response.status()).toBe(200);
    
    const order = await response.json();
    
    expect(order.status).toBe('WAIT_PAY');
    expect(order.totalAmount).toBe(99.00);
    expect(order.productCount).toBe(1);
    
这样脚本才不是只测了“页面有没有提示”，而是真正测到了业务结果。
* * *
### 五、推荐的测试工程目录结构
如果只写几条脚本，文件随便放也能跑。
但只要用例开始变多，就一定要做工程化拆分。
可以参考下面这种结构：
    
    tests/
      order/
        submit-order.spec.js
        cancel-order.spec.js
    
    fixtures/
      auth.fixture.js
      test-data.fixture.js
    
    pages/
      login.page.js
      product.page.js
      cart.page.js
      order.page.js
    
    utils/
      api-client.js
      data-builder.js
      env.js
    
    test-data/
      users.json
      products.json
    
    playwright.config.js
    
各目录职责建议如下：

目录| 作用  
---|---  
tests| 存放具体测试用例  
fixtures| 存放登录态、测试数据等前置能力  
pages| 封装页面操作  
utils| 封装接口请求、环境变量、通用工具  
test-data| 存放可复用测试数据  
playwright.config.js| 管理浏览器、超时、报告、并发等配置  

这样做的好处是：
  1. 页面变了，只改 page 文件
  2. 数据变了，只改 test-data 或 data-builder
  3. 接口变了，只改 api-client
  4. 用例本身更关注业务流程


* * *
### 六、把重复动作封装起来
如果每个用例都写一遍登录、搜索商品、加入购物车，后面维护会很痛苦。
可以先做简单封装：
    
    async function login(page, username, password) {
      await page.getByRole('textbox', { name: '账号' }).fill(username);
      await page.getByRole('textbox', { name: '密码' }).fill(password);
      await page.getByRole('button', { name: '登录' }).click();
    }
    
    async function addProductToCart(page, productName) {
      await page.getByText(productName).click();
      await page.getByRole('button', { name: '加入购物车' }).click();
    }
    
用例里就变成：
    
    await login(page, username, password);
    await addProductToCart(page, '测试商品');
    
后面页面变化时，只需要改公共方法，不需要到处找脚本。
* * *
### 七、自然语言 UI 自动化适合放在哪
像 Midscene.js 这类工具，比较适合做两类事情。
第一类是探索性测试。  
比如快速验证页面主要流程是否能走通。
第二类是低频维护脚本。  
比如后台管理系统、内部工具、运营配置页，这些页面变化多，但测试频率没有核心交易链路那么高。
示例思路：
    
    import { test } from '@playwright/test';
    import { PlaywrightAgent } from '@midscene/web/playwright';
    
    test('使用自然语言完成登录检查', async ({ page }) => {
      await page.goto('https://your-test-env.example.com');
    
      const ai = new PlaywrightAgent(page);
    
      await ai.aiAct('输入账号 test_user');
      await ai.aiAct('输入密码 123456');
      await ai.aiAct('点击登录按钮');
    
      await ai.aiAssert('页面右上角出现用户头像或用户名');
    });
    
不建议一上来就把支付、资金、库存扣减这类核心链路完全交给自然语言脚本。
核心链路还是要有稳定的接口校验和确定性断言。
* * *
### 八、AI 生成脚本时，参考提示词
    
    你是一名资深测试开发工程师，请根据下面测试用例生成 Playwright 自动化脚本。
    
    要求：
    1. 使用 @playwright/test
    2. 优先使用 getByRole、getByText 等稳定定位方式
    3. 不要使用脆弱的 XPath
    4. 环境地址、账号、密码从环境变量读取
    5. 登录、加购、提交订单封装成公共方法
    6. 提交订单后增加接口断言
    7. 输出完整代码
    
    测试用例：
    粘贴测试用例内容
    
如果生成出来的脚本不稳定，可以继续追问：
    
    请检查上面的 Playwright 脚本是否存在稳定性问题。
    
    重点检查：
    1. 是否存在固定等待
    2. 是否存在脆弱定位
    3. 是否缺少断言
    4. 是否依赖脏数据
    5. 是否适合接入 CI
    
* * *
### 九、总结
这一期主要讲从用例到脚本的落地。
几个关键点：
  1. AI 生成的脚本只是初稿
  2. 环境、账号、密码不要写死
  3. 测试数据要可控，最好通过接口准备
  4. UI 断言不够，核心场景要补接口或数据校验
  5. 测试工程要做目录拆分，避免脚本越写越乱
  6. 自然语言 UI 自动化适合从低频场景试点


下一期继续讲：
**自动化执行后，怎么让 AI 分析失败原因，并接入质量门禁。**
