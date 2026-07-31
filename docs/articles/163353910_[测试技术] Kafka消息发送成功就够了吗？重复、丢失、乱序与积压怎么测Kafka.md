# [测试技术] Kafka消息发送成功就够了吗？重复、丢失、乱序与积压怎么测Kafka

> 原文: https://blog.csdn.net/weixin_42390585/article/details/163353910

> 原创内容，未获授权禁止转载、转发、抄袭。

测试 Kafka 消息时，只验证 Producer 返回成功、Consumer 收到消息，远远不够。一次真实的业务处理至少经过生产、Broker 持久化、消费、Offset 提交和业务落库，其中任何一步失败，都可能造成消息丢失、重复消费或业务状态不一致。
本文不讲 Kafka 安装和 API 用法，而是用订单事件说明测试应该看什么、怎样制造故障，以及最终断言什么。
### 先建立消息证据链
开始测试前，消息和日志至少要能关联以下信息：

字段| 作用  
---|---  
`eventId`| 唯一标识一次业务事件，重试时必须复用  
`orderId`| 业务主键，也可作为消息 Key  
`seq`| 同一业务对象内的事件序号，用于识别乱序  
Topic、Partition、Offset| 定位消息在 Kafka 中的位置  
Consumer Group| 确认由哪组消费者提交了进度  
traceId| 串联生产、消费、数据库和下游调用日志  

不要只按消息内容查问题。同一条业务消息可能被投递多次，但每次都会占用不同 Offset；同一 Offset 被同一 Consumer Group 再次读取，则通常与 Offset 未提交或回退有关。同一 Group 内的 Consumer 分担 Partition，不同 Group 则各自消费一份，因此测试任务应使用独立 Group，避免污染已有消费进度。
下面使用 3 个 Partition 的 `order-events` Topic。测试消息均为脱敏数据：
    
    kafka-topics.sh --bootstrap-server 127.0.0.1:19092 \
      --create --topic order-events --partitions 3 --replication-factor 1
    
    kafka-console-producer.sh \
      --bootstrap-server 127.0.0.1:19092 \
      --topic order-events \
      --reader-property parse.key=true \
      --reader-property key.separator=:
    
输入 4 条消息，其中 `EVT-002` 故意发送两次：
    
    ORDER-1001:{"eventId":"EVT-001","orderId":"ORDER-1001","status":"PAID","seq":1}
    ORDER-1001:{"eventId":"EVT-002","orderId":"ORDER-1001","status":"SHIPPED","seq":2}
    ORDER-1001:{"eventId":"EVT-002","orderId":"ORDER-1001","status":"SHIPPED","seq":2}
    ORDER-2001:{"eventId":"EVT-003","orderId":"ORDER-2001","status":"PAID","seq":1}
    
读取时打印 Key、Partition 和 Offset：
    
    kafka-console-consumer.sh \
      --bootstrap-server 127.0.0.1:19092 \
      --topic order-events \
      --from-beginning --max-messages 4 \
      --formatter-property print.key=true \
      --formatter-property print.partition=true \
      --formatter-property print.offset=true
    
本次于 2026 年 7 月 30 日在 Kafka 4.3.1、Java 17 的单节点 KRaft 环境中验证，实际输出如下：
    
    Partition:2  Offset:0  ORDER-1001  {"eventId":"EVT-001",...,"seq":1}
    Partition:2  Offset:1  ORDER-1001  {"eventId":"EVT-002",...,"seq":2}
    Partition:2  Offset:2  ORDER-1001  {"eventId":"EVT-002",...,"seq":2}
    Partition:1  Offset:0  ORDER-2001  {"eventId":"EVT-003",...,"seq":1}
    Processed a total of 4 messages
    
这个结果先说明两件事：相同 Key 进入同一 Partition；Kafka 会如实保存重复发送的 `EVT-002`，不会替业务去重。
### 必测场景一：业务成功，Offset 没提交
Kafka Consumer 常见的重复消费路径是：
  1. Consumer 拉取消息。
  2. 库存扣减或订单落库成功。
  3. 进程在提交 Offset 前退出。
  4. 同一 Consumer Group 重启后再次读取该消息。


关键配置和处理逻辑如下，完整示例使用 `max.poll.records=1`，避免一次 Poll 返回多条消息影响实验观察：
    
    props.put(ConsumerConfig.GROUP_ID_CONFIG, "order-payment-test");
    props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");
    props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
    props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, "1");
    
    ConsumerRecords&lt;String, String&gt; records =
            consumer.poll(Duration.ofMillis(500));
    
    for (ConsumerRecord&lt;String, String&gt; record : records) {
        processOrder(record.value());
    
        if (commit) {
            consumer.commitSync();
        }
    }
    
第一次处理成功后不提交 Offset，第二次以同一 Group 启动并提交，得到：
    
    mode=no-commit partition=1 offset=0 key=ORDER-2001
    business done, offset not committed
    
    mode=commit partition=1 offset=0 key=ORDER-2001
    offset committed
    
相同的 `partition=1, offset=0` 被读取两次，这正是至少一次投递下必须面对的重复处理。再次启动后读取到 `partition=2, offset=0`，说明上一条提交已经生效。
提交的消费位置表示“下一条待消费记录”，不是最后处理记录本身。反过来，如果先提交 Offset、后执行业务，进程在两者之间退出，重启后会跳过这条消息，形成业务层丢失。`enable.auto.commit=true` 也无法让业务处理与 Offset 提交原子化，因此需要分别注入“提交前宕机”和“提交后、处理前宕机”。
这里的断言不能停在“消息被重新消费”，还要检查第一次已经产生的业务副作用：
  * 订单状态不能重复推进；
  * 库存不能扣减两次；
  * 优惠券、积分不能重复发放；
  * 下游 HTTP 请求或二次消息不能重复发送；
  * 幂等记录中同一 `eventId` 只能有一条成功记录。


一种常见做法是在业务事务内登记事件，利用唯一约束阻止重复执行：
    
    CREATE TABLE consumed_event (
        consumer_name VARCHAR(64) NOT NULL,
        event_id      VARCHAR(64) NOT NULL,
        consumed_at   TIMESTAMP   NOT NULL,
        PRIMARY KEY (consumer_name, event_id)
    );
    
测试时同时查询 `consumed_event`、业务表和下游调用记录。只看到唯一键冲突日志，却没有检查业务是否已在冲突前执行，仍不能证明幂等有效。
### 必测场景二：顺序不能按发送时间判断
Kafka 只保证同一 Partition 内的记录有序，不保证跨 Partition 的全局顺序。若业务要求同一订单的 `PAID` 必须先于 `SHIPPED`，应使用 `orderId` 作为 Key，并检查两条消息是否进入同一 Partition、Offset 是否递增。前提是 Producer 没有显式指定其他 Partition，且 Key 的序列化和分区策略保持稳定。
测试至少覆盖：
  * 相同 Key 连续发送 `seq=1、2、3`，消费顺序必须一致；
  * 不同 Key 分布到多个 Partition，不断言全局先后；
  * 先发送 `seq=2`、后发送 `seq=1`，验证业务是否拒绝、暂存或告警；
  * Consumer 并发处理时，验证线程模型是否破坏同一 Key 的业务顺序；
  * 重试或死信回流后，旧事件不能覆盖新状态。


建议在业务表保存最后处理的 `seq` 或版本号，并使用条件更新：
    
    UPDATE order_state
    SET status = :status, last_seq = :seq
    WHERE order_id = :orderId
      AND last_seq < :seq;
    
受影响行数为 0 时，需要区分重复事件和乱序事件，不能直接当作消费成功后静默丢弃。
### 必测场景三：发送成功也有边界
Producer 的成功回调只说明消息满足当前确认条件。可靠性测试应核对以下配置组合，而不是单看 `send()` 没抛异常：
    
    acks=all
    enable.idempotence=true
    
`acks=all` 中的 “all” 指当前 ISR 中的副本，而不是所有分配副本。生产环境还应结合 Broker 的 `min.insync.replicas`，在 ISR 数量不足时验证生产请求失败、重试和告警是否符合预期。
`send()` 本身是异步调用。测试应等待 Future 或记录 Callback 结果，并保存返回的 Topic、Partition、Offset；对超时等结果不确定的异常，还要按 `eventId` 对账，不能立即生成新事件再次发送。
建议在至少 3 个 Broker、`replication-factor>=3` 的测试集群执行以下故障注入：

操作| 重点观察  
---|---  
发送过程中停止 Leader| Producer 是否重试，最终是否返回明确结果  
缩减 ISR 至低于 `min.insync.replicas`| 请求是否失败，业务是否误报成功  
Producer 收到超时| 重试后是否形成业务重复  
Broker 恢复并重新选主| 已确认消息是否仍可消费  

幂等 Producer 能减少 Producer 重试造成的重复写入，但不能解决业务主动重复发送，也不能替代 Consumer 端幂等。单节点、`replication-factor=1` 的环境只能验证功能，不能证明副本故障下不丢消息。
### 必测场景四：积压恢复和 Rebalance
积压测试不能只看 Lag 最终是否归零。大量消息恢复消费时，下游数据库、缓存和接口可能先被压垮，随后触发超时、重试和更严重的积压。
可以暂停 Consumer 或限制处理速度，持续生产消息，再恢复消费。观察以下指标：
  * Consumer Group Lag、Lag 增长速度和恢复耗时；
  * 单条消息端到端延迟，而不只是消费速率；
  * 消费失败率、重试次数和死信数量；
  * 数据库连接池、锁等待、接口错误率和限流次数；
  * 重复业务副作用与最终业务完成数。


还要让单条处理时间超过 `max.poll.interval.ms`，验证 Consumer 被移出 Group 后是否发生 Rebalance。旧 Consumer 的 Offset 提交可能失败，但已经开始的数据库更新或下游调用不一定停止，因此仍要检查重复副作用。需要长时间处理时，应调整 Poll 与处理模型，而不是简单增大超时时间掩盖问题。
### 事务消息要限定测试边界
启用 Kafka 事务后，应分别用 `read_uncommitted` 和 `read_committed` Consumer 验证提交与回滚记录的可见性。Kafka 内部的“消费一条消息、生产结果消息、提交消费位置”可以放进同一事务；下游使用 `read_committed` 时，可以读取非事务消息和已提交的事务消息，不会返回未提交或已中止的事务记录。但这不代表数据库更新、HTTP 调用也自动获得 Exactly-once。
若流程同时包含 Kafka 和外部数据库，应明确采用事务 Outbox、幂等消费或补偿机制，并测试“数据库成功、发消息失败”和“消息成功、数据库失败”两种部分成功。不要把 Kafka 事务能力扩大解释为整条业务链只执行一次。
### 一套最小回归集

场景| 故障或输入| 核心断言  
---|---|---  
正常投递| 单条合法消息| 消息位置、业务状态和 Offset 均正确  
重复发送| 相同 `eventId` 发送两次| 只产生一次业务副作用  
提交前宕机| 业务成功后终止 Consumer| 重启后重放，业务仍只执行一次  
处理前提交| 提交 Offset 后、业务处理前终止| 能发现并阻止业务层消息丢失  
同 Key 顺序| 连续发送递增 `seq`| 同 Partition 且按序生效  
乱序输入| 先发高 `seq` 再发低 `seq`| 旧状态不能覆盖新状态  
Broker 故障| 停 Leader、缩减 ISR| 结果明确，不误报成功  
消费积压| 暂停后恢复 Consumer| Lag 可恢复，下游不被打垮  
慢消费| 处理时间超过 Poll 间隔| Rebalance 后无重复副作用  
事务回滚| Abort 事务| `read_committed` 不可见  
非法消息| 缺字段、错误类型、超大消息| 有明确重试、死信或告警路径  

### 总结
Kafka 消息测试的重点不是“消息有没有到”，而是消息经过生产、持久化、消费、Offset 提交和业务落库后，最终状态是否正确。测试时要保留 Key、Partition、Offset、Consumer Group、`eventId` 和业务副作用这条证据链，再通过宕机、重复、乱序、积压和 Rebalance 主动制造失败。
消息可以重复，但业务结果不能重复；消息可以延迟，但不能悄悄丢失；跨 Partition 可以无序，但业务状态不能倒退。做到这三点，Kafka 测试才真正落到了业务质量上。
