# 候选医嘱生成说明

精简版医嘱生成只依赖药物说明书结构化字段。

## 接口

`POST /api/orders/generate`

请求示例：

```json
{
  "drugId": "drug-demo-alpha",
  "diagnosis": "感染相关治疗",
  "scenario": "outpatient",
  "patientContext": {
    "allergies": ["青霉素"],
    "renalFunction": "unknown",
    "hepaticFunction": "unknown",
    "pregnancy": false,
    "lactation": false
  }
}
```

系统会读取药物说明书中的适应症、用法用量、禁忌、注意事项和相互作用字段，生成候选医嘱模板。

## 安全边界

生成内容只能作为候选模板，必须由医生结合患者情况、医院药品目录和最新说明书确认。
