/* ============================================================
 * 《碳迹·油链》图表渲染模块 charts.js
 * 依赖：ECharts 5（通过 CDN 引入）、data.js
 * ============================================================ */

/* ---------- 全局配色（深海青科普风，柔和统一） ---------- */
const PALETTE = ["#0a5f68", "#17717a", "#38868e", "#6ba6ac", "#9ec7cb"];
const C_DEEP = "#0a5f68";   // 主色
const C_MID = "#38868e";    // 中间色
const C_SOFT = "#4aa49c";   // 柔和青
const AXIS_TEXT = "#243b4d";
const AXIS_SUB = "#7a8b99";

/* ---------- 首页：五阶段碳排放占比环形图 ---------- */
function renderDonut(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const chart = echarts.init(el);

  const data = LCA_DATA.stages.map((s) => ({
    name: s.name,
    value: s.proportion
  }));

  chart.setOption({
    tooltip: {
      trigger: "item",
      formatter: (p) => {
        const st = LCA_DATA.stages.find((s) => s.name === p.name);
        const est = st && (st.id === "exploration" || st.id === "transport") ? "（估算拆分）" : "";
        return p.name + "<br/>碳排放占比：" + p.value + "%" + est;
      }
    },
    legend: {
      orient: "horizontal",
      bottom: 0,
      left: "center",
      itemWidth: 14,
      itemHeight: 14,
      textStyle: { color: AXIS_TEXT, fontSize: 12 }
    },
    series: [
      {
        name: "碳排放占比",
        type: "pie",
        radius: ["38%", "62%"],
        center: ["50%", "46%"],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 },
        label: {
          show: true,
          formatter: "{c}%",
          color: AXIS_TEXT,
          fontWeight: 600
        },
        emphasis: {
          label: { show: true, fontSize: 16, fontWeight: "bold" }
        },
        data: data,
        color: PALETTE
      }
    ]
  });

  // 窗口大小变化自适应
  window.addEventListener("resize", () => chart.resize());
  return chart;
}

/* ---------- 阶段详情页：某阶段碳排放量柱状图 ---------- */
function renderStageBar(elId, stageId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const chart = echarts.init(el);
  const stage = LCA_DATA.stages.find((s) => s.id === stageId);
  if (!stage) return;

  chart.setOption({
    tooltip: {
      trigger: "axis",
      formatter: () =>
        `${stage.name}<br/>碳排放量：约 ${stage.emission.toFixed(3)} kg CO₂e/L<br/>占全生命周期：${stage.proportion}%`
    },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: "category",
      data: [stage.name],
      axisLabel: { color: AXIS_TEXT, fontSize: 12 }
    },
    yAxis: {
      type: "value",
      name: "kg CO₂e/L",
      nameTextStyle: { color: AXIS_SUB },
      axisLabel: { color: AXIS_SUB }
    },
    series: [
      {
        type: "bar",
        barWidth: 60,
        data: [stage.emission],
        itemStyle: {
          color: C_DEEP,
          borderRadius: [6, 6, 0, 0]
        },
        label: {
          show: true,
          position: "top",
          formatter: `${stage.emission.toFixed(3)} kg CO₂e/L`,
          color: AXIS_TEXT,
          fontWeight: 600
        }
      }
    ]
  });

  window.addEventListener("resize", () => chart.resize());
  return chart;
}

/* ---------- 首页：全生命周期流程横向图（柱状模拟流程条） ---------- */
function renderFlow(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const chart = echarts.init(el);

  const stages = LCA_DATA.stages;
  const isEst = (i) => stages[i].id === "exploration" || stages[i].id === "transport";
  chart.setOption({
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        const i = params[0].dataIndex;
        return stages[i].name + "<br/>碳排放量：约 " + stages[i].emission.toFixed(3) + " kg CO₂e/L" + (isEst(i) ? "（估算拆分）" : "") + "<br/>占全生命周期：" + stages[i].proportion + "%";
      }
    },
    grid: { left: 50, right: 20, top: 30, bottom: 50 },
    xAxis: {
      type: "category",
      data: stages.map((s) => s.name),
      axisLabel: { color: AXIS_TEXT, fontSize: 12, interval: 0, rotate: 0 }
    },
    yAxis: {
      type: "value",
      name: "kg CO₂e/L",
      nameTextStyle: { color: AXIS_SUB },
      axisLabel: { color: AXIS_SUB }
    },
    series: [
      {
        type: "bar",
        data: stages.map((s) => s.emission),
        barWidth: 34,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: C_MID },
              { offset: 1, color: C_DEEP }
            ]
          }
        },
        label: {
          show: true,
          position: "top",
          formatter: (p) => `${stages[p.dataIndex].proportion}%`,
          color: AXIS_TEXT,
          fontWeight: 600
        }
      }
    ]
  });

  window.addEventListener("resize", () => chart.resize());
  return chart;
}

/* ---------- 对比页：燃油车 vs 电动车 ---------- */
function renderCompare(elId) {  const el = document.getElementById(elId);
  if (!el) return;
  const chart = echarts.init(el);

  chart.setOption({
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        const item = COMPARE_DATA.items[params[0].dataIndex];
        return `${item.name}<br/>约 ${item.value.toFixed(2)} kg CO₂e/km<br/>${item.note}`;
      }
    },
    grid: { left: 60, right: 30, top: 40, bottom: 50 },
    xAxis: {
      type: "category",
      data: COMPARE_DATA.items.map((i) => i.name),
      axisLabel: { color: AXIS_TEXT, fontSize: 12, interval: 0 }
    },
    yAxis: {
      type: "value",
      name: "kg CO₂e/km",
      nameTextStyle: { color: AXIS_SUB },
      axisLabel: { color: AXIS_SUB }
    },
    series: [
      {
        type: "bar",
        barWidth: 70,
        data: COMPARE_DATA.items.map((i) => ({
          value: i.value,
          itemStyle: { color: i.name.includes("燃油") ? C_DEEP : C_SOFT }
        })),
        label: {
          show: true,
          position: "top",
          formatter: (p) => `${COMPARE_DATA.items[p.dataIndex].value.toFixed(2)}`,
          color: AXIS_TEXT,
          fontWeight: 600
        }
      }
    ]
  });

  window.addEventListener("resize", () => chart.resize());
  return chart;
}

/* ---------- 首页：五阶段碳排放趋势折线图 ---------- */
function renderTrend(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const chart = echarts.init(el);

  const stages = LCA_DATA.stages;
  chart.setOption({
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        const s = stages[params[0].dataIndex];
        return `${s.name}<br/>碳排放量：约 ${s.emission.toFixed(3)} kg CO₂e/L<br/>占全生命周期：${s.proportion}%`;
      }
    },
    grid: { left: 60, right: 30, top: 40, bottom: 50 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: stages.map((s) => s.name),
      axisLabel: { color: AXIS_TEXT, fontSize: 12, interval: 0 }
    },
    yAxis: {
      type: "value",
      name: "kg CO₂e/L",
      nameTextStyle: { color: AXIS_SUB },
      axisLabel: { color: AXIS_SUB }
    },
    series: [
      {
        type: "line",
        smooth: true,
        data: stages.map((s) => s.emission),
        symbolSize: 9,
        lineStyle: { color: C_DEEP, width: 3 },
        itemStyle: { color: C_DEEP },
        areaStyle: { color: C_MID, opacity: 0.15 },
        label: {
          show: true,
          position: "top",
          formatter: (p) => stages[p.dataIndex].emission.toFixed(3),
          color: AXIS_TEXT,
          fontWeight: 600
        }
      }
    ]
  });

  window.addEventListener("resize", () => chart.resize());
  return chart;
}

/* ---------- 对比页：燃油车 vs 电动车 多维度雷达图（科普定性评分，非实测） ---------- */
function renderRadar(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const chart = echarts.init(el);

  chart.setOption({
    tooltip: {},
    legend: {
      bottom: 0,
      textStyle: { color: AXIS_TEXT, fontSize: 13 }
    },
    radar: {
      indicator: [
        { name: "碳排放表现\n（低=优）", max: 10 },
        { name: "使用成本", max: 10 },
        { name: "补能便利性", max: 10 },
        { name: "续航能力", max: 10 },
        { name: "维护成本", max: 10 }
      ],
      radius: "62%",
      center: ["50%", "48%"],
      splitNumber: 5,
      splitArea: {
        areaStyle: { color: ["rgba(56,134,142,0.04)", "rgba(56,134,142,0.08)"] }
      },
      axisName: { color: AXIS_TEXT, fontSize: 12 },
      axisLine: { lineStyle: { color: "#c3d6da" } },
      splitLine: { lineStyle: { color: "#dfe9ec" } }
    },
    series: [
      {
        type: "radar",
        symbolSize: 6,
        data: [
          {
            name: "燃油车（汽油）",
            value: [3, 6, 9, 8, 6],
            lineStyle: { color: C_DEEP, width: 2 },
            itemStyle: { color: C_DEEP },
            areaStyle: { color: C_DEEP, opacity: 0.18 }
          },
          {
            name: "电动车（电网平均）",
            value: [9, 8, 5, 6, 8],
            lineStyle: { color: C_SOFT, width: 2 },
            itemStyle: { color: C_SOFT },
            areaStyle: { color: C_SOFT, opacity: 0.18 }
          }
        ]
      }
    ]
  });

  window.addEventListener("resize", () => chart.resize());
  return chart;
}
