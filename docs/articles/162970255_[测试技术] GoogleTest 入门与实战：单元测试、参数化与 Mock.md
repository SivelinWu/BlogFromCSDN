# [测试技术] GoogleTest 入门与实战：单元测试、参数化与 Mock

> 原文: https://blog.csdn.net/weixin_42390585/article/details/162970255

## [C++测试] GoogleTest 入门与实战：单元测试、参数化与 Mock
> 原创内容，未获授权禁止转载、转发、抄袭。

C++ 自带的 `assert` 可以做简单校验，但在定义 `NDEBUG` 后会被禁用，也缺少测试组织、批量执行、Mock 和报告能力。项目稍微复杂一点，只靠 `assert` 就很难维护。
GoogleTest 是 Google 开源的 C++ 测试框架，提供断言、Fixture、参数化测试、测试过滤和结果输出；配套的 gMock 用于模拟数据库、网络、消息队列等外部依赖。
本文通过“取消订单”场景，把 GoogleTest、参数化测试、gMock 和 CMake 集成串起来。
### GoogleTest 能做什么
GoogleTest 基于 xUnit 思想，支持 Linux、macOS 和 Windows，不只可以写单元测试，也可以用于组件测试和部分集成测试。

能力| 作用  
---|---  
`TEST`、`TEST_F`| 组织普通测试和 Fixture 测试  
`EXPECT_*`、`ASSERT_*`| 校验实际结果  
参数化测试| 用一组数据批量验证相同规则  
gMock| 模拟数据库、接口和消息队列等依赖  
测试过滤| 按名称执行指定测试  
XML 输出| 对接 Jenkins、GitLab CI 等平台  
CTest 集成| 统一发现、执行和统计测试  

截至 2026 年 7 月，GoogleTest 最新正式版为 `v1.17.0`，该版本要求至少使用 C++17。
### 使用 CMake 集成 GoogleTest
示例目录如下：
    
    gtest-demo/
    ├── CMakeLists.txt
    ├── include/
    │   └── order_service.h
    └── tests/
        └── order_service_test.cpp
    
`CMakeLists.txt`：
    
    cmake_minimum_required(VERSION 3.20)
    project(gtest_demo LANGUAGES CXX)
    
    set(CMAKE_CXX_STANDARD 17)
    set(CMAKE_CXX_STANDARD_REQUIRED ON)
    
    include(FetchContent)
    FetchContent_Declare(
        googletest
        URL https://github.com/google/googletest/releases/download/v1.17.0/googletest-1.17.0.tar.gz
        URL_HASH SHA256=65fab701d9829d38cb77c14acdc431d2108bfdbf8979e40eb8ae567edf10b27c
    )
    
    if(MSVC)
        set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
    endif()
    
    FetchContent_MakeAvailable(googletest)
    enable_testing()
    
    add_executable(order_service_test tests/order_service_test.cpp)
    target_include_directories(order_service_test PRIVATE include)
    target_link_libraries(
        order_service_test
        PRIVATE
        GTest::gtest_main
        GTest::gmock
    )
    
    include(GoogleTest)
    gtest_discover_tests(
        order_service_test
        XML_OUTPUT_DIR ${CMAKE_BINARY_DIR}/test-results
    )
    
`gtest_discover_tests()` 会从编译后的测试程序中发现测试，包括参数化测试，并注册到 CTest。
项目中建议固定 GoogleTest 的版本或提交记录。企业内网可以把源码包上传到内部制品库，避免 CI 构建依赖 GitHub 网络。
### 准备被测代码
示例业务规则：
  * 只有待支付订单可以取消
  * 取消订单需要释放库存
  * 库存释放成功后才能更新订单状态
  * 已支付订单不能取消，也不能释放库存


创建 `include/order_service.h`：
    
    #pragma once
    
    #include &lt;optional&gt;
    
    enum class OrderStatus {
        Pending,
        Paid,
        Cancelled
    };
    
    inline bool CanCancel(OrderStatus status) {
        return status == OrderStatus::Pending;
    }
    
    struct Order {
        int id;
        int product_id;
        int quantity;
        OrderStatus status;
    };
    
    class OrderRepository {
    public:
        virtual ~OrderRepository() = default;
        virtual std::optional&lt;Order&gt; FindById(int order_id) = 0;
        virtual void Save(const Order& order) = 0;
    };
    
    class InventoryService {
    public:
        virtual ~InventoryService() = default;
        virtual bool Release(int product_id, int quantity) = 0;
    };
    
    class OrderService {
    public:
        OrderService(OrderRepository& repository, InventoryService& inventory)
            : repository_(repository), inventory_(inventory) {}
    
        bool Cancel(int order_id) {
            auto order = repository_.FindById(order_id);
            if (!order || !CanCancel(order->status)) {
                return false;
            }
    
            if (!inventory_.Release(order->product_id, order->quantity)) {
                return false;
            }
    
            order->status = OrderStatus::Cancelled;
            repository_.Save(*order);
            return true;
        }
    
    private:
        OrderRepository& repository_;
        InventoryService& inventory_;
    };
    
这里通过接口注入订单仓储和库存服务，测试时可以使用 gMock 替换真实数据库和库存系统。
### 先分清 EXPECT 和 ASSERT
GoogleTest 的断言主要分为 `EXPECT_*` 和 `ASSERT_*`：
  * `EXPECT_*` 失败后继续执行当前测试，可以一次看到多个问题
  * `ASSERT_*` 失败后结束当前测试函数，适合校验前置条件


    
    ASSERT_TRUE(order.has_value());
    EXPECT_EQ(OrderStatus::Pending, order->status);
    EXPECT_EQ(2, order->quantity);
    
如果订单不存在，继续访问 `order->status` 已经没有意义，所以第一条使用 `ASSERT_TRUE`。

断言| 作用  
---|---  
`EXPECT_TRUE`、`EXPECT_FALSE`| 判断布尔条件  
`EXPECT_EQ`、`EXPECT_NE`| 判断相等或不相等  
`EXPECT_LT`、`EXPECT_LE`| 判断小于或小于等于  
`EXPECT_GT`、`EXPECT_GE`| 判断大于或大于等于  
`EXPECT_STREQ`| 比较 C 字符串内容  
`EXPECT_NEAR`| 比较带误差的浮点数  
`EXPECT_THROW`、`EXPECT_NO_THROW`| 验证是否抛出异常  

断言后可以使用 `<<` 补充失败上下文：
    
    EXPECT_EQ(2, order.quantity)
        << "order_id=" << order.id;
    
### Fixture 与 gMock 实战
创建 `tests/order_service_test.cpp`：
    
    #include "order_service.h"
    
    #include &lt;gmock/gmock.h&gt;
    #include <gtest/gtest.h>
    
    #include &lt;utility&gt;
    
    using ::testing::_;
    using ::testing::Return;
    
    class MockOrderRepository : public OrderRepository {
    public:
        MOCK_METHOD(std::optional&lt;Order&gt;, FindById, (int order_id), (override));
        MOCK_METHOD(void, Save, (const Order& order), (override));
    };
    
    class MockInventoryService : public InventoryService {
    public:
        MOCK_METHOD(bool, Release, (int product_id, int quantity), (override));
    };
    
    class OrderServiceTest : public ::testing::Test {
    protected:
        MockOrderRepository repository;
        MockInventoryService inventory;
        OrderService service{repository, inventory};
    };
    
    TEST_F(OrderServiceTest, CancelsPendingOrderAndReleasesInventory) {
        Order pending{1001, 2001, 2, OrderStatus::Pending};
    
        EXPECT_CALL(repository, FindById(1001))
            .WillOnce(Return(pending));
        EXPECT_CALL(inventory, Release(2001, 2))
            .WillOnce(Return(true));
        EXPECT_CALL(repository, Save(_))
            .WillOnce([](const Order& order) {
                EXPECT_EQ(1001, order.id);
                EXPECT_EQ(OrderStatus::Cancelled, order.status);
            });
    
        EXPECT_TRUE(service.Cancel(1001));
    }
    
    TEST_F(OrderServiceTest, RejectsPaidOrderWithoutReleasingInventory) {
        Order paid{1002, 2001, 1, OrderStatus::Paid};
    
        EXPECT_CALL(repository, FindById(1002))
            .WillOnce(Return(paid));
        EXPECT_CALL(inventory, Release(_, _)).Times(0);
        EXPECT_CALL(repository, Save(_)).Times(0);
    
        EXPECT_FALSE(service.Cancel(1002));
    }
    
    TEST_F(OrderServiceTest, KeepsOrderUnchangedWhenInventoryReleaseFails) {
        Order pending{1003, 2002, 3, OrderStatus::Pending};
    
        EXPECT_CALL(repository, FindById(1003))
            .WillOnce(Return(pending));
        EXPECT_CALL(inventory, Release(2002, 3))
            .WillOnce(Return(false));
        EXPECT_CALL(repository, Save(_)).Times(0);
    
        EXPECT_FALSE(service.Cancel(1003));
    }
    
这三条测试分别覆盖取消成功、已支付拦截和库存释放失败。`.Times(0)` 用来确认失败路径没有产生错误副作用。对支付、退款、库存等场景来说，“没有修改不该修改的数据”与“返回结果正确”同样重要。
Fixture 中的对象不会在多个测试之间共享。每个 `TEST_F` 都会创建新的 `OrderServiceTest` 对象，因此测试之间应保持独立。
### gMock 应该用在哪里
gMock 适合隔离不可控或执行成本高的依赖，例如数据库、HTTP/RPC 接口、消息队列、文件系统、系统时间和第三方支付服务。
`ON_CALL` 和 `EXPECT_CALL` 的用途不同：
  * `ON_CALL` 定义默认行为，不要求调用一定发生
  * `EXPECT_CALL` 验证调用参数、次数和返回结果


不要为了提高覆盖率把所有对象都 Mock 掉。过度验证内部调用顺序，会让测试绑定具体实现；重构代码时，即使业务行为没有变化，测试也会大量失败。只有调用顺序本身属于业务规则时，才需要使用 `InSequence`。
本例测试的是 `OrderService`，所以 Mock 订单仓储是合理的。如果测试目标变成 `OrderRepository` 的数据库读写，就应该连接可控的测试数据库验证真实 SQL，而不是继续 Mock 自己要测试的对象。
### 参数化测试：批量验证状态规则
订单存在多个状态，如果为每个状态单独写一个 `TEST`，会产生大量重复代码。参数化测试更适合验证这种规则表。
继续在测试文件中添加：
    
    using StatusCase = std::pair<OrderStatus, bool>;
    
    class CancellableStatusTest
        : public ::testing::TestWithParam<StatusCase> {};
    
    TEST_P(CancellableStatusTest, OnlyPendingOrderCanBeCancelled) {
        const auto [status, expected] = GetParam();
        EXPECT_EQ(expected, CanCancel(status));
    }
    
    INSTANTIATE_TEST_SUITE_P(
        OrderStatuses,
        CancellableStatusTest,
        ::testing::Values(
            StatusCase{OrderStatus::Pending, true},
            StatusCase{OrderStatus::Paid, false},
            StatusCase{OrderStatus::Cancelled, false}
        )
    );
    
参数化测试主要包含三部分：

API| 作用  
---|---  
`TestWithParam&lt;T&gt;`| 定义参数类型  
`TEST_P`| 编写公共测试逻辑  
`INSTANTIATE_TEST_SUITE_P`| 提供测试数据  

测试数据中直接保存期望结果，不要在测试体里重新实现一遍生产规则，否则测试可能和生产代码一起写错。
### 构建并执行
    
    cmake -S . -B build
    cmake --build build -j
    ctest --test-dir build --output-on-failure
    
本文示例实际执行结果：
    
    Running 6 tests from 2 test suites.
    [  PASSED  ] 6 tests.
    
也可以直接运行测试程序。不同平台和 CMake Generator 生成的可执行文件路径可能不同。
    
    # 查看所有测试
    ./build/order_service_test --gtest_list_tests
    
    # 只执行订单服务测试
    ./build/order_service_test --gtest_filter='OrderServiceTest.*'
    
    # 随机顺序重复执行，排查测试间依赖
    ./build/order_service_test --gtest_repeat=100 --gtest_shuffle
    
    # 输出 XML 报告
    ./build/order_service_test --gtest_output=xml:test-results.xml
    
CI 中建议保留失败日志：
    
    ctest --test-dir build --output-on-failure -j 4
    
### 常见问题

问题| 处理方式  
---|---  
新版本编译失败| `v1.17.0` 至少需要 C++17，同时检查编译器和 `CMAKE_CXX_STANDARD`  
C 字符串比较错误| `EXPECT_EQ` 可能比较指针地址，内容比较使用 `EXPECT_STREQ`  
Fixture 数据相互影响| 每个 `TEST_F` 使用新对象；共享资源才使用 `SetUpTestSuite()`，并在 `TearDownTestSuite()` 清理  
测试依赖执行顺序| 使用 `--gtest_repeat=100 --gtest_shuffle` 检查顺序依赖  
失败测试长期禁用| `DISABLED_` 只用于临时隔离，不能代替修复  
重构导致大量 Mock 失败| 测试绑定了实现细节，应验证公开行为并只在系统边界使用 Mock  

### 工程实践建议
  * 一个测试只验证一个明确行为
  * 测试名体现“场景 + 期望结果”
  * 按 Arrange、Act、Assert 组织测试代码
  * 优先使用 `EXPECT_*`，前置条件使用 `ASSERT_*`
  * 测试数据直接表达预期，不复制生产算法
  * 单元测试隔离真实数据库和外部接口，集成测试单独分组
  * 测试结果不依赖执行顺序、系统时间和随机环境
  * 核心业务规则优先使用参数化测试
  * CI 中执行全部测试并保留失败日志


GoogleTest 解决的是测试框架问题，不能自动解决测试设计问题。真正有价值的单元测试，仍然需要围绕业务规则、边界条件和异常路径设计。
### 总结
GoogleTest 的基础使用并不复杂：使用断言验证结果，使用 Fixture 管理公共对象，使用参数化测试减少重复代码，使用 gMock 隔离外部依赖，再通过 CMake 和 CTest 接入工程。
不要为了覆盖率堆测试。能稳定复现问题、准确验证业务规则、失败后快速定位原因，才是一条真正有价值的测试。
