# [测试技术] JUnit 6 入门与实战：断言、参数化与 Mockito

> 原文: https://blog.csdn.net/weixin_42390585/article/details/163044377

> 原创内容，未获授权禁止转载、转发、抄袭。

Java 项目通常不缺测试框架，真正容易出问题的是：只验证正常返回，不验证异常分支；Mock 了外部依赖，却没有检查错误副作用；测试数量很多，业务规则仍然没有被覆盖。
JUnit 是 Java 生态中最常用的测试框架。本文使用“取消订单”场景，把 JUnit 6、参数化测试、Mockito 和 Maven 集成串起来，重点放在可以直接落地的测试写法。
### JUnit 6 能做什么
JUnit 6 由三个部分组成：

模块| 作用  
---|---  
JUnit Platform| 发现、执行测试，并为 IDE 和构建工具提供统一入口  
JUnit Jupiter| 编写 JUnit 测试的注解、断言、参数化和扩展模型  
JUnit Vintage| 兼容运行 JUnit 3、JUnit 4 测试，仅建议迁移期间临时使用  

截至 2026 年 7 月 20 日，JUnit 最新正式版为 `6.1.2`，发布于 2026 年 7 月 12 日。该版本中的 Platform、Jupiter 和 Vintage 统一使用 `6.1.2` 版本号，运行时要求 Java 17 或更高版本。
### 使用 Maven 集成 JUnit
示例目录如下：
    
    junit-demo/
    ├── pom.xml
    └── src/
        ├── main/java/demo/
        │   └── OrderService.java
        └── test/java/demo/
            ├── OrderServiceTest.java
            └── OrderStatusTest.java
    
`pom.xml`：
    
    <?xml version="1.0" encoding="UTF-8"?>
    <project xmlns="http://maven.apache.org/POM/4.0.0"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
                                 https://maven.apache.org/xsd/maven-4.0.0.xsd">
        <modelVersion>4.0.0</modelVersion>
    
        &lt;groupId&gt;demo&lt;/groupId&gt;
        &lt;artifactId&gt;junit-demo&lt;/artifactId&gt;
        <version>1.0-SNAPSHOT</version>
    
        <properties>
            <maven.compiler.release>17</maven.compiler.release>
            <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
            <junit.version>6.1.2</junit.version>
            <mockito.version>5.23.0</mockito.version>
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
                &lt;groupId&gt;org.junit.jupiter&lt;/groupId&gt;
                &lt;artifactId&gt;junit-jupiter&lt;/artifactId&gt;
                <scope>test</scope>
            &lt;/dependency&gt;
            &lt;dependency&gt;
                &lt;groupId&gt;org.mockito&lt;/groupId&gt;
                &lt;artifactId&gt;mockito-junit-jupiter&lt;/artifactId&gt;
                <version>${mockito.version}</version>
                <scope>test</scope>
            &lt;/dependency&gt;
        </dependencies>
    
        &lt;build&gt;
            <plugins>
                &lt;plugin&gt;
                    &lt;groupId&gt;org.apache.maven.plugins&lt;/groupId&gt;
                    &lt;artifactId&gt;maven-surefire-plugin&lt;/artifactId&gt;
                    <version>3.5.5</version>
                    &lt;configuration&gt;
                        &lt;argLine&gt;
                            -javaagent:${settings.localRepository}/org/mockito/mockito-core/${mockito.version}/mockito-core-${mockito.version}.jar
                        &lt;/argLine&gt;
                    &lt;/configuration&gt;
                &lt;/plugin&gt;
            </plugins>
        &lt;/build&gt;
    &lt;/project&gt;
    
JUnit BOM 只统一 JUnit 各模块的版本，因此 Mockito 仍需单独指定版本。`junit-jupiter` 已包含编写和运行 Jupiter 测试所需的组件。JUnit 6 要求 Maven Surefire 或 Failsafe 至少为 `3.0.0`，这里使用官方文档示例中的 `3.5.5`。
Mockito 5 默认使用 inline mock maker。Surefire 中显式加载 `mockito-core` Java Agent，可以避免受限环境无法动态附加 Agent，并适配新版本 JDK 对 Agent 加载的限制。项目如果同时使用 JaCoCo，需要合并两者的 `argLine`，不能相互覆盖。
执行前先运行 `mvn -version`，确认 Maven 实际使用的是 Java 17+，因为终端的 `java -version` 与 Maven 使用的 `JAVA_HOME` 可能不同。项目中还应固定依赖和插件版本，避免开发机与 CI 因自动升级出现不一致结果。
### 准备被测代码
示例业务规则：
  * 订单不存在时取消失败
  * 只有待支付订单可以取消
  * 取消订单需要先释放库存
  * 库存释放成功后才能保存取消状态
  * 订单保存失败时需要回补库存
  * 已支付订单不能取消，也不能释放库存


创建 `src/main/java/demo/OrderService.java`：
    
    package demo;
    
    import java.util.Optional;
    
    enum OrderStatus {
        PENDING,
        PAID,
        CANCELLED;
    
        boolean canCancel() {
            return this == PENDING;
        }
    }
    
    record Order(long id, long productId, int quantity, OrderStatus status) {
        Order withStatus(OrderStatus newStatus) {
            return new Order(id, productId, quantity, newStatus);
        }
    }
    
    interface OrderRepository {
        Optional&lt;Order&gt; findById(long orderId);
    
        void save(Order order);
    }
    
    interface InventoryService {
        void release(long productId, int quantity);
    
        void reserve(long productId, int quantity);
    }
    
    public class OrderService {
        private final OrderRepository repository;
        private final InventoryService inventory;
    
        public OrderService(OrderRepository repository, InventoryService inventory) {
            this.repository = repository;
            this.inventory = inventory;
        }
    
        public Order cancel(long orderId) {
            Order order = repository.findById(orderId)
                    .orElseThrow(() -> new IllegalArgumentException("订单不存在"));
    
            if (!order.status().canCancel()) {
                throw new IllegalStateException("当前状态不允许取消");
            }
    
            inventory.release(order.productId(), order.quantity());
            Order cancelled = order.withStatus(OrderStatus.CANCELLED);
            try {
                repository.save(cancelled);
            } catch (RuntimeException error) {
                inventory.reserve(order.productId(), order.quantity());
                throw error;
            }
            return cancelled;
        }
    }
    
订单仓储和库存服务都通过构造方法注入。单元测试可以用 Mockito 替换数据库和远程库存服务，只验证 `OrderService` 的业务规则。示例使用同步回补展示失败分支；真实项目还需要考虑回补失败、重复执行和跨系统一致性，通常通过幂等补偿、事务消息等方案处理。
### 常用注解与断言
JUnit Jupiter 常用注解：

注解| 作用  
---|---  
`@Test`| 标记普通测试方法  
`@BeforeEach`、`@AfterEach`| 每条测试前后执行  
`@BeforeAll`、`@AfterAll`| 当前测试类全部测试前后执行  
`@ParameterizedTest`| 标记参数化测试  
`@Nested`| 按业务场景组织嵌套测试类  
`@Tag`| 给测试分类，便于按组执行  
`@Disabled`| 临时禁用测试，应注明原因并尽快恢复  
`@TempDir`| 为文件测试创建并自动清理临时目录  

常用断言示例：
    
    assertEquals(OrderStatus.CANCELLED, actual.status());
    
    assertAll(
            () -> assertEquals(1001L, actual.id()),
            () -> assertEquals(2, actual.quantity())
    );
    
    IllegalStateException error = assertThrows(
            IllegalStateException.class,
            () -> service.cancel(1002L)
    );
    assertEquals("当前状态不允许取消", error.getMessage());
    
    Order result = assertTimeout(
            Duration.ofSeconds(2),
            () -> service.cancel(1001L)
    );
    assertEquals(OrderStatus.CANCELLED, result.status());
    
断言的参数顺序是“期望值在前，实际值在后”。`assertAll()` 会执行组内全部断言，适合一次检查同一对象的多个字段；`assertThrows()` 会返回捕获到的异常，可以继续验证异常信息。它允许抛出指定异常的子类，需要严格匹配异常类型时使用 `assertThrowsExactly()`。
`assertTimeout()` 在当前线程执行代码，超时后会等代码执行完再报告失败。阈值应为 CI 波动留出余量，它适合发现异常阻塞，不能代替性能测试。`assertTimeoutPreemptively()` 会在另一个线程中执行，并在超时后尝试中断任务，可能丢失事务、认证等 `ThreadLocal` 上下文，涉及 Spring 事务时不要随意使用。
### Mockito 实战：不仅验证结果，还要验证副作用
创建 `src/test/java/demo/OrderServiceTest.java`：
    
    package demo;
    
    import static org.junit.jupiter.api.Assertions.assertAll;
    import static org.junit.jupiter.api.Assertions.assertEquals;
    import static org.junit.jupiter.api.Assertions.assertThrows;
    import static org.mockito.ArgumentMatchers.any;
    import static org.mockito.Mockito.doThrow;
    import static org.mockito.Mockito.inOrder;
    import static org.mockito.Mockito.never;
    import static org.mockito.Mockito.verify;
    import static org.mockito.Mockito.verifyNoInteractions;
    import static org.mockito.Mockito.when;
    
    import java.util.Optional;
    
    import org.junit.jupiter.api.BeforeEach;
    import org.junit.jupiter.api.Tag;
    import org.junit.jupiter.api.Test;
    import org.junit.jupiter.api.extension.ExtendWith;
    import org.mockito.ArgumentCaptor;
    import org.mockito.Captor;
    import org.mockito.InOrder;
    import org.mockito.Mock;
    import org.mockito.junit.jupiter.MockitoExtension;
    
    @Tag("unit")
    @ExtendWith(MockitoExtension.class)
    class OrderServiceTest {
        @Mock
        OrderRepository repository;
    
        @Mock
        InventoryService inventory;
    
        @Captor
        ArgumentCaptor&lt;Order&gt; orderCaptor;
    
        OrderService service;
    
        @BeforeEach
        void setUp() {
            service = new OrderService(repository, inventory);
        }
    
        @Test
        void cancelsPendingOrderAfterReleasingInventory() {
            Order pending = new Order(1001L, 2001L, 2, OrderStatus.PENDING);
            when(repository.findById(1001L)).thenReturn(Optional.of(pending));
    
            Order actual = service.cancel(1001L);
    
            assertAll(
                    () -> assertEquals(1001L, actual.id()),
                    () -> assertEquals(OrderStatus.CANCELLED, actual.status())
            );
    
            InOrder calls = inOrder(inventory, repository);
            calls.verify(inventory).release(2001L, 2);
            calls.verify(repository).save(orderCaptor.capture());
            Order saved = orderCaptor.getValue();
            assertAll(
                    () -> assertEquals(1001L, saved.id()),
                    () -> assertEquals(2001L, saved.productId()),
                    () -> assertEquals(2, saved.quantity()),
                    () -> assertEquals(OrderStatus.CANCELLED, saved.status())
            );
        }
    
        @Test
        void rejectsPaidOrderWithoutReleasingInventory() {
            Order paid = new Order(1002L, 2001L, 1, OrderStatus.PAID);
            when(repository.findById(1002L)).thenReturn(Optional.of(paid));
    
            IllegalStateException error = assertThrows(
                    IllegalStateException.class,
                    () -> service.cancel(1002L)
            );
    
            assertEquals("当前状态不允许取消", error.getMessage());
            verifyNoInteractions(inventory);
            verify(repository, never()).save(any());
        }
    
        @Test
        void doesNotSaveOrderWhenInventoryReleaseFails() {
            Order pending = new Order(1003L, 2002L, 3, OrderStatus.PENDING);
            when(repository.findById(1003L)).thenReturn(Optional.of(pending));
            doThrow(new IllegalStateException("库存服务不可用"))
                    .when(inventory).release(2002L, 3);
    
            IllegalStateException error = assertThrows(
                    IllegalStateException.class,
                    () -> service.cancel(1003L)
            );
    
            assertEquals("库存服务不可用", error.getMessage());
            verify(inventory).release(2002L, 3);
            verify(repository, never()).save(any());
        }
    
        @Test
        void restoresInventoryWhenSavingCancelledOrderFails() {
            Order pending = new Order(1004L, 2003L, 1, OrderStatus.PENDING);
            when(repository.findById(1004L)).thenReturn(Optional.of(pending));
            doThrow(new IllegalStateException("数据库不可用"))
                    .when(repository).save(any());
    
            IllegalStateException error = assertThrows(
                    IllegalStateException.class,
                    () -> service.cancel(1004L)
            );
    
            assertEquals("数据库不可用", error.getMessage());
            InOrder calls = inOrder(inventory, repository);
            calls.verify(inventory).release(2003L, 1);
            calls.verify(repository).save(any());
            calls.verify(inventory).reserve(2003L, 1);
        }
    
        @Test
        void rejectsMissingOrderWithoutReleasingInventory() {
            when(repository.findById(9999L)).thenReturn(Optional.empty());
    
            IllegalArgumentException error = assertThrows(
                    IllegalArgumentException.class,
                    () -> service.cancel(9999L)
            );
    
            assertEquals("订单不存在", error.getMessage());
            verifyNoInteractions(inventory);
            verify(repository, never()).save(any());
        }
    }
    
五条测试分别覆盖正常取消、状态拦截、库存异常、订单保存异常和订单不存在。这里有四个值得保留的做法：
  * 使用 `ArgumentCaptor` 检查真正写入仓储的订单状态
  * 使用 `never()` 和 `verifyNoInteractions()` 验证失败路径没有错误副作用
  * 保存失败后验证库存回补，避免只检查抛出的异常
  * 只有“先释放库存，后保存状态”属于业务规则，因此才使用 `InOrder`


不要对每个内部方法都执行 `verify()`。Mock 验证越贴近实现细节，代码重构时产生的无效失败越多。数据库、HTTP/RPC、消息队列、第三方支付等系统边界适合 Mock；测试仓储 SQL 时则应该连接可控数据库，不要 Mock 自己要验证的对象。
### 参数化测试：把规则和数据分开
订单状态不断增加时，为每个状态复制一条测试很难维护。创建 `src/test/java/demo/OrderStatusTest.java`：
    
    package demo;
    
    import static org.junit.jupiter.api.Assertions.assertEquals;
    
    import org.junit.jupiter.api.Tag;
    import org.junit.jupiter.params.ParameterizedTest;
    import org.junit.jupiter.params.provider.CsvSource;
    
    @Tag("unit")
    class OrderStatusTest {
        @ParameterizedTest(name = "[{index}] status={0}, expected={1}")
        @CsvSource({
                "PENDING, true",
                "PAID, false",
                "CANCELLED, false"
        })
        void onlyPendingStatusCanBeCancelled(OrderStatus status, boolean expected) {
            assertEquals(expected, status.canCancel());
        }
    }
    
参数化测试只保留一份执行逻辑，测试数据直接表达“输入状态与预期结果”。不要在测试中复制生产代码的判断逻辑，否则生产代码和测试可能一起写错。
常用数据源：

数据源| 适用场景  
---|---  
`@ValueSource`| 单个简单参数  
`@CsvSource`| 少量多字段规则表  
`@CsvFileSource`| 从 CSV 文件读取较多数据  
`@MethodSource`| 复杂对象、动态数据和边界组合  
`@NullSource`、`@EmptySource`| 空值和空字符串边界  

参数化测试适合规则表和边界组合，不适合把完全不同的业务场景塞进同一方法。失败后必须能从测试名称和参数中直接看出是哪组数据出错。
### 测试生命周期与独立性
JUnit 默认使用 `PER_METHOD` 生命周期：每条测试都会创建新的测试类实例，实例字段不会在测试间共享。这也是示例在 `@BeforeEach` 中重新创建 `OrderService` 的原因。
使用 `@TestInstance(TestInstance.Lifecycle.PER_CLASS)` 后，同一个实例会执行类内全部测试，`@BeforeAll` 和 `@AfterAll` 也可以写成非静态方法。但共享可变字段很容易造成顺序依赖，只有初始化成本很高且能可靠清理的资源才考虑使用。
排查测试间依赖时，可以把 Jupiter 的方法顺序改为随机，并连续执行多次：
    
    mvn '-Djunit.jupiter.testmethod.order.default=org.junit.jupiter.api.MethodOrderer$Random' test
    
引号用于防止 Shell 展开类名中的 `$`。随机执行只适合暴露顺序依赖，不能用自动重跑掩盖不稳定测试。时间、随机数和外部资源应通过可控依赖注入。
### 执行测试与生成报告
    
    # 执行全部测试
    mvn test
    
    # 只执行一个测试类
    mvn -Dtest=OrderServiceTest test
    
    # 只执行一个测试方法
    mvn -Dtest=OrderServiceTest#cancelsPendingOrderAfterReleasingInventory test
    
    # 只执行带 unit 标签的测试
    mvn -Dgroups=unit test
    
本文示例在 Java `17.0.19`、Maven `3.9.11` 环境中实际执行结果：
    
    Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
    
Maven Surefire 默认会发现名称匹配 `*Test`、`*Tests`、`*TestCase` 等模式的测试类，结果保存在 `target/surefire-reports`。CI 中可以直接归档该目录中的 XML 报告。
    
    mvn -B -Dgroups=unit verify
    
单元测试应在每次提交时执行；连接数据库、消息队列等资源的集成测试建议单独使用 Failsafe，并通过标签或目录与单元测试分开，避免本地和 CI 的执行范围不一致。
### 从 JUnit 4 迁移到 JUnit 6
JUnit 4 和 Jupiter 的注解包不同，不能只改版本号。常见替换关系如下：

JUnit 4| JUnit Jupiter  
---|---  
`org.junit.Test`| `org.junit.jupiter.api.Test`  
`@Before`、`@After`| `@BeforeEach`、`@AfterEach`  
`@BeforeClass`、`@AfterClass`| `@BeforeAll`、`@AfterAll`  
`@Ignore`| `@Disabled`  
`@Test(expected=...)`| `assertThrows()`  
`@RunWith(Parameterized.class)`| `@ParameterizedClass` \+ 参数源  
`@RunWith(MockitoJUnitRunner.class)`| `@ExtendWith(MockitoExtension.class)`  
`@Rule TemporaryFolder`| `@TempDir`  

JUnit 4 的 `Parameterized` Runner 是类级参数化，对应 JUnit 6 的 `@ParameterizedClass`；只有单个方法需要多组数据时才使用 `@ParameterizedTest`。JUnit 6.1.2 中 `@ParameterizedClass` 仍是实验性功能，升级时需要关注兼容性。
存量项目可以临时引入 Vintage Engine，让 JUnit 4 测试继续在 Platform 上运行，再按模块迁移。迁移时应重点检查 `org.junit.*` 旧导入、Runner 和 Rule，不能只替换注解名称。Vintage 已被标记为弃用，不适合作为长期方案；迁移完成后应删除 Vintage 和 JUnit 4 依赖，防止新测试继续使用旧 API。
### 常见问题

问题| 处理方式  
---|---  
JUnit 6 测试无法启动| 检查运行时是否为 Java 17+，并确认 IDE、Maven 和 CI 使用同一 JDK  
测试编译成功但没有执行| 检查 Surefire 版本、测试类命名和 `@Test` 的导入包  
`@BeforeAll` 不能访问实例字段| 默认生命周期下方法应为 `static`，或明确使用 `PER_CLASS`  
Mockito Mock 没有初始化| 添加 `@ExtendWith(MockitoExtension.class)`  
异常测试只写了 `assertThrows`| 继续检查异常信息，并验证失败路径没有写库、发消息等副作用  
参数化测试失败难定位| 使用 `name` 展示索引和关键参数，避免一条数据承载多个场景  
测试依赖执行顺序| 清理共享状态，并随机顺序重复执行定位问题  
失败测试长期使用 `@Disabled`| 记录原因和恢复条件，不能用禁用代替修复  

### 工程实践建议
  * 测试名写清“场景 + 期望结果”
  * 按 Arrange、Act、Assert 组织测试代码
  * 正常、边界、异常和错误副作用都要覆盖
  * 参数化数据直接写预期，不复制生产算法
  * 只在系统边界使用 Mock，避免验证无关实现细节
  * 每条测试独立运行，不依赖顺序和其他测试结果
  * 单元测试与集成测试分组执行，CI 保留 XML 报告
  * 覆盖率用于发现遗漏，不能替代有效断言和业务场景设计


### 总结
JUnit 6 的基础使用并不复杂：使用 Jupiter 编写断言，使用参数化测试覆盖规则表，使用 Mockito 隔离外部依赖，再通过 Maven Surefire 接入 CI。
不要为了覆盖率堆测试。能稳定复现问题、准确验证业务规则、失败后快速定位原因，才是一条真正有价值的单元测试。
