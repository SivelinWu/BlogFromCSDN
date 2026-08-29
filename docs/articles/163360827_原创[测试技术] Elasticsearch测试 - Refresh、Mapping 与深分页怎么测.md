# 原创[测试技术] Elasticsearch测试 - Refresh、Mapping 与深分页怎么测

> 原文: https://blog.csdn.net/weixin_42390585/article/details/163360827

> 原创内容，未获授权禁止转载、转发、抄袭。

接口返回 `201 Created`，商品详情按 ID 也能查到，但搜索列表没有数据；批量同步返回 HTTP 200，第二天却发现少了几百条商品。这类问题通常不是“Elasticsearch 挂了”，而是测试只检查了请求状态，没有检查搜索可见性、单条执行结果和业务数据一致性。
本文用商品搜索场景说明 Elasticsearch 应该怎么测。示例中单节点只验证 API 行为，副本切换和节点故障需要在多节点测试集群完成。为便于阅读，示例省略认证信息，生产环境不能关闭 TLS 和访问控制。
### 先建立一条可追踪的数据链
测试前，数据库记录、同步任务、Elasticsearch 文档和搜索接口之间至少要能关联以下信息：

信息| 用途  
---|---  
业务主键，如 `SKU-1001`| 判断少数据、重复数据和错数据  
`biz_version` 或更新时间| 判断 Elasticsearch 是否被旧数据覆盖  
目标 Index、Alias| 确认读写是否落到同一版本  
`_seq_no`、`_primary_term`| 判断 Elasticsearch 内部是否发生并发更新  
同步批次、traceId| 串联数据库、消息、Bulk 请求和失败重试  

只比较数据库和 Elasticsearch 的总数不够。总数相同也可能同时存在一条漏同步和一条脏数据，至少还要比对主键集合、业务版本和关键字段。
下面先创建测试索引。单节点功能验证将副本数设为 0，多节点故障测试需要重新配置副本：
    
    PUT products-v1
    
    {
      "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0
      },
      "mappings": {
        "dynamic": "strict",
        "properties": {
          "product_name": {
            "type": "text",
            "fields": {
              "keyword": {"type": "keyword"}
            }
          },
          "price": {"type": "double"},
          "stock": {"type": "integer"},
          "updated_at": {"type": "date"},
          "biz_version": {"type": "long"}
        }
      }
    }
    
### Bulk 返回 200，不代表每条都成功
生产系统通常使用 Bulk API 同步数据。下面的索引使用严格 Mapping，第一条商品合法，第二条多了未定义字段：
    
    POST products-v1/_bulk
    Content-Type: application/x-ndjson
    
    {"index":{"_id":"SKU-1002"}}
    {"product_name":"Wireless Mouse","price":199.0,"stock":50,"biz_version":1}
    {"index":{"_id":"SKU-1003"}}
    {"product_name":"USB Hub","price":99.0,"stock":30,"unexpected_field":"bad","biz_version":1}
    
实际响应的 HTTP 状态是 200，但结果并非全部成功：
    
    {
      "errors": true,
      "items": [
        {"index": {"_id": "SKU-1002", "status": 201}},
        {
          "index": {
            "_id": "SKU-1003",
            "status": 400,
            "error": {"type": "strict_dynamic_mapping_exception"}
          }
        }
      ]
    }
    
因此，Bulk 测试必须断言：
  * HTTP 请求成功后继续检查顶层 `errors`；
  * 遍历每个 `items`，记录失败文档的 ID、状态码和原因；
  * 429 可按退避策略重试；超时或部分 5xx 的执行结果可能不确定，应先按业务主键和版本对账；
  * Mapping 错误等 400 问题应修正数据后再处理；
  * 不能把已成功项整批重放，避免重复覆盖和额外版本递增；
  * 重试耗尽后进入明确的失败队列或人工补偿，而不是只打印日志；
  * 补偿完成后按业务主键和版本重新对账。


Bulk 使用 NDJSON，每个 Action 和文档必须各占一行，最后一行也要以换行结束。使用文件配合 `curl` 时应使用 `--data-binary`，否则换行可能被破坏。
### GET 能查到，Search 仍可能查不到
Elasticsearch 是近实时搜索。文档写入成功后，实时 GET 可以立即读取，而 `_search` 通常要等 Refresh 后才能看到。为了稳定复现，先暂时关闭周期 Refresh：
    
    PUT products-v1/_settings
    
    {
      "index": {
        "refresh_interval": "-1"
      }
    }
    
然后写入一条商品：
    
    PUT products-v1/_doc/SKU-1001
    
    {
      "product_name": "Mechanical Keyboard",
      "price": 399.0,
      "stock": 20,
      "biz_version": 1
    }
    
写入返回 `_seq_no=0` 后，实际查询结果如下：
    
    GET products-v1/_doc/SKU-1001      -> found=true
    POST products-v1/_search           -> hits.total.value=0
    POST products-v1/_refresh          -> successful=1
    POST products-v1/_search           -> hits.total.value=1
    
自动化测试需要“写完立即搜索”时，可在写入请求中使用 `refresh=wait_for`，等待下一次 Refresh 后再断言。若 `refresh_interval=-1`，还需要其他请求显式触发 Refresh，否则不能依赖周期刷新完成等待。不要在性能测试或每条生产写入中固定使用 `refresh=true`，强制 Refresh 会改变系统负载；显式 Refresh 本身也是资源密集操作。
实验结束后应恢复周期 Refresh：
    
    PUT products-v1/_settings
    
    {
      "index": {
        "refresh_interval": "1s"
      }
    }
    
还要区分 Refresh 和数据持久性：Refresh 解决的是“能否被搜索”，不是数据库到 Elasticsearch 的同步事务，也不等同于 Flush。搜索可见后，仍需验证源数据、同步状态和失败补偿。
### Mapping 正确，查询方式也可能错
已知业务字段应优先使用显式 Mapping。前面的索引把商品名同时映射为全文检索字段 `product_name` 和精确匹配字段 `product_name.keyword`。
针对 `"Mechanical Keyboard"`，本次实测结果是：
    
    term  查询 product_name          -> 0 条
    match 查询 product_name          -> 1 条
    term  查询 product_name.keyword  -> 1 条
    
`text` 字段会经过分词，适合 `match`；精确筛选、聚合和排序通常使用 `keyword`。测试不能只准备一种英文短词，还应覆盖中文、大小写、特殊字符、超长文本、空值、数组、非法日期和数值边界。
金额字段还要验证小数精度。示例为方便演示使用 `double`，真实金额通常应根据业务选择整数最小货币单位或设置缩放因子的 `scaled_float`，不能只验证显示值。
`dynamic: strict` 可以让未知字段直接失败，便于尽早发现上游字段漂移。若允许动态 Mapping，则要检查错误类型推断和字段数量持续增长，避免 Mapping Explosion。多数已存在字段不能直接改变类型，升级时通常需要新建索引、Reindex，再切换 Alias。
### 并发更新要防止旧数据覆盖
两个同步任务同时读取商品库存，一个先更新成功，另一个稍后写回旧值。如果只使用普通 Index API，后到的旧数据可能覆盖新状态。
读取文档时记录 `_seq_no` 和 `_primary_term`，更新时带回这两个值：
    
    PUT products-v1/_doc/SKU-1001?if_seq_no=0&if_primary_term=1
    
    {
      "product_name": "Mechanical Keyboard",
      "price": 399.0,
      "stock": 19,
      "biz_version": 2
    }
    
第一次更新返回 200，仍使用旧版本再次更新时，实测返回：
    
    HTTP 409
    version_conflict_engine_exception
    required seqNo [0], primary term [1]
    current document has seqNo [2], primary term [1]
    
测试时不能把 409 简单改成无限重试。应重新读取最新数据并按业务规则合并，因为 `_seq_no` 只能识别 Elasticsearch 内部文档是否变化，不能证明数据库同步事件的业务先后。
`biz_version` 还应有明确的处理规则：
  * 小于当前版本：拒绝写入，防止旧事件覆盖新数据；
  * 等于当前版本且内容一致：按幂等请求处理；
  * 等于当前版本但内容不同：拒绝并告警；
  * 大于当前版本：允许更新。


数据一致性回归至少要覆盖：
  * 数据库新增，但 Elasticsearch 缺失；
  * 数据库已更新，但 Elasticsearch 仍是旧 `biz_version`；
  * 数据库已删除或下架，但搜索仍返回；
  * 全量同步与增量同步交叉执行，旧快照覆盖新事件；
  * 重试后同一业务主键出现重复文档；
  * 字段值一致，但搜索接口因过滤条件或 Alias 指向错误而不可见。


### 深分页不能只把页码改大
默认情况下，`from + size` 不能超过 10000。本次发送 `from=10000、size=1`，实际返回 HTTP 400：
    
    Result window is too large,
    from + size must be less than or equal to: [10000]
    but was [10001]
    
不要为了绕过报错直接调大 `index.max_result_window`。深分页应使用 `search_after`；翻页期间索引仍在 Refresh 时，再配合 Point in Time（PIT）固定搜索视图。
    
    POST /products-v1/_pit?keep_alive=1m
    
    POST /_search
    {
      "size": 100,
      "pit": {
        "id": "&lt;pit_id&gt;",
        "keep_alive": "1m"
      },
      "sort": [
        {"biz_version": "asc"}
      ],
      "search_after": [1, 0]
    }
    
下一页必须使用上一页最后一条记录返回的完整 `sort` 数组，并保持 Query 和 Sort 不变。PIT 会自动增加 `_shard_doc` 作为唯一的 Tie-breaker；不使用 PIT 时，应显式增加每条文档唯一的排序字段，否则同值数据可能重复或遗漏。
本次使用 `size=1` 实测，第一页返回 `SKU-1002、sort=[1,0]`，把该数组传给 `search_after` 后，第二页返回 `SKU-1001、sort=[2,1]`，两页没有重复。
分页测试应在翻页过程中持续新增、更新和删除文档，检查以下结果：
  * 同一个 PIT 内是否重复或漏掉记录；
  * PIT 过期后是否返回明确错误并重新开始；
  * 排序字段相同时顺序是否稳定；
  * 业务要求精确总数时，是否正确处理 `hits.total.relation`，必要时启用 `track_total_hits`。


当前官方文档已不建议使用 Scroll 处理深分页搜索，推荐 `search_after + PIT`。Scroll 更适合历史上的批量遍历场景，不应直接用于面向用户的实时翻页。
### Reindex 后，重点检查 Alias 切换
字段类型无法直接修改时，通常会创建 `products-v2`，把 `products-v1` 数据 Reindex 过去，再切换业务 Alias。只检查 Reindex 任务 `failures=[]` 仍不够，还要核对新旧索引的主键、版本、关键字段和增量追平结果。
Alias 的删除和新增应放在同一个请求中：
    
    POST /_aliases
    
    {
      "actions": [
        {
          "remove": {
            "index": "products-v1",
            "alias": "products-read",
            "must_exist": true
          }
        },
        {"add": {"index": "products-v2", "alias": "products-read"}}
      ]
    }
    
基础切换实测返回 `acknowledged=true、errors=false`，随后 `_alias/products-read` 只指向 `products-v2`；上例进一步增加了官方支持的 `must_exist` 保护。测试还应覆盖删除的 Alias 不存在和某个 Action 失败：当校验失败时，整个请求应失败，Alias 仍指向旧索引。若业务通过 Alias 写入，还要保证它只对应一个明确的 `is_write_index=true`。
### 黄灯能搜索，不代表集群安全
单节点索引配置一个副本后，本次实测得到：
    
    {
      "status": "yellow",
      "active_primary_shards": 1,
      "unassigned_shards": 1,
      "unassigned_primary_shards": 0
    }
    
Yellow 表示主分片已分配、部分副本未分配，搜索和写入可能仍可执行，但冗余能力已经下降；Red 表示存在未分配的主分片，部分搜索或写入可能失败。测试不能把“接口还能用”当作集群健康。
多节点故障测试至少需要两个数据节点，并先确认索引为 Green、主分片与副本位于不同节点。基线满足后，再停止数据节点、制造磁盘水位或关闭分片分配，观察：
  * 主分片能否由副本接管，故障期间读写结果是否明确；
  * Search 响应中的 `_shards.failed` 是否为 0；
  * 不允许部分结果的业务接口，是否设置并验证 `allow_partial_search_results=false`；
  * 节点恢复后 Unassigned Shard 是否下降并最终回到 Green；
  * Recovery 期间查询延迟、写入拒绝和 JVM 压力是否超出阈值；
  * Alias、同步任务和业务对账在故障恢复后是否仍然正确。


### 一套可落地的回归清单

场景| 注入方式| 核心断言  
---|---|---  
近实时搜索| 写入后立即 GET 和 Search| 区分写入成功与搜索可见  
Bulk 局部失败| 混入非法字段和错误类型| 检查 `errors` 与每个 Item  
并发覆盖| 使用同一版本并发更新| 旧更新返回 409，新数据不回退  
查询语义| 对 `text` 执行 `term` 和 `match`| 结果符合 Analyzer 与 Mapping  
数据漂移| 增删字段、改变字段类型| 严格拒绝或按约定兼容  
深分页| 超过 10000 并在翻页时写入| 使用 PIT 后无重复、无遗漏  
Reindex| 全量迁移期间持续增量写入| 新索引数据追平后再切 Alias  
Alias 异常| 删除不存在的 Alias| 切换不出现错误或部分指向  
副本丢失| 停止一个数据节点| 状态变化、主分片接管符合预期  
数据对账| 制造缺失、过期和多余文档| 主键、版本和关键字段差异可定位  

### 总结
Elasticsearch 测试不能停在 HTTP 状态码和命中数量。写入成功后要检查 Refresh 可见性，Bulk 要逐条判断结果，查询要结合 Mapping 和 Analyzer，并发同步要防止旧数据覆盖，深分页要验证稳定排序和 PIT，重建索引还要检查增量追平与 Alias 指向。
最终判断标准仍然是业务数据：该搜到的能搜到，不该出现的不会出现，故障恢复后数据不缺、不旧、不重复。把数据库主键、业务版本、Index、Alias 和分片状态串成证据链，问题才能被稳定复现和定位。
