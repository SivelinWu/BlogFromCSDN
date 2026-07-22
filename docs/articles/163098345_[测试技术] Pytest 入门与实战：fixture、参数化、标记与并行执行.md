# [测试技术] Pytest 入门与实战：fixture、参数化、标记与并行执行

> 原文: https://blog.csdn.net/weixin_42390585/article/details/163098345

> 原创内容，未获授权禁止转载、转发、抄袭。

Python 自动化测试从几个脚本增长到完整测试集后，通常会遇到数据重复准备、场景难以筛选、失败信息不直观和执行时间变长等问题。pytest 使用普通 `assert` 编写断言，并通过 fixture、参数化、标记和插件机制组织测试，适合单元测试、接口测试和回归测试。
本文使用一个小型完整的内存“取消订单”案例，演示 pytest 的核心用法，并实际验证全量、冒烟和并行三种执行方式。
### pytest 适合解决什么问题

能力| 典型用途  
---|---  
断言重写| 使用普通 `assert`，失败时展示表达式中的实际值  
fixture| 准备测试数据、注入依赖并清理资源  
参数化| 用多组输入覆盖同一业务规则  
mark| 区分冒烟、回归、慢测试等测试集合  
插件| 扩展并行、报告、覆盖率等能力  

目前，PyPI 上 pytest 最新稳定版为 `9.1.1`，发布于 2026 年 6 月 19 日，要求 Python `3.10+`。并行执行不是 pytest 内置能力，本文使用 pytest-xdist `3.8.0`；该插件要求 Python `3.9+`，因此本例最终以 pytest 的 `3.10+` 为准。
### 环境与项目结构
示例目录如下：
    
    pytest-demo/
    ├── order_service.py
    ├── pytest.ini
    ├── requirements-test.txt
    └── tests/
        ├── conftest.py
        ├── test_order_service.py
        └── test_order_status.py
    
创建 `requirements-test.txt`，固定两个直接测试依赖的版本：
    
    pytest==9.1.1
    pytest-xdist==3.8.0
    
macOS 和 Linux 创建并激活虚拟环境：
    
    python3 -m venv .venv
    source .venv/bin/activate
    python --version
    python -m pip install -r requirements-test.txt
    
Windows PowerShell 使用：
    
    py -m venv .venv
    .\.venv\Scripts\Activate.ps1
    python --version
    python -m pip install -r requirements-test.txt
    
安装前应确认输出为 Python `3.10+`。
本文统一从项目根目录使用 `python -m pytest`。与直接调用 `pytest` 命令相比，这种方式会把当前目录加入 `sys.path`，示例中的 `order_service.py` 才能被稳定导入。
创建 `pytest.ini`：
    
    [pytest]
    minversion = 9.1
    testpaths = tests
    addopts = -ra --strict-config --strict-markers
    markers =
        smoke: 核心链路冒烟测试
        regression: 完整回归测试
    
`testpaths` 限定测试目录，避免在大型仓库中误收集脚本；`--strict-config` 和 `--strict-markers` 会让未知配置项、未注册或拼错的自定义标记直接报错。默认测试文件使用 `test_*.py` 或 `*_test.py`，函数使用 `test_*`，测试类使用 `Test*` 且不能定义 `__init__`。
### 准备被测代码
本例包含以下规则：
  * 只有待支付订单可以取消
  * 商品数量必须大于 0
  * 取消成功后订单状态变为已取消，并释放对应库存
  * 已支付或不存在的订单取消失败，且不能释放库存
  * 已取消订单再次取消失败，且不能重复释放库存


创建 `order_service.py`：
    
    from dataclasses import dataclass, replace
    from enum import Enum
    
    
    class OrderNotFoundError(LookupError):
        pass
    
    
    class OrderStatus(Enum):
        PENDING = "pending"
        PAID = "paid"
        CANCELLED = "cancelled"
    
        def can_cancel(self) -> bool:
            return self is OrderStatus.PENDING
    
    
    @dataclass(frozen=True)
    class Order:
        order_id: int
        quantity: int
        status: OrderStatus
    
        def __post_init__(self) -> None:
            if self.quantity <= 0:
                raise ValueError("商品数量必须大于0")
    
    
    class OrderRepository:
        def __init__(self) -> None:
            self._orders: dict[int, Order] = {}
    
        def save(self, order: Order) -> None:
            self._orders[order.order_id] = order
    
        def find(self, order_id: int) -> Order | None:
            return self._orders.get(order_id)
    
    
    class OrderService:
        def __init__(self, repository: OrderRepository) -> None:
            self._repository = repository
            self._released_quantity = 0
    
        @property
        def released_quantity(self) -> int:
            return self._released_quantity
    
        def add(self, order: Order) -> None:
            self._repository.save(order)
    
        def cancel(self, order_id: int) -> Order:
            order = self._repository.find(order_id)
            if order is None:
                raise OrderNotFoundError("订单不存在")
            if not order.status.can_cancel():
                raise ValueError("当前状态不允许取消")
    
            cancelled = replace(order, status=OrderStatus.CANCELLED)
            self._repository.save(cancelled)
            self._released_quantity += order.quantity
            return cancelled
    
`OrderRepository` 是本例可观察的存储边界，测试可以验证取消失败后订单没有被错误修改。正式项目更适合使用 `src` 目录布局并安装项目包；真实取消流程如果同时修改数据库订单和外部库存，还需要事务或幂等补偿，不能用这个内存示例推导生产一致性。
### fixture：统一准备测试对象
创建 `tests/conftest.py`：
    
    import pytest
    
    from order_service import OrderRepository, OrderService
    
    
    @pytest.fixture
    def order_repository() -> OrderRepository:
        return OrderRepository()
    
    
    @pytest.fixture
    def order_service(order_repository: OrderRepository) -> OrderService:
        return OrderService(order_repository)
    
测试函数只要声明同名参数，pytest 就会自动注入 fixture，不需要导入 `conftest.py`。`order_service` 依赖 `order_repository`，同一条测试即使同时声明这两个参数，也会复用同一个仓库实例。fixture 默认作用域为 `function`，每条用例都会创建独立仓库，测试结束后对象直接丢弃，不需要额外清理。
数据库连接、临时服务等外部资源应使用 `yield`，并在其后执行关闭操作；测试函数失败时清理代码仍会执行，但 fixture 在到达 `yield` 前失败时不会执行后半段。`conftest.py` 中的 fixture 对其所在目录及子目录生效，重名 fixture 可能被下层目录覆盖。
可用作用域包括 `function`、`class`、`module`、`package` 和 `session`。扩大作用域能减少初始化次数，但也会增加状态污染风险，不应只为提速就共享可变对象。
### 断言正常与异常路径
创建 `tests/test_order_service.py`：
    
    import pytest
    
    from order_service import (
        Order,
        OrderNotFoundError,
        OrderRepository,
        OrderService,
        OrderStatus,
    )
    
    
    @pytest.mark.regression
    @pytest.mark.parametrize(
        "quantity",
        [
            pytest.param(0, id="zero"),
            pytest.param(-1, id="negative"),
        ],
    )
    def test_order_quantity_must_be_positive(quantity: int) -> None:
        with pytest.raises(ValueError, match="商品数量必须大于0"):
            Order(1000, quantity, OrderStatus.PENDING)
    
    
    @pytest.mark.smoke
    @pytest.mark.regression
    def test_cancel_pending_order_releases_inventory(
        order_service: OrderService,
        order_repository: OrderRepository,
    ) -> None:
        order_service.add(Order(1001, 2, OrderStatus.PENDING))
    
        actual = order_service.cancel(1001)
    
        assert actual.order_id == 1001
        assert actual.status is OrderStatus.CANCELLED
        stored = order_repository.find(1001)
        assert stored is not None
        assert stored.status is OrderStatus.CANCELLED
        assert order_service.released_quantity == 2
    
    
    @pytest.mark.regression
    def test_paid_order_does_not_release_inventory(
        order_service: OrderService,
        order_repository: OrderRepository,
    ) -> None:
        order_service.add(Order(1002, 1, OrderStatus.PAID))
    
        with pytest.raises(ValueError, match="当前状态不允许取消"):
            order_service.cancel(1002)
    
        stored = order_repository.find(1002)
        assert stored is not None
        assert stored.status is OrderStatus.PAID
        assert order_service.released_quantity == 0
    
    
    @pytest.mark.regression
    def test_repeated_cancel_does_not_release_inventory_twice(
        order_service: OrderService,
        order_repository: OrderRepository,
    ) -> None:
        order_service.add(Order(1003, 2, OrderStatus.PENDING))
        order_service.cancel(1003)
    
        with pytest.raises(ValueError, match="当前状态不允许取消"):
            order_service.cancel(1003)
    
        stored = order_repository.find(1003)
        assert stored is not None
        assert stored.status is OrderStatus.CANCELLED
        assert order_service.released_quantity == 2
    
    
    @pytest.mark.regression
    def test_missing_order_does_not_release_inventory(
        order_service: OrderService,
    ) -> None:
        with pytest.raises(OrderNotFoundError) as exc_info:
            order_service.cancel(9999)
    
        assert type(exc_info.value) is OrderNotFoundError
        assert order_service.released_quantity == 0
    
pytest 会重写测试模块中的 `assert`，失败时展示参与比较的值，不需要额外断言类。`pytest.raises()` 会接受目标异常的子类，要求类型完全一致时可像不存在订单的用例一样断言 `type(exc_info.value)`。`match` 按正则表达式匹配异常文本，只应在消息属于接口或产品契约时使用；如果消息中包含 `[]`、`()` 等正则字符，可使用 `re.escape()`。
正常用例同时检查返回对象、仓库状态和库存释放量，防止实现只返回新对象却漏掉持久化。异常用例则读取仓库确认状态未被修改，并检查 `released_quantity`，防止失败路径错误释放库存。
### 参数化：覆盖状态规则
创建 `tests/test_order_status.py`：
    
    import pytest
    
    from order_service import OrderStatus
    
    
    @pytest.mark.regression
    @pytest.mark.parametrize(
        ("status", "expected"),
        [
            pytest.param(OrderStatus.PENDING, True, id="pending"),
            pytest.param(OrderStatus.PAID, False, id="paid"),
            pytest.param(OrderStatus.CANCELLED, False, id="cancelled"),
        ],
    )
    def test_only_pending_status_can_be_cancelled(
        status: OrderStatus,
        expected: bool,
    ) -> None:
        assert status.can_cancel() is expected
    
每个参数组合都会成为独立测试，`id` 会出现在收集结果和失败报告中，比默认对象表示更容易定位。测试数据应直接给出期望值，不要在参数生成逻辑中复制生产代码的判断条件。
pytest 会把参数对象原样传给测试，不会自动复制列表、字典等可变对象。如果测试会修改参数，应在用例内复制或改用 fixture 创建，避免前一个参数用例影响后一个。
当参数只表示输入和期望值时使用 `@pytest.mark.parametrize`；当每组参数还需要创建并清理资源时，使用带 `params` 的参数化 fixture 更合适。
### 标记与测试筛选
本例注册了 `smoke` 和 `regression` 两个标记，可以按测试范围执行：
同一条测试可以拥有多个 mark。本例的正常取消既属于冒烟范围，也属于完整回归范围，因此同时标记为 `smoke` 和 `regression`。
    
    # 执行全部测试
    python -m pytest
    
    # 只执行冒烟测试
    python -m pytest -m smoke
    
    # 执行回归但排除冒烟测试
    python -m pytest -m "regression and not smoke"
    
    # 按名称表达式筛选
    python -m pytest -k "cancel and not missing"
    
`-m` 匹配 mark，`-k` 匹配测试节点名称、父级名称和关键字，两者可以组合使用，最终只执行同时满足两个表达式的测试。长期稳定的测试类型适合使用 mark，临时定位某个模块或函数时使用 `-k`。
### 使用 pytest-xdist 并行执行
安装 pytest-xdist 后，通过 `-n` 指定 worker 数：
    
    # 使用两个进程并行执行
    python -m pytest -n 2
    
    # 根据可用 CPU 自动选择进程数
    python -m pytest -n auto
    
    # 同一模块的测试分配给同一 worker
    python -m pytest -n 2 --dist loadscope
    
pytest-xdist 使用多个 worker 进程分发测试。每个进程拥有独立内存，但账号、数据库、文件和远程环境仍可能冲突，测试数据需要按 worker 或用例隔离。测试可注入 xdist 提供的 `worker_id` fixture，使用 `gw0`、`gw1` 等值生成不同的数据前缀。`session` 作用域 fixture 也是每个 worker 各执行一次；必须全局只执行一次的初始化，应放在测试运行前，或通过文件锁、数据库锁等跨进程机制保护。
`--dist loadscope` 会把同一模块的函数或同一测试类的方法交给同一 worker，有利于复用模块、类级 fixture，但负载可能不如默认调度均匀。无论使用哪种策略，都不应依赖收集顺序或完成顺序。
并行存在进程启动和调度开销，短小测试可能比串行更慢。先在 CI 中记录耗时和失败率，再决定 worker 数；依赖执行顺序或共享全局状态的测试，应先拆除依赖再开启并行。
### 执行与报告
本文示例在 Python `3.12.13`、pytest `9.1.1`、pytest-xdist `3.8.0` 环境中实际执行：

执行方式| 结果  
---|---  
`python -m pytest -q`| 9 条通过  
`python -m pytest -q -m smoke`| 1 条通过，8 条未选择  
`python -m pytest -q -n 2`| 9 条通过  

CI 中可生成 JUnit XML，由流水线归档：
    
    python -m pytest --durations=10 --junitxml=reports/pytest.xml
    
`--durations=10` 会列出最慢的 10 个 setup、call 或 teardown 阶段，适合判断慢点来自测试步骤还是 fixture。失败排查时可使用 `-x` 在首次失败后停止，或使用 `--maxfail=3` 限制失败数；修复后用 `--lf` 只执行上次失败的用例。不要在团队默认配置中长期启用 `--pdb`，否则无人值守的 CI 会停在交互调试状态。
`--lf` 依赖项目根目录下的 `.pytest_cache`。虚拟环境、`.pytest_cache`、`__pycache__` 和本地 `reports` 目录应加入 `.gitignore`，CI 报告则通过流水线制品归档。
### 常见问题

问题| 处理方式  
---|---  
没有收集到测试| 检查文件、函数命名和 `testpaths` 配置  
CI 提示 no tests ran| pytest 未收集到测试时退出码为 5，应修正收集规则，不要直接忽略失败  
fixture not found| 检查 fixture 名称及 `conftest.py` 所在目录  
Unknown mark| 在配置文件中注册 mark，并开启 `--strict-markers`  
参数化用例名称难懂| 使用 `pytest.param(..., id="...")` 设置业务化名称  
单独执行通过，并行失败| 排查共享账号、文件、数据库记录和端口冲突  
session fixture 初始化多次| xdist 下每个 worker 都有独立测试会话  
本地能导入，CI 导入失败| 固定从项目根目录执行，并使用虚拟环境或正式安装项目包  

### 工程实践建议
  * 一个 fixture 只负责一种资源的准备与清理，不在其中隐藏核心测试步骤
  * 每条测试独立创建数据，并能脱离其他用例单独执行
  * 参数化只承载同一规则的多组输入，不把不同业务流程塞进一张数据表
  * 对异常路径同时验证异常、状态和不应发生的副作用
  * 在配置中注册 mark、固定插件版本，并让本地与 CI 使用同一命令
  * 并行执行前先解决数据隔离，再根据 CI 实测结果调整 worker 数


### 总结
pytest 的核心是让测试依赖、数据和执行范围保持清晰：用 fixture 管理上下文，用参数化覆盖规则，用 mark 选择测试集，并在用例能够独立执行、数据已经隔离后再使用 xdist 并行。
