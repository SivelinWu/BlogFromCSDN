# [测试技术] Playwright Test 入门与实战：网络 Mock、失败 Trace 与并行执行

> 原文: https://blog.csdn.net/weixin_42390585/article/details/163120867

> 原创内容，未获授权禁止转载、转发、抄袭。

前端自动化最常见的问题不是“点不到按钮”，而是登录态反复准备、依赖服务不稳定、失败后没有足够证据，以及并行后测试数据相互影响。Playwright Test 将浏览器控制、断言、网络拦截、报告和并行调度放在同一套测试运行器中，适合构建 Web 回归测试。
本文使用一个小型“订单提交”页面，验证成功提交、前端非法输入、服务端异常和成功响应不符合契约四条路径。案例不依赖真实后端，页面和订单接口都由 `page.route()` 提供，重点演示稳定定位、请求断言、Mock 响应和失败诊断配置。
### Playwright Test 适合解决什么问题

能力| 典型用途  
---|---  
Locator 与自动等待| 按角色、标签和文本定位页面元素，避免手动等待  
Browser Context 隔离| 每条测试使用独立 Cookie、缓存和页面状态  
Network Mock| 模拟后端正常、异常和边界数据，不依赖共享测试环境  
Trace、截图、视频| 在失败或重试时保留页面、请求和操作证据  
Projects 与并行| 覆盖 Chromium、Firefox、WebKit，并按 worker 并行执行  
HTML 报告| 聚合测试结果、附件和失败上下文  

截至 2026 年 7 月 23 日，npm 上 `@playwright/test` 最新稳定版为 `1.61.1`，发布于 2026 年 6 月 23 日，要求 Node.js `18+`。Playwright 会为每个版本维护匹配的浏览器二进制，CI 中不要用全局 Chrome 替代其安装命令。
### 环境与配置
示例目录如下：
    
    playwright-test-order-demo/
    ├── package.json
    ├── playwright.config.ts
    └── tests/
        └── order-submit.spec.ts
    
创建 `package.json`，固定 Playwright Test 版本：
    
    {
      "name": "playwright-test-order-demo",
      "private": true,
      "type": "module",
      "engines": {
        "node": ">=18"
      },
      "scripts": {
        "test": "playwright test",
        "test:chromium": "playwright test --project=chromium",
        "test:headed": "playwright test --headed",
        "report": "playwright show-report"
      },
      "devDependencies": {
        "@playwright/test": "1.61.1"
      }
    }
    
安装依赖与 Chromium：
    
    npm install
    npx playwright install chromium
    
本地首次安装可使用 `npm install`；提交 `package-lock.json` 后，CI 应改用 `npm ci`，避免间接依赖变化导致浏览器测试结果漂移。
创建 `playwright.config.ts`：
    
    import { defineConfig, devices } from '@playwright/test';
    
    export default defineConfig({
      testDir: './tests',
      timeout: 30_000,
      fullyParallel: true,
      forbidOnly: !!process.env.CI,
      retries: process.env.CI ? 2 : 0,
      workers: process.env.CI ? 2 : undefined,
      reporter: [['list'], ['html', { open: 'never' }]],
      expect: {
        timeout: 5_000
      },
      use: {
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        serviceWorkers: 'block'
      },
      projects: [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] }
        }
      ]
    });
    
`workers` 固定了 CI 并发上限，避免按构建机 CPU 数无限放大并发；本地仍使用运行器默认值。`timeout` 限制单条测试总时长，`expect.timeout` 限制自动重试断言时长，两者都应按业务页面的真实 SLA 调整。
`fullyParallel` 的前提是用例没有共享账号、订单、文件或端口。`forbidOnly` 防止开发时遗留的 `test.only` 进入 CI；`on-first-retry` 只在某条用例失败并开始第一次重试时记录 Trace，因此本地默认 `retries: 0` 时看不到 `trace.zip` 是正常现象。`serviceWorkers: 'block'` 让网络请求不被页面 Service Worker 抢先处理，适合以 `page.route()` 为主的 Mock 用例。重试只能应对偶发环境问题，提交订单、发券等有外部副作用的流程必须先具备幂等保护。
### 订单提交实战
创建 `tests/order-submit.spec.ts`：
    
    import { expect, test } from '@playwright/test';
    
    const orderPage = `
      &lt;main&gt;
        &lt;h1&gt;订单提交&lt;/h1&gt;
        &lt;label for="amount"&gt;订单金额&lt;/label&gt;
        &lt;input id="amount" value="99" /&gt;
        &lt;button type="button"&gt;提交订单&lt;/button&gt;
        <p role="status" aria-live="polite">&lt;/p&gt;
        &lt;p role="alert"&gt;&lt;/p&gt;
      &lt;/main&gt;
      <script>
        const amountInput = document.querySelector('input');
        const status = document.querySelector('[role="status"]');
        const alert = document.querySelector('[role="alert"]');
        const submitButton = document.querySelector('button');
    
        submitButton.addEventListener('click', async () => {
          const amount = Number(amountInput.value);
          status.textContent = '';
          alert.textContent = '';
          if (!Number.isInteger(amount) || amount <= 0) {
            alert.textContent = '订单金额必须大于 0';
            return;
          }
    
          try {
            const response = await fetch('/api/orders', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ amount })
            });
            if (!response.ok) {
              throw new Error('create order failed');
            }
            const order = await response.json();
            if (typeof order.orderId !== 'string') {
              throw new Error('invalid order response');
            }
            status.textContent = '订单创建成功：' + order.orderId;
          } catch {
            alert.textContent = '订单提交失败，请稍后重试';
          }
        });
      </script>
    `;
    
    test.describe('订单提交', () => {
      test.beforeEach(async ({ page }) => {
        await page.route('https://shop.example.test/', async route => {
          await route.fulfill({
            contentType: 'text/html; charset=utf-8',
            body: orderPage
          });
        });
        await page.goto('https://shop.example.test/');
      });
    
      test('提交有效金额后发送正确请求并展示订单号', async ({ page }) => {
        let requestBody: unknown;
        await page.route('https://shop.example.test/api/orders', async route => {
          expect(route.request().method()).toBe('POST');
          expect(await route.request().headerValue('content-type')).toBe('application/json');
          requestBody = route.request().postDataJSON();
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ orderId: 'ORDER-1001' })
          });
        });
    
        await page.getByLabel('订单金额').fill('198');
        await page.getByRole('button', { name: '提交订单' }).click();
    
        await expect(page.getByRole('status')).toHaveText('订单创建成功：ORDER-1001');
        expect(requestBody).toEqual({ amount: 198 });
      });
    
      test('非法金额不发送订单请求', async ({ page }) => {
        let requestSent = false;
        await page.route('https://shop.example.test/api/orders', async route => {
          requestSent = true;
          await route.fulfill({ status: 500, body: '{}' });
        });
    
        await page.getByLabel('订单金额').fill('0');
        await page.getByRole('button', { name: '提交订单' }).click();
    
        await expect(page.getByRole('alert')).toHaveText('订单金额必须大于 0');
        expect(requestSent).toBe(false);
      });
    
      test('服务端失败时展示可恢复提示', async ({ page }) => {
        await page.route('https://shop.example.test/api/orders', async route => {
          expect(route.request().method()).toBe('POST');
          await route.fulfill({ status: 500, body: '{}' });
        });
    
        await page.getByRole('button', { name: '提交订单' }).click();
    
        await expect(page.getByRole('alert')).toHaveText('订单提交失败，请稍后重试');
      });
    
      test('成功响应缺少订单号时展示可恢复提示', async ({ page }) => {
        await page.route('https://shop.example.test/api/orders', async route => {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: '{}'
          });
        });
    
        await page.getByRole('button', { name: '提交订单' }).click();
    
        await expect(page.getByRole('alert')).toHaveText('订单提交失败，请稍后重试');
      });
    });
    
四个用例分别验证正常路径、前端短路、服务端失败和响应契约异常。成功路径同时检查请求方法、JSON 内容类型、请求体和页面文案；这些断言写在 route handler 中，任何不符合契约的请求都会让用例失败。非法金额用例断言接口根本没有被调用；500 与缺少订单号的 201 响应都必须展示可恢复提示。
页面使用 `getByLabel()` 和 `getByRole()`，它们依赖用户可感知的语义，而不是脆弱的 CSS 层级或序号。成功结果放入 `status`，错误结果放入 `alert`，屏幕阅读器和测试脚本都能区分两类反馈。`expect(...).toHaveText()` 会自动等待状态更新，不需要加入 `waitForTimeout()`。示例中返回 HTML 时显式声明 `charset=utf-8`，否则中文标签可能被浏览器按错误编码解析，导致语义定位超时。
`page.route()` 必须在对应请求发生前注册。页面 HTML 路由在 `page.goto()` 前注册；订单接口由点击按钮后触发，因此在点击前注册即可。示例把 API 匹配为完整同源 URL，避免宽泛通配符意外拦截其他服务。Mock 用于隔离不稳定或难构造的系统边界，不能替代对核心业务流程的真实集成验证。
### 登录态、Trace 与并行
需要复用登录态时，按官方的 setup project 在登录成功后生成 `storageState`，再由依赖它的浏览器项目读取；不要把登录步骤混进每条业务用例。认证文件通常放在 `playwright/.auth`，其中可能包含 Cookie 和 Token，必须加入 `.gitignore`，并在账号失效后重新生成；多账号或并行场景应按 worker 准备独立账号和状态文件。
失败后先打开 HTML 报告：
    
    npx playwright show-report
    
发生重试后，报告中的失败附件可直接打开 Trace。命令行场景则使用本次运行实际生成的 `trace.zip` 路径执行 `npx playwright show-trace &lt;trace.zip 路径&gt;`。Trace 能还原页面快照、网络请求、控制台信息和每一步操作；它适合定位“本地通过、CI 失败”这类问题，但不能代替对失败根因的判断，例如接口返回 500 时仍应确认前端处理是否符合预期。
并行不是默认提速开关。浏览器上下文彼此隔离，不代表数据库记录、测试账号和第三方回调也隔离；共享资源未处理前，应先串行执行或限制 worker 数。能隔离的数据可带上 worker 前缀，例如 `e2e-${workerIndex}-${时间戳}`，并在用例结束后清理。
### 执行与报告
本文示例在 Node.js `24.14.0`、Playwright Test `1.61.1`、Chromium 环境中实际执行：
    
    # 使用配置中的默认并行策略
    npx playwright test --project=chromium
    
    # 显式使用两个 worker
    npx playwright test --project=chromium --workers=2
    
执行方式| 结果  
---|---  
默认并行策略| 4 条通过  
`--workers=2`| 4 条通过  

执行完成后会生成 `playwright-report`。CI 应归档该目录和 `test-results`，这样失败时可以查看截图、视频和 Trace；不要只保留控制台最后一行错误。本地产物和认证状态不应提交：
    
    playwright-report/
    test-results/
    playwright/.auth/
    
PR 门禁建议先固定 Chromium；Firefox、WebKit 的跨浏览器覆盖放到夜间任务或发布前任务。这样既能快速反馈，又不会在每次提交时放大执行成本。
### 常见问题

问题| 处理方式  
---|---  
Locator 超时| 优先检查页面是否加载、可访问名称是否唯一、字符集是否正确，不要先加固定等待；定位不稳定时再补 `data-testid`  
Mock 没有命中| 检查注册时机、实际 URL、请求方法和匹配范围；页面使用 Service Worker 时确认已阻止或处理它  
并行后偶发失败| 排查共享账号、数据库主键、文件目录、端口和第三方回调  
CI 没有 Trace| `on-first-retry` 只有发生重试才生成 Trace，确认 `retries` 大于 0  
登录态本地可用、CI 失效| 检查状态文件是否过期、是否被提交、账号是否被并行 worker 共用  
选择器经常变化| 优先使用 Role、Label、Text、Test ID，避免按样式类名和 DOM 层级定位  

### 工程实践建议
  * 页面断言与请求断言一起写，避免只验证“点完有提示”
  * 一个 Mock 用例只模拟一个明确边界，不用 Mock 掩盖被测前端自己的计算逻辑
  * 失败诊断默认保留 Trace、截图或视频中的至少一种证据
  * 登录态、订单和测试文件按 worker 隔离后再开启并行，并清理测试数据
  * 将 `test.only`、浏览器安装、报告归档、产物忽略和失败重试放进 CI 基线配置


### 总结
Playwright Test 的重点不只是控制浏览器，而是让 UI 行为、网络边界和失败证据在同一个测试中可验证。先用语义定位和自动等待写稳定用例，再用 Mock 控制外部依赖，最后在数据隔离后开启并行，回归集才会真正可维护。
