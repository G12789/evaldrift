# promptdrift

> 给 LLM prompt / agent 做**快照式回归测试**——改一句提示词，第一时间知道有没有把别的用例悄悄改坏了。
>
> **国产模型 & 中文优先**：DeepSeek / Kimi / 通义 / 豆包 / 智谱 / 本地 Ollama 开箱即用。

调 prompt 最大的坑是：你为了修好 A 场景改了提示词，结果悄悄把 B、C 场景弄坏了，而你根本没发现，直到用户来投诉。`promptdrift` 把这件事变成像跑单元测试一样简单——锁一个**基线**，之后每次改提示词跑一下，它直接告诉你**哪些用例退化了**。

```
✓ 退款问题  ██████████ 100%  120ms
✗ 营业时间  ░░░░░░░░░░   0%   98ms
    ✗ [contains] 缺少关键词: 09:00
✓ 情绪安抚  █████████░  85%  340ms
────────────────────────────────────────
对比基线：
  ↓ 退化 营业时间  100% → 0% (-100%) [通过→失败]

1 处退化 · 0 处改进
```

## 为什么用它（而不是 promptfoo / deepeval）

那些工具很好，但都是英文世界的，**对国产模型和中文评测支持很弱**。`promptdrift` 专门补这个空档：

- **国产模型一等公民**：一个 `baseUrl` 切到 DeepSeek / Kimi / 通义 / 豆包 / 智谱，不用折腾 SDK。
- **中文评测**：内置的 `llm-judge` 裁判提示、报告、报错全是中文。
- **聚焦"防退化"这一件事**：基线对比 + `通过→失败` 高亮 + CI 退出码，像 jest snapshot 一样直觉。
- **零服务器、纯本地**：数据不出本机，`npx` 就能跑，能直接塞进 CI。
- **离线可跑**：内置 mock 模型，没 API Key 也能先把用例和断言调通。

## 快速开始

```bash
# 1. 生成配置（默认离线 mock，立即可跑）
npx promptdrift init

# 2. 跑测试
npx promptdrift run

# 3. 满意了就锁定基线
npx promptdrift baseline

# 4. 以后每次改完 prompt 再跑，自动对比基线、标出退化
npx promptdrift run --html report.html
```

## 接真实模型

把配置里的 `provider` 换成下面任意一个：

```yaml
# DeepSeek（OpenAI 兼容）
provider:
  type: openai
  model: deepseek-chat
  baseUrl: https://api.deepseek.com/v1
  apiKeyEnv: DEEPSEEK_API_KEY     # 从环境变量读，别把密钥写进文件
  temperature: 0
```

| 模型 | type | baseUrl |
|---|---|---|
| DeepSeek | `openai` | `https://api.deepseek.com/v1` |
| Kimi (Moonshot) | `openai` | `https://api.moonshot.cn/v1` |
| 通义千问 | `openai` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 豆包 (火山方舟) | `openai` | `https://ark.cn-beijing.volces.com/api/v3` |
| 智谱 GLM | `openai` | `https://open.bigmodel.cn/api/paas/v4` |
| 本地 Ollama | `ollama` | `http://localhost:11434` |
| Claude | `anthropic` | 默认官方 |

## 配置说明

```yaml
provider:
  type: openai            # openai | anthropic | ollama | mock
  model: deepseek-chat
  baseUrl: https://api.deepseek.com/v1
  apiKeyEnv: DEEPSEEK_API_KEY

judge:                    # 可选：llm-judge 用的裁判模型，缺省复用 provider
  type: openai
  model: deepseek-chat
  baseUrl: https://api.deepseek.com/v1
  apiKeyEnv: DEEPSEEK_API_KEY

prompt:
  system: "你是一个礼貌专业的中文客服。"
  user: "{{question}}"    # {{var}} 会被 test.vars 替换

defaultAssert:            # 可选：应用到每个用例的断言
  - type: regex
    value: "^[\\s\\S]{6,}$"

tests:
  - name: 退款问题
    vars: { question: "我要退款怎么办" }
    assert:
      - type: contains
        value: ["退款", "工作日"]   # 数组 = 必须全部包含
```

### 断言类型

| type | 作用 | 关键字段 |
|---|---|---|
| `contains` | 输出必须包含关键词（数组则全含） | `value` |
| `not-contains` | 输出不能出现这些词 | `value` |
| `regex` | 匹配正则 | `value` |
| `json-schema` | 输出是合法 JSON 且符合 schema | `schema` |
| `llm-judge` | 用模型按中文评分标准打分 | `rubric` `threshold` |

每条断言可加 `weight`（权重，默认 1），用例总分 = 加权平均。

## 命令

```
promptdrift init                 生成配置模板
promptdrift run [选项]           跑测试并对比基线
promptdrift baseline [选项]      跑一次并锁定为基线

选项:
  -c, --config <path>     指定配置文件
      --html <path>       输出自包含 HTML 报告
      --json <path>       输出 JSON 结果
      --update-baseline   run 跑完顺便更新基线
      --fail-on <mode>    CI 退出码: any(默认) | regression | none
```

## 放进 CI

```yaml
# .github/workflows/promptdrift.yml
- run: npx promptdrift run --fail-on regression
  env:
    DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
```

把 `.promptdrift/baseline.json` 提交进仓库，PR 改了提示词导致退化时 CI 直接红灯。

## 工作原理

```
配置(provider + prompt + tests)
        │
        ▼
   对每个用例调用模型 ──► 跑断言打分 ──► 加权得出用例分
        │
        ▼
   和 .promptdrift/baseline.json 逐用例对比
        │
        ▼
   终端表格 + HTML 报告 + CI 退出码（退化即非 0）
```

## License

MIT
