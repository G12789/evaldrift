# evaldrift 推广帖（掘金 / V2EX）

> 复制即用。风格：技术分享、第一人称、不硬卖。链接放文末。

---

## 掘金

**标题**：开源了一个给 LLM prompt 做回归测试的 CLI —— evaldrift（国产模型优先）

**标签**：`人工智能` `开源` `Node.js` `Prompt` `DeepSeek`

**正文**：

最近在做 AI 应用的时候踩到一个很烦的坑：

为了修好一个场景的 prompt，改完发现另一个场景悄悄坏了。而且往往是你上线好几天、用户来投诉了才知道。

单元测试能防代码退化，但 prompt 没有。promptfoo、deepeval 这些工具不错，不过对 **DeepSeek / Kimi / 通义 / 豆包** 和中文评测支持都比较弱，配置也偏重。

所以我开源了一个小工具：**evaldrift**。

### 它解决什么问题

把 prompt 当成代码来管：

1. 写一组测试用例（输入 + 断言）
2. 跑一遍，锁定**基线**
3. 以后每次改 prompt 再跑，自动对比基线，标出**哪些用例退化了**

就像 jest snapshot，只不过是给 LLM 用的。

### 30 秒上手

```bash
npx evaldrift init    # 生成配置，默认离线 mock，不用 API Key
npx evaldrift run     # 跑测试
npx evaldrift baseline  # 锁定基线
# 改完 prompt 再跑
npx evaldrift run --html report.html
```

### 几个我觉得实用的点

- **国产模型一等公民**：OpenAI 兼容接口，换 `baseUrl` 就能接 DeepSeek / Kimi / 通义 / 豆包 / 智谱
- **离线可跑**：内置 mock provider，没 Key 也能先把用例和断言调通
- **4 种断言**：contains / regex / json-schema / llm-judge（中文裁判）
- **CI 友好**：`--fail-on regression`，退化就非 0 退出码
- **纯本地**：数据不出本机，零服务器

### 和 promptfoo 的区别

不是要做替代品，而是补一个空档：

- 中文优先（报错、裁判提示、报告全是中文）
- 聚焦「防退化」这一件事，基线对比 + `通过→失败` 高亮
- 配置一个 YAML 文件搞定，比大而全的 eval 框架轻很多

### 开源地址

- GitHub：https://github.com/G12789/evaldrift
- npm：`npx evaldrift`

欢迎 star / issue，尤其是国产模型接入踩坑、断言类型需求，我会优先加。

---

## V2EX

**节点**：`分享创造` 或 `程序员`

**标题**：[开源] evaldrift — 给 LLM prompt 做回归测试的 CLI，国产模型优先，npx 即用

**正文**：

分享一个刚开源的小工具，解决我自己调 prompt 时的痛点。

**背景**：改 prompt 修好 A 场景，B/C 悄悄坏了，上线后才发现。现有 eval 工具（promptfoo 等）对国产模型和中文场景支持一般，配置也偏重。

**evaldrift 做什么**：

- 快照式回归测试：锁基线 → 改 prompt → 跑测试 → 标出退化用例
- 国产模型优先：DeepSeek / Kimi / 通义 / 豆包 / Ollama，OpenAI 兼容换 baseUrl 即可
- 离线 mock 开箱即跑，不用 API Key 也能先把断言调通
- 4 种断言：contains / regex / json-schema / llm-judge
- CI：`--fail-on regression`，退化非 0 退出码
- 终端表格 + 自包含 HTML 报告

```bash
npx evaldrift init
npx evaldrift run
npx evaldrift baseline
```

- GitHub: https://github.com/G12789/evaldrift
- npm: https://www.npmjs.com/package/evaldrift

MIT 协议，纯本地跑，数据不出本机。欢迎试用和提 issue。

---

## 发帖注意

| 平台 | 建议 |
|---|---|
| 掘金 | 封面用 `docs/demo-terminal.png`；正文配图用 `docs/demo-report.png` |
| V2EX | 不要外链堆太多，GitHub + npm 两个就够；语气偏分享，别像广告 |
| 时间 | 工作日白天发，避开深夜 |
