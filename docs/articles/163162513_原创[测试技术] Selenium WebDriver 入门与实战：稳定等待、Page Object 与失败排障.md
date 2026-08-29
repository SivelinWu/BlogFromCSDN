# 原创[测试技术] Selenium WebDriver 入门与实战：稳定等待、Page Object 与失败排障

> 原文: https://blog.csdn.net/weixin_42390585/article/details/163162513

> 原创内容，未获授权禁止转载、转发、抄袭。

Selenium 用例难维护，通常不是因为不会点击按钮，而是定位器依赖 DOM 层级、异步页面使用固定休眠、浏览器会话没有释放，以及失败后只剩一段超时日志。用例数量一多，这些问题会集中表现为执行慢、偶发失败和排障困难。
本文使用一个“订单提交”页面，通过 7 条可执行测试覆盖成功提交、非法金额和重复点击，并把 Selenium Manager、显式等待、Page Object、JUnit 生命周期和失败截图串成一个完整 Java 工程。
### Selenium WebDriver 适合解决什么问题
Selenium WebDriver 是浏览器自动化 API，不负责测试发现、断言和报告，Java 项目通常需要配合 JUnit 或 TestNG。它通过浏览器厂商提供的驱动控制真实浏览器，适合 Web 端兼容性测试、核心流程回归和跨机器执行。

能力| 典型用途  
---|---  
WebDriver 标准| 使用统一 API 控制 Chrome、Firefox、Edge 和 Safari  
Selenium Manager| 自动发现浏览器并管理匹配的驱动  
显式等待| 等待元素进入可点击、可见或满足业务状态  
Page Object| 集中管理定位器和页面操作，降低页面变化影响  
Grid| 在不同浏览器和机器上分发、并行执行  
截图与浏览器信息| 为失败用例保留页面证据和运行环境  

截至 2026 年 7 月 24 日，Maven Central 上 `selenium-java` 最新稳定版为 `4.46.0`，对应的 GitHub 官方版本发布于 2026 年 7 月 11 日。Selenium Java 绑定要求 Java 11+；本文搭配的 JUnit `6.1.2` 要求 Java 17+，因此示例统一使用 Java 17。
### 环境与依赖
示例目录如下：
    
    selenium-order-demo/
    ├── pom.xml
    └── src/test/
        ├── java/demo/
        │   ├── OrderPage.java
        │   ├── OrderPageTest.java
        │   └── ScreenshotOnFailure.java
        └── resources/
            └── order.html
    
创建 `pom.xml`：
    
    <?xml version="1.0" encoding="UTF-8"?>
    <project xmlns="http://maven.apache.org/POM/4.0.0"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
                                 https://maven.apache.org/xsd/maven-4.0.0.xsd">
        <modelVersion>4.0.0</modelVersion>
    
        &lt;groupId&gt;demo&lt;/groupId&gt;
        &lt;artifactId&gt;selenium-order-demo&lt;/artifactId&gt;
        <version>1.0-SNAPSHOT</version>
    
        <properties>
            <maven.compiler.release>17</maven.compiler.release>
            <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
            <selenium.version>4.46.0</selenium.version>
            <junit.version>6.1.2</junit.version>
        </properties>
    
        &lt;dependencyManagement&gt;
            <dependencies>
                &lt;dependency&gt;
                    &lt;groupId&gt;org.junit&lt;/groupId&gt;
                    &lt;artifactId&gt;junit-bom&lt;/artifactId&gt;
                    <version>${junit.version}</version>
                    &lt;type&gt;pom&lt;/type&gt;
                    <scope>import</scope>
                &lt;/dependency&gt;
            </dependencies>
        &lt;/dependencyManagement&gt;
    
        <dependencies>
            &lt;dependency&gt;
                &lt;groupId&gt;org.seleniumhq.selenium&lt;/groupId&gt;
                &lt;artifactId&gt;selenium-java&lt;/artifactId&gt;
                <version>${selenium.version}</version>
                <scope>test</scope>
            &lt;/dependency&gt;
            &lt;dependency&gt;
                &lt;groupId&gt;org.junit.jupiter&lt;/groupId&gt;
                &lt;artifactId&gt;junit-jupiter&lt;/artifactId&gt;
                <scope>test</scope>
            &lt;/dependency&gt;
        </dependencies>
    
        &lt;build&gt;
            <plugins>
                &lt;plugin&gt;
                    &lt;groupId&gt;org.apache.maven.plugins&lt;/groupId&gt;
                    &lt;artifactId&gt;maven-compiler-plugin&lt;/artifactId&gt;
                    <version>3.13.0</version>
                &lt;/plugin&gt;
                &lt;plugin&gt;
                    &lt;groupId&gt;org.apache.maven.plugins&lt;/groupId&gt;
                    &lt;artifactId&gt;maven-surefire-plugin&lt;/artifactId&gt;
                    <version>3.5.5</version>
                &lt;/plugin&gt;
            </plugins>
        &lt;/build&gt;
    &lt;/project&gt;
    
`selenium-java` 和 JUnit 都只用于测试，因此依赖作用域设为 `test`；JUnit BOM 只统一 JUnit 模块版本，不管理 Selenium。编译插件和 Surefire 也固定版本，避免开发机与 CI 随插件自动解析结果变化。
执行 `new ChromeDriver()` 时，Selenium Manager 会发现本机 Chrome，并在驱动不可用时解析、下载匹配的 ChromeDriver。首次执行需要访问浏览器驱动下载源；受限网络或离线 CI 应预先准备兼容的浏览器与驱动缓存，不能把自动下载当成永远可用的前提。团队项目还应提交 Maven Wrapper，让本地和 CI 使用同一 Maven 版本。
### 准备被测页面
创建 `src/test/resources/order.html`。页面提交后延迟 150 ms 返回结果，用于演示显式等待；提交期间按钮会被禁用，防止重复创建订单。
    
    &lt;!doctype html&gt;
    &lt;html lang="zh-CN"&gt;
    &lt;head&gt;
      <meta charset="utf-8">
      &lt;title&gt;订单提交&lt;/title&gt;
    &lt;/head&gt;
    &lt;body&gt;
      &lt;main&gt;
        &lt;h1&gt;订单提交&lt;/h1&gt;
        &lt;form id="order-form"&gt;
          &lt;label for="amount"&gt;订单金额&lt;/label&gt;
          <input id="amount" name="amount" type="text" inputmode="decimal" autocomplete="off">
          <button type="submit" data-testid="submit-order">提交订单&lt;/button&gt;
        &lt;/form&gt;
        <p id="success" role="status" aria-live="polite" hidden>&lt;/p&gt;
        &lt;p id="error" role="alert" hidden&gt;&lt;/p&gt;
        <output id="submit-count" hidden>0&lt;/output&gt;
      &lt;/main&gt;
      <script>
        const form = document.querySelector('#order-form');
        const amountInput = document.querySelector('#amount');
        const submitButton = document.querySelector('[data-testid="submit-order"]');
        const success = document.querySelector('#success');
        const error = document.querySelector('#error');
        const submitCount = document.querySelector('#submit-count');
    
        form.addEventListener('submit', event => {
          event.preventDefault();
          success.hidden = true;
          error.hidden = true;
          success.textContent = '';
          error.textContent = '';
    
          const rawAmount = amountInput.value.trim();
          const amount = Number(rawAmount);
          if (rawAmount === '' || !Number.isInteger(amount) || amount <= 0) {
            error.textContent = '订单金额必须是正整数';
            error.hidden = false;
            return;
          }
    
          submitButton.disabled = true;
          setTimeout(() => {
            const count = Number(submitCount.value) + 1;
            submitCount.value = String(count);
            success.textContent = '订单创建成功：ORDER-' + (1000 + count);
            success.hidden = false;
            submitButton.disabled = false;
          }, 150);
        });
      </script>
    &lt;/body&gt;
    &lt;/html&gt;
    
输入框显式使用 `type="text"`，让 `abc` 等非法字符能够进入前端业务校验；如果改成 `type="number"`，浏览器可能先过滤部分输入，测试目标就会从“业务规则”变成“浏览器原生校验”。`label`、`status` 和 `alert` 同时保留了可访问语义，定位器不必依赖样式类名。
真实项目应访问测试环境地址。这里使用本地资源，是为了隔离网络、账号和后端数据波动，让示例只验证 WebDriver 的交互与等待逻辑；它不覆盖 HTTP、鉴权、接口调用和服务端写库，不能替代真实环境端到端测试。
### Page Object：定位与断言分离
创建 `src/test/java/demo/OrderPage.java`：
    
    package demo;
    
    import java.time.Duration;
    
    import org.openqa.selenium.By;
    import org.openqa.selenium.WebDriver;
    import org.openqa.selenium.support.ui.ExpectedConditions;
    import org.openqa.selenium.support.ui.WebDriverWait;
    
    final class OrderPage {
        private final WebDriver driver;
        private final WebDriverWait wait;
    
        private final By amountInput = By.id("amount");
        private final By submitButton = By.cssSelector("[data-testid='submit-order']");
        private final By successMessage = By.id("success");
        private final By errorMessage = By.id("error");
        private final By submitCount = By.id("submit-count");
    
        OrderPage(WebDriver driver) {
            this.driver = driver;
            this.wait = new WebDriverWait(driver, Duration.ofSeconds(5));
            wait.until(ExpectedConditions.titleIs("订单提交"));
        }
    
        void enterAmount(String amount) {
            var input = driver.findElement(amountInput);
            input.clear();
            input.sendKeys(amount);
        }
    
        void clickSubmit() {
            driver.findElement(submitButton).click();
        }
    
        void submit(String amount) {
            enterAmount(amount);
            clickSubmit();
        }
    
        String waitForSuccess() {
            wait.until(ExpectedConditions.textToBePresentInElementLocated(
                    successMessage, "订单创建成功"
            ));
            return driver.findElement(successMessage).getText();
        }
    
        String waitForError() {
            wait.until(ExpectedConditions.textToBePresentInElementLocated(
                    errorMessage, "订单金额必须是正整数"
            ));
            return driver.findElement(errorMessage).getText();
        }
    
        int submissionCount() {
            return Integer.parseInt(driver.findElement(submitCount).getDomProperty("value"));
        }
    
        boolean waitUntilSubmitEnabled() {
            return wait.until(ExpectedConditions.elementToBeClickable(submitButton)).isEnabled();
        }
    
        boolean isSuccessVisible() {
            return driver.findElement(successMessage).isDisplayed();
        }
    
        boolean isErrorVisible() {
            return driver.findElement(errorMessage).isDisplayed();
        }
    }
    
定位器优先使用稳定且唯一的 `id`；没有业务标识时，可让开发提供 `data-testid`。不要默认使用绝对 XPath 或包含多层序号的 CSS。Page Object 保存的是 `By`，每次操作时重新查找元素，页面刷新或局部重绘后不会继续使用已经失效的 `WebElement`。
构造方法等待标题出现，只用于确认当前页面加载正确；业务断言仍留在测试类。`waitForSuccess()` 等待“成功文案已经写入”这一业务状态，比只等待元素可见更准确。示例把隐式等待保持为 0，固定 `Thread.sleep()` 无法感知页面提前完成，还会在页面变慢时直接失败；隐式等待与显式等待混用则可能放大实际超时时间。
### 失败时自动截图
Selenium 没有内置 Trace。创建 `src/test/java/demo/ScreenshotOnFailure.java`，在测试方法失败后、浏览器退出前保存截图：
    
    package demo;
    
    import java.io.IOException;
    import java.nio.file.Files;
    import java.nio.file.Path;
    import java.util.function.Supplier;
    
    import org.junit.jupiter.api.extension.AfterTestExecutionCallback;
    import org.junit.jupiter.api.extension.ExtensionContext;
    import org.openqa.selenium.OutputType;
    import org.openqa.selenium.TakesScreenshot;
    import org.openqa.selenium.WebDriver;
    
    final class ScreenshotOnFailure implements AfterTestExecutionCallback {
        private final Supplier&lt;WebDriver&gt; driverSupplier;
    
        ScreenshotOnFailure(Supplier&lt;WebDriver&gt; driverSupplier) {
            this.driverSupplier = driverSupplier;
        }
    
        @Override
        public void afterTestExecution(ExtensionContext context) {
            if (context.getExecutionException().isEmpty()) {
                return;
            }
    
            WebDriver driver = driverSupplier.get();
            if (!(driver instanceof TakesScreenshot screenshot)) {
                return;
            }
    
            try {
                Path directory = Path.of("target", "screenshots");
                Files.createDirectories(directory);
                String name = Integer.toHexString(context.getUniqueId().hashCode()) + ".png";
                Files.write(directory.resolve(name), screenshot.getScreenshotAs(OutputType.BYTES));
            } catch (IOException | RuntimeException error) {
                context.publishReportEntry("screenshot-error", error.toString());
            }
        }
    }
    
截图文件名使用测试唯一 ID 的哈希，避免并行执行时相互覆盖，也不会把账号、订单号等业务数据写进文件名。截图或文件写入失败只登记到测试报告，不覆盖原始断言异常。
`AfterTestExecutionCallback` 在测试方法结束后、`@AfterEach` 退出浏览器前执行，适合捕获断言失败；如果 `@BeforeEach` 在浏览器启动阶段就失败，它不会生成截图，此时需要依赖 Selenium Manager 日志和 CI 环境信息。WebDriver 截图通常只包含当前视口，也不能还原网络请求，排障时仍应同时保留浏览器日志、服务端链路标识和 Surefire 报告。
### 编写 Selenium 测试
创建 `src/test/java/demo/OrderPageTest.java`：
    
    package demo;
    
    import static org.junit.jupiter.api.Assertions.assertAll;
    import static org.junit.jupiter.api.Assertions.assertEquals;
    import static org.junit.jupiter.api.Assertions.assertFalse;
    import static org.junit.jupiter.api.Assertions.assertNotNull;
    import static org.junit.jupiter.api.Assertions.assertTrue;
    
    import java.net.URL;
    import java.time.Duration;
    
    import org.junit.jupiter.api.AfterEach;
    import org.junit.jupiter.api.BeforeEach;
    import org.junit.jupiter.api.Test;
    import org.junit.jupiter.api.extension.RegisterExtension;
    import org.junit.jupiter.params.ParameterizedTest;
    import org.junit.jupiter.params.provider.ValueSource;
    import org.openqa.selenium.WebDriver;
    import org.openqa.selenium.chrome.ChromeDriver;
    import org.openqa.selenium.chrome.ChromeOptions;
    
    class OrderPageTest {
        private WebDriver driver;
        private OrderPage page;
    
        @RegisterExtension
        final ScreenshotOnFailure screenshots = new ScreenshotOnFailure(() -> driver);
    
        @BeforeEach
        void setUp() {
            ChromeOptions options = new ChromeOptions();
            if (Boolean.parseBoolean(System.getProperty("headless", "true"))) {
                options.addArguments("--headless=new");
            }
            options.addArguments("--window-size=1280,900");
    
            driver = new ChromeDriver(options);
            driver.manage().timeouts().implicitlyWait(Duration.ZERO);
            driver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(15));
    
            URL fixture = getClass().getClassLoader().getResource("order.html");
            assertNotNull(fixture, "order.html 不存在");
            driver.get(fixture.toExternalForm());
            page = new OrderPage(driver);
        }
    
        @AfterEach
        void tearDown() {
            if (driver != null) {
                driver.quit();
            }
        }
    
        @Test
        void submitsValidAmountAndShowsOrderId() {
            page.submit("198");
    
            assertAll(
                    () -> assertEquals("订单创建成功：ORDER-1001", page.waitForSuccess()),
                    () -> assertEquals(1, page.submissionCount()),
                    () -> assertTrue(page.waitUntilSubmitEnabled()),
                    () -> assertFalse(page.isErrorVisible())
            );
        }
    
        @ParameterizedTest
        @ValueSource(strings = {"", "0", "-1", "1.5", "abc"})
        void rejectsInvalidAmountWithoutSubmitting(String amount) {
            page.submit(amount);
    
            assertAll(
                    () -> assertEquals("订单金额必须是正整数", page.waitForError()),
                    () -> assertEquals(0, page.submissionCount()),
                    () -> assertFalse(page.isSuccessVisible())
            );
        }
    
        @Test
        void ignoresSecondClickWhileSubmitting() {
            page.enterAmount("198");
            page.clickSubmit();
            page.clickSubmit();
    
            assertAll(
                    () -> assertEquals("订单创建成功：ORDER-1001", page.waitForSuccess()),
                    () -> assertEquals(1, page.submissionCount())
            );
        }
    }
    
无头模式仍固定 `1280×900` 窗口，避免响应式布局因开发机分辨率不同而切换。`pageLoadTimeout` 只限制页面导航，不会替代等待异步业务结果；订单结果仍由 Page Object 中的显式等待负责。
每条测试创建独立浏览器会话，并在 `@AfterEach` 中调用 `quit()` 关闭全部窗口和驱动进程。`close()` 只关闭当前窗口，不适合作为测试清理方案。`driver != null` 的判断只能处理 Driver 已经赋值的情况；浏览器创建前失败时没有页面可截图，应直接查看启动日志。
参数化测试覆盖空字符串、0、负数、小数和非数字，并断言提交次数仍为 0、成功提示没有出现；正常路径则反向确认错误提示未出现。重复点击用例不仅检查成功提示，还检查实际提交次数，避免“页面看起来成功，但后台创建两次”的漏测。`@RegisterExtension` 使用 Driver Supplier，是因为扩展对象创建时浏览器尚未在 `@BeforeEach` 中初始化。
### 执行与验证
默认使用无头 Chrome：
    
    mvn test
    
本地排查时显示浏览器：
    
    mvn test -Dheadless=false
    
构建产物不应提交代码库：
    
    target/
    
本文示例在 Temurin `17.0.19`、Maven `3.9.9`、Selenium `4.46.0` 和 Chrome `150.0.7871.183` 环境实际执行：
    
    Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
    
其中两个普通测试加上五组非法金额参数，共计 7 条。首次运行可能因 Selenium Manager 下载驱动而较慢，不能据此判断页面性能；CI 应归档 `target/surefire-reports`，失败时再同时保留 `target/screenshots`。
### CI、并行与 Grid
CI 应固定 JDK、浏览器和 Selenium 依赖版本，并使用批处理模式执行 `mvn -B -ntp test`。无头模式仍需要安装真实浏览器及其系统依赖；不要因为没有界面就省略浏览器准备。Selenium Manager 缓存只能用于提速，浏览器升级后仍要允许它获取匹配驱动；跨操作系统或 CPU 架构不能复用同一份驱动缓存。完全离线环境应把兼容的浏览器与驱动作为构建镜像的一部分。
并行执行时，每个线程必须使用独立 `WebDriver`、账号和业务数据，不能把单例 Driver 在测试间共享，WebDriver 实例本身也不保证线程安全。需要线程级管理时可以使用 `ThreadLocal&lt;WebDriver&gt;`，但必须在清理阶段同时执行 `quit()` 和 `remove()`，否则线程池复用时仍会泄漏会话。浏览器隔离不等于数据库隔离，订单号、手机号等数据应加入 worker 前缀并在执行后清理。
单机资源不足或需要跨浏览器时，可将 `ChromeDriver` 替换为连接 Selenium Grid 的 `RemoteWebDriver`；浏览器选项仍通过 capabilities 传给 Grid，节点负责提供浏览器和驱动。先在少量核心用例上验证 Chrome，再把 Firefox、Edge 和 Safari 兼容性覆盖放到夜间或发布前任务，避免每次提交都承担完整矩阵成本。
### 常见问题

问题| 处理方式  
---|---  
找不到浏览器驱动| 检查浏览器是否安装、网络是否能访问驱动源，以及代理是否传给 Selenium Manager  
`NoSuchElementException`| 先确认 URL、窗口和 iframe 上下文，再检查定位器；iframe 元素必须先等待并切入  
`StaleElementReferenceException`| 页面刷新或局部重绘后用 `By` 重新定位，不要缓存 `WebElement` 或全局捕获后无限重试  
`ElementClickInterceptedException`| 检查遮罩、弹窗和滚动位置，等待真正可点击状态，不要直接用 JavaScript 绕过用户交互  
显式等待仍然很慢| 检查是否混用了隐式等待，以及等待条件是否对应真实业务状态  
本地通过、CI 失败| 对齐浏览器版本、窗口大小、时区、语言、字体和测试数据，并归档截图与报告  
并行后浏览器互相影响| 不共享 Driver、下载目录、账号和业务主键，限制并发数量  

### 工程实践建议
  * 定位器优先级通常是稳定 `id`、`data-testid`、语义属性，再考虑短 CSS 或 XPath
  * 等待业务状态，不等待固定秒数；不要混用隐式等待与显式等待
  * Page Object 封装页面操作，断言留在测试类；窗口或 iframe 切换后及时恢复上下文
  * 每条测试独立创建并释放 Driver，失败时保留截图、浏览器日志和服务端链路标识；截图可能包含账号和业务数据，CI 产物应限制访问并设置保留期限
  * UI 自动化只覆盖关键流程，字段组合和异常规则优先下沉到接口或单元测试
  * 重试只处理已经确认的环境抖动，并记录首次失败证据；具有下单、发券等副作用的流程必须先保证幂等


### 总结
Selenium WebDriver 不替代测试框架，也不会自动解决页面同步和数据隔离。把驱动管理、业务状态等待、页面封装、会话清理和失败证据设为工程基线，再把高成本 UI 用例集中在关键链路，回归集才会稳定且可维护。
