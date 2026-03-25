# [测试技术]Claude Code + Cursor使用指南

> 原文: https://blog.csdn.net/weixin_42390585/article/details/149332887

> *原创内容，未获授权禁止转载、转发、抄袭。

### CLI安装
官方安装教程[设置 Claude Code - Anthropic](https://docs.anthropic.com/zh-CN/docs/claude-code/setup "设置 Claude Code - Anthropic")
注意如果用了`nvm`等`Nodejs`版本管理工具需要的操作（全局单一版本忽略）
    
    nvm install 18 # 安装18+版本 也可以是20 22 
    
    nvm use 18 # 切换到18版本
    
    npm install -g @anthropic-ai/claude-code # 安装命令
    
    claude --version # 输出1.0.44 (Claude Code)表示安装成功
    
    nvm alias defalut 18 
    #建议操作，否则每次开启都要use到18版本上
    #而且cursor，IDEA等相关插件检测不到Claude命令，无法运行
    
    
### anyrouter配置
注册[anyrouter](https://anyrouter.top/register?aff=zndk "anyrouter")这里推荐将环境变量写进启动脚本。
操作如下：根据自己的终端工具选择`.bashrc`、`.zshrc`
以`zshrc`终端为例，编辑`.zshrc`配置环境变量
    
    sudo vim ~/.zshrc # 需要输入密码
    
    # edit ~/.zshrc 
    export ANTHROPIC_AUTH_TOKEN=sk-***
    export ANTHROPIC_BASE_URL=https://anyrouter.top
    
![](/cdn/149332887/48a1535db6714c51bd70823998d0c955.png)
然后重新编译脚本使环境变量生效
    
    source ~/.zshrc
重新启动终端后
    
    ehco $ANTHROPIC_AUTH_TOKEN #显示sk-***表示设置成功
    cd your-project-folder #进入功能目录
    claude #进入交互，失败的话看node版本是是否匹配
没有出现授权步骤，其他步骤成功后下图表示设置成功
![](/cdn/149332887/b9c5bcf748f24b90b33cb853c8cd78b8.png)
#### 常见失败原因
Q:请求出现401错误
A:原因最可能是你执行`claude`命令进入了官方登录，然后一直卡登录，可以在交互里面执行退出登录
这里执行`/logout`命令退出登录，重新执行`claude`命令![](/cdn/149332887/c3cdf0f725954cc5bf4f4a581e7aa3d5.png)
Q:请求出现403错误
A: 检查API_KEY的使用额度是否用完或者其他异常原因
#### Claude code插件安装
官网文档:[将 Claude Code 添加到您的 IDE](https://docs.anthropic.com/zh-CN/docs/claude-code/ide-integrations "将 Claude Code 添加到您的 IDE")
以[cursor](https://cursor.com/ "cursor")为例演示安装过程
  1. 确定编辑器命令是否注册到全局`PTAH`


    
    which cursor  # /usr/local/bin/cursor
如果未安装，使用 `Cmd+Shift+P`（Mac）或 `Ctrl+Shift+P`（Windows/Linux）并搜索”Shell Command: Install ‘code’ command in PATH”（或您的 IDE 的等效命令)
  1. 安装`Claude Code`插件，如图所示作者是Anthropic就对了![](/cdn/149332887/c047fd509f7747d391287cc5d7913421.png)


安装成功如图右上角图标，按`cmd+esc`快捷键打开，如果没有成功，则杀掉[cursor](https://cursor.com/ "cursor")进程，重启[cursor](https://cursor.com/ "cursor")
![](/cdn/149332887/2b2c6dbb0fcf48bea9648521e56778b5.png)
  1. `Claude Code`配置选项


进入`Claude code`输入`/ide`命令选择cursor作为`ide`连接
![](/cdn/149332887/6e70df340e7646cbaf5938fad132ea1c.png)![](/cdn/149332887/91f37a299e354d709f79fb6c5f31174d.png)
命令交互输入斜杠命名`/config`，要求
`Auto-connect to IDE`设置为`true`
`Diff tool `设置为`auto`![](/cdn/149332887/571d5daa04094201b28f5c7d333a74ac.png)![](/cdn/149332887/60606a849e7f45d581bcc5b8abbd1ef4.png)
`↑/↓`键选择，`Enter/Tab/Space`切换值类型
当在编辑器内选择一段文本后可以可以看到命令行有交互反馈
![](/cdn/149332887/1f0cce426a0c4e588f752982d1f720b8.png)
### 进阶使用
#### 使用`@`命令快捷引用文件或者直接拖拽文件到输入框
![](/cdn/149332887/96f897eb0df44a26b09447ce98806ba0.png)![](/cdn/149332887/4352dac7b668466283a13fd5fc29e5ca.png)
#### 使用图片
官方文档：[处理图像](https://docs.anthropic.com/zh-CN/docs/claude-code/common-workflows#%E5%A4%84%E7%90%86%E5%9B%BE%E5%83%8F "处理图像")
这里要注意截图快捷键不是`cmd + v`而是 `ctrl + v`
### 记忆与规则
规则文档：[管理 Claude 的内存 - Anthropic](https://docs.anthropic.com/zh-CN/docs/claude-code/memory "管理 Claude 的内存 - Anthropic")
主要区分全局规则与项目规则
![](/cdn/149332887/bc2ace1b32b24487b8d695dce078fcbe.png)
这里中文文档翻译成内存不准确，应该翻译为记忆；可以这样简单理解：
`~/.claude/CLAUDE.md`于[cursor](https://cursor.com/ "cursor")的`User Rule`可以直接编辑对应文件
    
    sudo cursor ~/.claude/CLAUDE.md
添加自己的全局规则
![](/cdn/149332887/748eb0cec43f43d2b9a2ee62f263d142.png)
![](/cdn/149332887/4458192712df494da52801f6d15eb40f.png)
`./CLAUDE.md`等价于[cursor](https://cursor.com/ "cursor")老版本的`.cursorrules`我们可以通过`/init`命令来初始化一个`CLAUDE.md`文件
![](/cdn/149332887/f05e7171380a4647880110217632746c.png)
### 模式与权限
#### 模式
Claude Code支持几种权限模式，可以在设置文件中设置为`defaultMode`：
`default` 默认行为 - 在首次使用每个工具时提示权限
`acceptEdits` 自动接受会话的文件编辑权限
`plan` 计划模式 - Claude可以分析但不能修改文件或执行命令（推荐改成默认模式）
`bypassPermissions` `YOYO`模式直接运行所有工具（docker 环境使用）
`Claude Code`默认的模式交互过于频繁，`plan`模式相对友好，我们可以将默认模式设置为`plan`操作如下：
打开`~/.claude/settings.json`文件
    
    sudo cursor ~/.claude/settings.json
设置`defaultMode`为`plan`
    
    {
      "permissions": {
       "defaultMode":"plan"
      }
    }
    
再次进入交互界面默认就是`plan`模式
![](/cdn/149332887/d2be760c47a84fd8b853551c43aa080a.png)
我们可以通过`shift+tab`在会话中切换权限模式；还可以通过命令行参数`permission-mode`指定模式
    
    claude --permission-mode bypassPermissions # 直接进入yoyo模式
#### 自定义`slash`命令
能基本运行，不过效果有待商榷
[斜杠命令 - Anthropic](https://docs.anthropic.com/zh-CN/docs/claude-code/slash-commands "斜杠命令 - Anthropic")
![](/cdn/149332887/d22cc9e0e54f454d88e0302310833047.png)
### 作为mcp服务在cursor使用
参考文档[将-claude-code-用作-mcp-服务器](https://docs.anthropic.com/zh-CN/docs/claude-code/mcp#%E5%B0%86-claude-code-%E7%94%A8%E4%BD%9C-mcp-%E6%9C%8D%E5%8A%A1%E5%99%A8 "将-claude-code-用作-mcp-服务器")，配置`mcp.json`
    
    {
      "mcpServers": {
       "claude": {
          "command": "claude",
          "args": ["mcp", "serve"],
          "env": {
            "ANTHROPIC_AUTH_TOKEN": "sk-****",
            "ANTHROPIC_BASE_URL": "https://anyrouter.top"
          }
        }
      }
    }
![](/cdn/149332887/53d9e515f33f41dea17511a68c61be7f.png)
提出问题后，反馈过程非常慢，而且文件权限问题导致交互多，使用体验不是很好
![](/cdn/149332887/618ade55640b40e0a2004cf7b9829f34.png)
### 
