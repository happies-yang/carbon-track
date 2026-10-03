/* ============================================================
 * 《碳迹·油链》AI 功能模块 ai.js
 * ------------------------------------------------------------
 * 实现 4 项真实可用的 AI 功能：
 *   1. AI 碳足迹解读：点击某个生命周期阶段，AI 生成科普解读
 *   2. AI 数据问答：用户自由提问，AI 基于项目知识库回答
 *   3. AI 减排建议（场景化）：选择场景，AI 生成科普型减排建议
 *   4. AI 环节级减排建议：阶段详情页跳转，针对具体环节生成减排建议
 *
 * 【接入方式】阿里云百炼（通义千问）兼容 OpenAI 格式接口。
 * 已配置可用 API Key（qwen-plus 模型，已实测通过）。
 *
 * 【安全提示 · 必读】
 * 本文件为竞赛演示用途，API Key 直连前端，公开部署在 GitHub Pages 上，
 * Key 会暴露给任何访问者。风险控制建议：
 *   1. 在阿里云百炼控制台为该 Key 设置「消费限额/额度告警」，控制泄露损失；
 *   2. 竞赛结束后立即在百炼控制台吊销该 Key 并更换新 Key；
 *   3. 如需长期公开部署，请改为后端代理转发（本演示版未做后端）；
 *   4. 正式公开部署将改用后端代理（Vercel Serverless / Cloudflare Workers），
 *      Key 存放于后端环境变量，前端只调用自有代理地址。
 * ============================================================ */

const AI_CONFIG = {
  apiKey: "sk-ws-H.PRHXXDL.xm5m.MEUCIDp0_8XY3mubhagfzPEj-ga-6gBhYwU2feaOVnMApbgEAiEAn5AQs0n3-m-llVDf5yoXIHOe3QF_1b3KcOZf1q0gcc0", // 阿里云百炼 API Key（已配置）
  apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  model: "qwen-plus",
  temperature: 0.7
};

/* ---------- 系统提示词：约束 AI 只使用项目知识库，禁止编造数据 ---------- */
const SYSTEM_PROMPT = `你是《碳迹·油链——一滴汽油的全生命周期碳足迹智能可视化系统》的碳足迹科普助手。
你服务的对象是石油化工专业学生与社会科普受众。

【强制规则】
1. 你只能使用系统传入的项目数据（data.js）、内置知识库条目（kb.js）与下列参考文献资料回答用户问题。
2. 严禁编造任何碳排放数值、工艺参数或政策信息。
3. 如果用户的问题超出系统知识库范围（例如问油价、问其他产品碳足迹、问与汽油碳足迹无关的话题），请直接回复：
   "该问题不在本系统知识库范围内，请提问汽油全生命周期碳足迹相关问题（如五个生命周期阶段的排放、炼化环节低碳改造、CCUS 技术、燃油车与电动车对比等）。"
4. 所有回答末尾必须附带一句："AI 回答仅供科普参考，不构成专业碳足迹认证依据。"
5. 若本轮消息中带有【知识库条目】区块，回答必须优先采用其中内容，并在引用数据时标注条目编号与来源名称，格式如（依据 KB01，来源：零碳实验室《GHG S3.3 中国汽油和柴油上游排放因子（2024）》）。
【知识库要点】
- 系统核算边界：汽油全生命周期 = 原油勘探与开采 → 原油运输 → 炼油炼化 → 成品油配送储运 → 机动车终端燃烧。
- 排除边界：工厂基建、设备机械制造、车辆制造与报废处置不纳入核算。
- 五个阶段碳排放占比（科普参考值，与系统 data.js 一致）：原油勘探与开采约 7.3%、原油运输约 1.5%、炼油炼化约 8.2%、成品油配送储运约 0.5%、机动车终端燃烧约 82.5%（三位小数口径合计 2.678 ≈ 2.68）。
- 全生命周期总量约 2.68 kg CO₂e/L（上游约 0.4691 + 燃烧约 2.21）。
- 终端燃烧和炼油炼化是汽油碳足迹的两大主要排放来源。
- 炼油环节主要排放来自：常减压蒸馏等装置加热能耗、催化裂化与加氢装置能耗、制氢（天然气重整）过程。
- 石化行业主要减排路径：装置节能改造、绿氢替代制氢、CCUS（二氧化碳捕集利用与封存）；"十五五"规划提出 2030 年 CCS/CCUS 年注入二氧化碳达 1000 万吨。
- 对比参考（与系统 data.js 一致）：燃油车约 0.21 kg CO₂e/km（按油耗 8L/100km × 全生命周期 2.68 kgCO₂e/L 估算），电动车约 0.09 kg CO₂e/km（按百公里电耗 15 kWh 含充电损耗 × 中国电网平均排放因子 0.5777 kgCO₂e/kWh 估算，来源：生态环境部《2024年全国电力碳足迹因子》，约为燃油车的四成）。

【回答风格】科普、通俗、有条理，面向非专业大众，用短段落和要点式表达。`;

/* ---------- 知识库检索：按问题关键词命中条目（中文直接匹配 tags） ---------- */
function retrieveKB(question) {
  if (!window.KB || !question) return [];
  var text = String(question);
  var hits = [];
  for (var i = 0; i < KB.length; i++) {
    var item = KB[i];
    var score = 0;
    var matched = [];
    var words = item.tags.concat([item.q]);
    for (var j = 0; j < words.length; j++) {
      var kw = String(words[j]);
      if (kw.length >= 2 && text.indexOf(kw) >= 0) {
        score += kw.length >= 4 ? 3 : 2;
        matched.push(kw);
      }
    }
    if (score > 0) {
      hits.push({ item: item, score: score, matched: matched });
    }
  }
  hits.sort(function (a, b) { return b.score - a.score; });
  return hits.slice(0, 3);
}

/* ---------- 构造发送给 API 的消息（含知识库命中条目） ---------- */
function buildMessages(userContent) {
  var kbHits = retrieveKB(userContent);
  var kbBlock = "";
  if (kbHits.length > 0) {
    var lines = [];
    for (var i = 0; i < kbHits.length; i++) {
      var it = kbHits[i].item;
      var srcText = [];
      for (var k = 0; k < it.src.length; k++) {
        srcText.push(it.src[k] + "《" + (KB_SOURCES[it.src[k]] || "") + "》");
      }
      lines.push(
        "【" + it.id + "｜" + it.q + "】" + it.a + "（来源：" + srcText.join("；") + "）"
      );
    }
    kbBlock = "\n\n【知识库条目——本次回答必须优先采用，并标注编号与来源】\n" + lines.join("\n");
  }
  return [
    { role: "system", content: SYSTEM_PROMPT + kbBlock },
    { role: "user", content: userContent }
  ];
}

/* ---------- 调用大模型 API（返回回答文本） ---------- */
async function callAI(userContent) {
  if (!AI_CONFIG.apiKey) {
    throw new Error(
      "未配置 API Key：请在 js/ai.js 的 AI_CONFIG.apiKey 中填入大模型 API Key。"
    );
  }

  const response = await fetch(AI_CONFIG.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_CONFIG.apiKey}`
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages: buildMessages(userContent),
      temperature: AI_CONFIG.temperature,
      stream: false
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error("API Key 无效或无权限：请检查 js/ai.js 中的 apiKey 是否正确、是否已开通百炼模型服务。");
    }
    if (response.status === 402 || response.status === 429) {
      throw new Error("AI 服务账户余额不足或触发限流：请到阿里云百炼控制台充值 / 查看配额后重试。");
    }
    throw new Error(`AI 接口调用失败（HTTP ${response.status}）：${errText}`);
  }

  const json = await response.json();
  const answer = json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content
    : "";
  if (!answer) {
    throw new Error("AI 接口返回内容为空，请稍后重试。");
  }
  // 强制附加“AI 生成”标识（符合生成式 AI 内容标识要求，双保险：即使模型未按提示词附注也会补上）
  const aiMark = "（AI 生成内容，仅供科普参考，不构成专业碳足迹认证依据）";
  if (!answer.includes("AI 生成")) {
    return answer.trimEnd() + "\n\n" + aiMark;
  }
  return answer;
}

/* ============================================================
 * 功能 1：AI 碳足迹解读（传入阶段 id）
 * ============================================================ */
async function aiInterpret(stageId) {
  const stage = LCA_DATA.stages.find((s) => s.id === stageId);
  if (!stage) throw new Error("未找到该生命周期阶段数据。");

  const userContent = `请为「${stage.name}」环节生成一段面向大众的碳足迹科普解读。
环节基础数据（来自系统 data.js）：
- 碳排放量：约 ${stage.emission.toFixed(3)} kg CO₂e/L
- 占全生命周期比例：${stage.proportion}%
- 环节说明：${stage.description}
- 关键要点：${stage.keyPoints.join("；")}
请用通俗语言解读该环节为什么会产生碳排放、排放特点是什么、有哪些减排方向，150 字左右。`;

  return callAI(userContent);
}

/* ============================================================
 * 功能 2：AI 数据问答（用户自由提问）
 * ============================================================ */
async function aiAsk(question) {
  if (!question || !question.trim()) {
    throw new Error("请输入你要咨询的问题。");
  }
  return callAI(`用户提问：${question.trim()}`);
}

/* ============================================================
 * 功能 3：AI 减排建议（选择场景）
 * ============================================================ */
async function aiSuggest(scene) {
  const sceneText = {
    student: "我是一名石油化工专业学生，想了解石化行业如何实现低碳转型",
    driver: "我是一名汽油车车主，想了解日常用车如何减少碳排放",
    public: "我想了解国家双碳目标下，普通人可以为减排做什么"
  }[scene] || "我想了解汽油碳足迹相关的减排建议";

  return callAI(`请基于系统知识库，针对以下场景给出 3-4 条具体、可执行的科普型减排建议（每条 20 字以内）：${sceneText}`);
}

/* ---------- 功能 4：针对某生命周期环节的 AI 减排建议（从阶段详情页跳转调用） ---------- */
async function aiSuggestStage(stageId) {
  const stage = LCA_DATA.stages.find((s) => s.id === stageId);
  if (!stage) throw new Error("未找到该环节数据。");
  return callAI(
    `请基于系统知识库，针对「${stage.name}」环节（占全生命周期 ${stage.proportion}%，约 ${stage.emission.toFixed(3)} kg CO₂e/L）给出 3-4 条具体、可执行的科普型减排建议（每条 20 字以内）。`
  );
}

/* ---------- 导出供页面调用 ---------- */
window.AIService = {
  interpret: aiInterpret,
  ask: aiAsk,
  suggest: aiSuggest,
  suggestStage: aiSuggestStage
};
